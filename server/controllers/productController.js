import { query } from '../config/database.js';

export const createProduct = async (req, res) => {
  try {
    const { gtin, product_name, manufacturer, manufacturer_gln, dosage_form, strength, pack_size, prescription_required } = req.body;
    const result = await query(
      `INSERT INTO products (gtin, product_name, manufacturer, manufacturer_gln, dosage_form, strength, pack_size, prescription_required, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [gtin, product_name, manufacturer, manufacturer_gln, dosage_form, strength, pack_size, prescription_required, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    const result = await query('SELECT * FROM products ORDER BY product_name');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};