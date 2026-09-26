// reset-platform-password.js
// Run from repo root:  node reset-platform-password.js
// Generates a bcrypt hash for the platform account password and prints SQL.
// Does NOT connect to the database. Does NOT modify anything.

import bcrypt from 'bcryptjs';

const EMAIL = 'platform@pharma.com';
const NEW_PASSWORD = 'PlatformTest123!';

const hash = await bcrypt.hash(NEW_PASSWORD, 10);

console.log('---');
console.log('Email:    ', EMAIL);
console.log('Password: ', NEW_PASSWORD);
console.log('Hash:     ', hash);
console.log('Hash len: ', hash.length);
console.log('Prefix:   ', hash.slice(0, 7));
console.log('---');
console.log('SQL to paste into Neon SQL editor:');
console.log('');
console.log("UPDATE users SET password = '" + hash + "' WHERE email = '" + EMAIL + "';");
console.log('');
console.log('Then verify with:');
console.log("SELECT id, email, role, is_active, length(password) AS pwd_len, left(password, 7) AS pwd_prefix FROM users WHERE email = '" + EMAIL + "';");
console.log('---');
