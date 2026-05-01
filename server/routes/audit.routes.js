import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Import products from CSV
router.post('/products', authenticateToken, requireRole(['admin', 'importer']), upload.single('file'), async (req, res) => {
    const results = [];
    const errors = [];
    let successCount = 0;

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

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
                    
                    // Check if product already exists
                    const existing = await pool.query('SELECT id FROM products WHERE gtin = $1', [gtin]);
                    if (existing.rows.length > 0) {
                        errors.push({ row, error: 'Product with this GTIN already exists' });
                        continue;
                    }
                    
                    await pool.query(
                        `INSERT INTO products (gtin, product_name, manufacturer, strength, created_by) 
                         VALUES ($1, $2, $3, $4, $5)`,
                        [gtin, product_name, manufacturer || null, strength || null, req.user.id]
                    );
                    successCount++;
                } catch (err) {
                    errors.push({ row, error: err.message });
                }
            }
            
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            
            res.json({
                success: true,
                total: results.length,
                imported: successCount,
                failed: errors.length,
                errors: errors.slice(0, 10) // Return first 10 errors
            });
        });
});

// Import batches from CSV
router.post('/batches', authenticateToken, requireRole(['admin', 'importer']), upload.single('file'), async (req, res) => {
    const results = [];
    const errors = [];
    let successCount = 0;

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            for (const row of results) {
                try {
                    const { product_gtin, batch_number, expiry_date, quantity } = row;
                    
                    if (!product_gtin || !batch_number || !expiry_date || !quantity) {
                        errors.push({ row, error: 'Missing required fields' });
                        continue;
                    }
                    
                    // Find product by GTIN
                    const product = await pool.query('SELECT id FROM products WHERE gtin = $1', [product_gtin]);
                    if (product.rows.length === 0) {
                        errors.push({ row, error: `Product with GTIN ${product_gtin} not found` });
                        continue;
                    }
                    
                    // Check if batch already exists
                    const existing = await pool.query('SELECT id FROM batches WHERE batch_number = $1', [batch_number]);
                    if (existing.rows.length > 0) {
                        errors.push({ row, error: 'Batch number already exists' });
                        continue;
                    }
                    
                    await pool.query(
                        `INSERT INTO batches (batch_number, product_id, expiry_date, quantity, created_by) 
                         VALUES ($1, $2, $3, $4, $5)`,
                        [batch_number, product.rows[0].id, expiry_date, parseInt(quantity), req.user.id]
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
                errors: errors.slice(0, 10)
            });
        });
});

export default router;