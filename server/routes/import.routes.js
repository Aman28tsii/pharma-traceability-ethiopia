// server/routes/import.routes.js - Phase 11
import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// ---- Phase 12 P1-1: strip UTF-8 BOM from the first column key ----
const stripBomFromKey = (key) =>
    key && key.charCodeAt(0) === 0xFEFF ? key.slice(1) : key;

const stripBomFromRow = (row) => {
    const out = {};
    for (const k of Object.keys(row)) {
        out[stripBomFromKey(k)] = row[k];
    }
    return out;
};

const readCsv = (filePath) =>
    new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (d) => rows.push(stripBomFromRow(d)))
            .on('end', () => resolve(rows))
            .on('error', reject);
    });

const cleanup = (files) => {
    for (const f of files) {
        try { if (f && f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch (e) {}
    }
};

const isFourteenDigits = (v) => typeof v === 'string' && /^\d{14}$/.test(v.trim());
const isIsoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
const isFutureOrToday = (v) => {
    if (!isIsoDate(v)) return false;
    const d = new Date(v + 'T00:00:00Z');
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    return d >= now;
};
const isPositiveInt = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1;
};

// ---------- existing: PRODUCT IMPORT ----------
router.post('/products', authenticateToken, requireRole(['admin', 'importer']), upload.single('file'), async (req, res) => {
    const results = [];
    const errors = [];
    let successCount = 0;

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            for (const row of results) {
                try {
                    const { gtin, product_name, manufacturer, strength } = row;
                    if (!gtin || !product_name) {
                        errors.push({ row, error: 'GTIN and Product Name required' });
                        continue;
                    }

                    await pool.query(
                        `INSERT INTO products (gtin, product_name, manufacturer, strength, created_by, organization_id)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [gtin, product_name, manufacturer, strength, req.user.id, req.user.organization_id]
                    );
                    successCount++;
                } catch (err) {
                    errors.push({ row, error: err.message });
                }
            }

            fs.unlinkSync(req.file.path);

            res.json({
                success: true,
                total: results.length,
                imported: successCount,
                failed: errors.length,
                errors
            });
        });
});

// ---------- Phase 11: BULK BATCH + SERIAL IMPORT ----------
// batches.csv columns: batch_number, product_gtin, expiry_date, quantity, serialization
// serials.csv columns: batch_number, serial_number
// serialization is 'none' or 'supplied'. Never auto-generate serials here.
router.post(
    '/batches',
    authenticateToken,
    requireRole(['admin', 'importer']),
    upload.fields([{ name: 'batches', maxCount: 1 }, { name: 'serials', maxCount: 1 }]),
    async (req, res) => {
        const orgId = req.user.organization_id;
        const dryRun = String(req.query.dry_run || 'false').toLowerCase() === 'true';
        const files = [];

        try {
            if (!req.files || !req.files.batches || req.files.batches.length === 0) {
                return res.status(400).json({ error: 'batches CSV file is required' });
            }

            const batchFile = req.files.batches[0];
            const serialFile = req.files.serials && req.files.serials[0] ? req.files.serials[0] : null;
            files.push(batchFile);
            if (serialFile) files.push(serialFile);

            const batchRows = await readCsv(batchFile.path);
            const serialRows = serialFile ? await readCsv(serialFile.path) : [];

            const errors = [];
            const warnings = [];

            // ---------- validate batch rows ----------
            const batches = new Map();
            batchRows.forEach((row, i) => {
                const line = i + 1;
                const bn = (row.batch_number || '').trim();
                const gtin = (row.product_gtin || '').trim();
                const exp = (row.expiry_date || '').trim();
                const q = row.quantity;
                const ser = (row.serialization || '').trim().toLowerCase();

                if (!bn) errors.push({ file: 'batches', row: line, error: 'batch_number required' });
                if (!isFourteenDigits(gtin)) errors.push({ file: 'batches', row: line, error: 'product_gtin must be 14 digits' });
                if (!isIsoDate(exp)) errors.push({ file: 'batches', row: line, error: 'expiry_date must be YYYY-MM-DD' });
                else if (!isFutureOrToday(exp)) errors.push({ file: 'batches', row: line, error: 'expiry_date is in the past' });
                if (!isPositiveInt(q)) errors.push({ file: 'batches', row: line, error: 'quantity must be an integer >= 1' });
                if (ser !== 'none' && ser !== 'supplied') errors.push({ file: 'batches', row: line, error: "serialization must be 'none' or 'supplied'" });

                if (bn) {
                    if (batches.has(bn)) {
                        errors.push({ file: 'batches', row: line, error: `duplicate batch_number ${bn}` });
                    } else {
                        batches.set(bn, {
                            batch_number: bn,
                            product_gtin: gtin,
                            expiry_date: exp,
                            quantity: isPositiveInt(q) ? Number(q) : null,
                            serialization: ser,
                        });
                    }
                }
            });

            // ---------- validate serial rows ----------
            const serialsByBatch = new Map();
            const seenSerials = new Set();
            serialRows.forEach((row, i) => {
                const line = i + 1;
                const bn = (row.batch_number || '').trim();
                const sn = (row.serial_number || '').trim();

                if (!bn) errors.push({ file: 'serials', row: line, error: 'batch_number required' });
                if (!sn) errors.push({ file: 'serials', row: line, error: 'serial_number required' });
                if (sn && seenSerials.has(sn)) {
                    errors.push({ file: 'serials', row: line, error: `duplicate serial_number ${sn} in file` });
                }
                if (sn) seenSerials.add(sn);

                if (bn && sn) {
                    if (!serialsByBatch.has(bn)) serialsByBatch.set(bn, []);
                    serialsByBatch.get(bn).push({ row: line, serial_number: sn });
                }
            });

            // ---------- cross-validation ----------
            for (const [bn, batch] of batches.entries()) {
                const serials = serialsByBatch.get(bn) || [];
                if (batch.serialization === 'none' && serials.length > 0) {
                    errors.push({ file: 'cross', row: 0, error: `Batch ${bn}: has ${serials.length} serials but serialization=none` });
                }
                if (batch.serialization === 'supplied' && batch.quantity !== null && serials.length > batch.quantity) {
                    errors.push({ file: 'cross', row: 0, error: `Batch ${bn}: ${serials.length} serials exceeds quantity ${batch.quantity}` });
                }
                if (batch.serialization === 'supplied' && serials.length === 0) {
                    warnings.push(`Batch ${bn}: serialization=supplied but no serials were provided; batch will be created without serials.`);
                }
            }
            for (const bn of serialsByBatch.keys()) {
                if (!batches.has(bn)) {
                    errors.push({ file: 'cross', row: 0, error: `Serial file references unknown batch_number ${bn}` });
                }
            }

            // ---------- DB validation ----------
            const client = await pool.connect();
            try {
                if (errors.length === 0) {
                    const bnList = [...batches.keys()];
                    if (bnList.length > 0) {
                        const existing = await client.query(
                            `SELECT batch_number FROM batches WHERE organization_id = $1 AND batch_number = ANY($2::text[])`,
                            [orgId, bnList]
                        );
                        for (const r of existing.rows) {
                            errors.push({ file: 'db', row: 0, error: `batch_number ${r.batch_number} already exists in this branch` });
                        }
                    }

                    const gtinList = [...new Set([...batches.values()].map(b => b.product_gtin))];
                    if (gtinList.length > 0) {
                        const existing = await client.query(
                            `SELECT gtin FROM products WHERE organization_id = $1 AND gtin = ANY($2::text[])`,
                            [orgId, gtinList]
                        );
                        const found = new Set(existing.rows.map(r => r.gtin));
                        for (const g of gtinList) {
                            if (!found.has(g)) errors.push({ file: 'db', row: 0, error: `product_gtin ${g} not found in this branch` });
                        }
                    }

                    const snList = [...seenSerials];
                    if (snList.length > 0) {
                        const existing = await client.query(
                            `SELECT serial_number FROM serialized_units WHERE organization_id = $1 AND serial_number = ANY($2::text[])`,
                            [orgId, snList]
                        );
                        for (const r of existing.rows) {
                            errors.push({ file: 'db', row: 0, error: `serial_number ${r.serial_number} already exists in this branch` });
                        }
                    }
                }

                // ---------- dry run ----------
                if (dryRun) {
                    cleanup(files);
                    if (errors.length > 0) {
                        return res.status(400).json({ success: false, errors });
                    }
                    return res.json({
                        success: true,
                        dry_run: true,
                        batches_valid: batches.size,
                        serials_valid: seenSerials.size,
                        warnings,
                    });
                }

                if (errors.length > 0) {
                    cleanup(files);
                    return res.status(400).json({ success: false, errors });
                }

                // ---------- transactional import ----------
                await client.query('BEGIN');

                let batchesCreated = 0;
                let unitsCreated = 0;
                let serialsCreated = 0;
                let movementsCreated = 0;
                let traceEventsCreated = 0;

                for (const [, batch] of batches.entries()) {
                    const productResult = await client.query(
                        `SELECT id, gtin FROM products WHERE organization_id = $1 AND gtin = $2`,
                        [orgId, batch.product_gtin]
                    );
                    const product = productResult.rows[0];

                    const batchResult = await client.query(
                        `INSERT INTO batches
                            (batch_number, product_id, expiry_date, quantity, on_hand_quantity,
                             status, is_recalled, created_by, organization_id, location_id)
                         VALUES ($1, $2, $3, $4, $4, 'active', false, $5, $6, $7)
                         RETURNING id`,
                        [batch.batch_number, product.id, batch.expiry_date, batch.quantity,
                         req.user.id, orgId, req.user.location_id]
                    );
                    const batchId = batchResult.rows[0].id;
                    batchesCreated++;

                    await client.query(
                        `INSERT INTO stock_movements
                            (organization_id, batch_id, batch_number, gtin, movement_type,
                             quantity_delta, reference_type, counterparty, notes, performed_by, ip_address)
                         VALUES ($1, $2, $3, $4, 'initial', $5, 'initial', NULL, $6, $7, $8)`,
                        [orgId, batchId, batch.batch_number, product.gtin, batch.quantity,
                         'Bulk import opening balance', req.user.id, req.ip]
                    );
                    movementsCreated++;

                    const serials = serialsByBatch.get(batch.batch_number) || [];
                    if (serials.length > 0) {
                        const snList = serials.map(s => s.serial_number);

                        await client.query(
                            `INSERT INTO serialized_units
                                (gtin, serial_number, batch_number, expiry_date, status,
                                 organization_id, location_id)
                             SELECT $1, s, $2, $3, 'active', $4, $5
                             FROM unnest($6::text[]) AS s`,
                            [product.gtin, batch.batch_number, batch.expiry_date, orgId,
                             req.user.location_id, snList]
                        );
                        unitsCreated += snList.length;
                        serialsCreated += snList.length;

                        await client.query(
                            `INSERT INTO trace_events
                                (serial_number, event_type, to_gln, location, user_id,
                                 organization_id, location_id, batch_number)
                             SELECT s, 'manufacture', $1, $2, $3, $4, $5, $6
                             FROM unnest($7::text[]) AS s`,
                            [req.user.gln || null, null, req.user.id, orgId,
                             req.user.location_id, batch.batch_number, snList]
                        );
                        traceEventsCreated += snList.length;
                    }
                }

                await client.query('COMMIT');

                await logAction(pool, {
                    userId: req.user.id,
                    organizationId: orgId,
                    action: 'IMPORT',
                    entityType: 'batch',
                    entityId: null,
                    newData: {
                        batches_created: batchesCreated,
                        units_created: unitsCreated,
                        serials_created: serialsCreated,
                        movements_created: movementsCreated,
                        trace_events_created: traceEventsCreated,
                    },
                    ipAddress: req.ip,
                });

                cleanup(files);

                return res.status(201).json({
                    success: true,
                    batches_created: batchesCreated,
                    units_created: unitsCreated,
                    serials_created: serialsCreated,
                    movements_created: movementsCreated,
                    trace_events_created: traceEventsCreated,
                    warnings,
                });
            } catch (innerErr) {
                try { await client.query('ROLLBACK'); } catch (e) {}
                console.error('Bulk batch import error:', innerErr);
                cleanup(files);
                return res.status(500).json({ success: false, error: innerErr.message });
            } finally {
                client.release();
            }
        } catch (err) {
            console.error('Import outer error:', err);
            cleanup(files);
            return res.status(500).json({ success: false, error: err.message });
        }
    }
);

export default router;