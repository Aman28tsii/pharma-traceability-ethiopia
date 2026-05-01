import { query } from '../config/database.js';

export const verifyProduct = async (req, res) => {
  try {
    const { gtin, serialNumber } = req.params;

    const result = await query(
      `SELECT su.*, p.product_name, p.manufacturer, b.expiry_date
       FROM serialized_units su
       JOIN products p ON su.gtin = p.gtin
       JOIN batches b ON su.batch_number = b.batch_number
       WHERE su.gtin = $1 AND su.serial_number = $2`,
      [gtin, serialNumber]
    );

    if (result.rows.length === 0) {
      return res.json({ valid: false, status: 'not_found', message: 'Product not found in system' });
    }

    const product = result.rows[0];
    const today = new Date();
    const expiry = new Date(product.expiry_date);
    let status = 'valid';

    if (expiry < today) status = 'expired';
    if (product.status === 'recalled') status = 'recalled';
    if (expiry - today < 30 * 24 * 60 * 60 * 1000) status = 'near_expiry';

    // Log scan
    await query(
      `INSERT INTO scan_history (serial_number, gtin, scanned_by_gln, scan_result)
       VALUES ($1, $2, $3, $4)`,
      [serialNumber, gtin, req.user?.gln || null, status]
    );

    res.json({
      valid: status === 'valid',
      status,
      product_name: product.product_name,
      manufacturer: product.manufacturer,
      expiry_date: product.expiry_date,
      message: getStatusMessage(status)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getStatusMessage = (status) => {
  const messages = {
    valid: '✅ Authentic product',
    expired: '❌ Product expired',
    recalled: '⚠️ Product recalled',
    near_expiry: '⚠️ Expiring soon'
  };
  return messages[status];
};