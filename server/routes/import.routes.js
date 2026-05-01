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
            `INSERT INTO products (gtin, product_name, manufacturer, strength, created_by) 
             VALUES ($1, $2, $3, $4, $5)`,
            [gtin, product_name, manufacturer, strength, req.user.id]
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

export default router;