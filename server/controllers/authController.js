import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pharma_secret';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, gln: user.gln }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, role: user.role, gln: user.gln } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};