import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Generate EFDA compliance report
router.get('/efda', authenticateToken, requireRole(['admin', 'auditor']), async (req, res) => {
    const { start_date, end_date, format = 'json' } = req.query;

    try {
        let query = `
            SELECT 
                su.gtin,
                su.serial_number,
                su.batch_number,
                su.expiry_date,
                su.status as current_status,
                su.current_owner_gln,
                su.last_scanned_at,
                p.product_name,
                p.manufacturer,
                te.event_type,
                te.created_at as event_date,
                te.location as event_location,
                u.name as performed_by
            FROM serialized_units su
            JOIN products p ON su.gtin = p.gtin
            LEFT JOIN trace_events te ON su.serial_number = te.serial_number
            LEFT JOIN users u ON te.user_id = u.id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 1;

        if (start_date) {
            query += ` AND te.created_at >= $${paramCount}`;
            params.push(start_date);
            paramCount++;
        }

        if (end_date) {
            query += ` AND te.created_at <= $${paramCount}`;
            params.push(end_date);
            paramCount++;
        }

        query += ` ORDER BY te.created_at DESC`;

        const result = await pool.query(query, params);

        if (format === 'csv') {
            const csvData = convertToCSV(result.rows);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=efda-report-${Date.now()}.csv`);
            return res.send(csvData);
        } else if (format === 'xml') {
            const xmlData = convertToXML(result.rows);
            res.setHeader('Content-Type', 'application/xml');
            res.setHeader('Content-Disposition', `attachment; filename=efda-report-${Date.now()}.xml`);
            return res.send(xmlData);
        } else {
            res.json({
                report_date: new Date().toISOString(),
                total_records: result.rows.length,
                data: result.rows
            });
        }
    } catch (err) {
        console.error('Report generation error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Inventory report
router.get('/inventory', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                p.product_name,
                p.gtin,
                COUNT(su.id) as total_units,
                COUNT(CASE WHEN su.status = 'active' THEN 1 END) as active_units,
                COUNT(CASE WHEN su.status = 'sold' THEN 1 END) as sold_units,
                COUNT(CASE WHEN su.status = 'recalled' THEN 1 END) as recalled_units,
                MIN(su.expiry_date) as earliest_expiry,
                MAX(su.expiry_date) as latest_expiry
             FROM products p
             LEFT JOIN serialized_units su ON p.gtin = su.gtin
             GROUP BY p.id, p.product_name, p.gtin
             ORDER BY p.product_name`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Inventory report error:', err);
        res.status(500).json({ error: 'Failed to generate inventory report' });
    }
});

// Helper functions
function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
        headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value).replace(/,/g, ';');
        }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
}

function convertToXML(data) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<EFDAReport>\n';
    xml += `  <generated>${new Date().toISOString()}</generated>\n`;
    xml += `  <totalRecords>${data.length}</totalRecords>\n`;
    xml += '  <records>\n';
    
    data.forEach(item => {
        xml += '    <record>\n';
        for (const [key, value] of Object.entries(item)) {
            if (value !== null && value !== undefined) {
                xml += `      <${key}>${escapeXml(String(value))}</${key}>\n`;
            }
        }
        xml += '    </record>\n';
    });
    
    xml += '  </records>\n';
    xml += '</EFDAReport>';
    return xml;
}

function escapeXml(str) {
    return str.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case "'": return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

export default router;