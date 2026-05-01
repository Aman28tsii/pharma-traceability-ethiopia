import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/products';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Get all products
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, 
                    COUNT(DISTINCT b.id) as batch_count,
                    COUNT(DISTINCT su.id) as unit_count
             FROM products p
             LEFT JOIN batches b ON b.product_id = p.id
             LEFT JOIN serialized_units su ON su.gtin = p.gtin
             GROUP BY p.id
             ORDER BY p.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch products error:', err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get single product
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, 
                    json_agg(DISTINCT b.*) as batches
             FROM products p
             LEFT JOIN batches b ON b.product_id = p.id
             WHERE p.id = $1
             GROUP BY p.id`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Fetch product error:', err);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Create product
router.post('/', authenticateToken, requireRole(['admin', 'importer']), upload.single('image'), async (req, res) => {
    const {
        gtin,
        product_name,
        generic_name,
        manufacturer,
        manufacturer_gln,
        dosage_form,
        strength,
        pack_size,
        prescription_required
    } = req.body;

    if (!gtin || !product_name) {
        return res.status(400).json({ error: 'GTIN and product name required' });
    }

    try {
        const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

        const result = await pool.query(
            `INSERT INTO products 
             (gtin, product_name, generic_name, manufacturer, manufacturer_gln, 
              dosage_form, strength, pack_size, prescription_required, image_url, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
             RETURNING *`,
            [gtin, product_name, generic_name, manufacturer, manufacturer_gln,
             dosage_form, strength, pack_size, prescription_required === 'true', 
             imageUrl, req.user.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            res.status(409).json({ error: 'Product with this GTIN already exists' });
        } else {
            console.error('Create product error:', err);
            res.status(500).json({ error: 'Failed to create product' });
        }
    }
});

// Update product
router.put('/:id', authenticateToken, requireRole(['admin', 'importer']), async (req, res) => {
    const { product_name, manufacturer, strength, pack_size } = req.body;

    try {
        const result = await pool.query(
            `UPDATE products 
             SET product_name = COALESCE($1, product_name),
                 manufacturer = COALESCE($2, manufacturer),
                 strength = COALESCE($3, strength),
                 pack_size = COALESCE($4, pack_size),
                 updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [product_name, manufacturer, strength, pack_size, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update product error:', err);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete product (soft delete)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        await pool.query(
            `UPDATE products SET is_active = false WHERE id = $1`,
            [req.params.id]
        );
        res.json({ message: 'Product deactivated successfully' });
    } catch (err) {
        console.error('Delete product error:', err);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

export default router;