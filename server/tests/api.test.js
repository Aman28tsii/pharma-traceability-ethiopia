// server/tests/api.test.js
// Integration tests against the deployed backend.
// Run with:  node --test server/tests/api.test.js
//
// Uses Node's built-in test runner and global fetch (Node 18+).
// No external dependencies required.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.API_BASE_URL || 'https://pharma-traceability-ethiopia.onrender.com';

// Credentials — these are the same seeded credentials used in manual testing.
const ADMIN_EMAIL = 'admin@pharma.com';
const ADMIN_PASSWORD = 'ChangeMeNow123!';

let authToken = null;

test('POST /api/auth/login — valid credentials returns a token', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const body = await res.json();
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    assert.ok(body.token, 'response should contain a token');
    authToken = body.token;
});

test('POST /api/auth/login — wrong password returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: 'definitely-wrong' }),
    });
    assert.equal(res.status, 401);
});

test('GET /api/products — without token returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/products`);
    assert.equal(res.status, 401);
});

test('GET /api/products — with token returns an array', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
        headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body), 'response should be an array');
});

test('GET /api/dashboard/stats — returns expected fields', async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard/stats`, {
        headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok('total_products' in body, 'missing total_products');
    assert.ok('total_batches' in body, 'missing total_batches');
    assert.ok('total_units' in body, 'missing total_units');
});

test('POST /api/verify — unknown serial returns status=invalid', async () => {
    const res = await fetch(`${BASE_URL}/api/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ gtin: '00000000000000', serial_number: 'DOESNOTEXIST' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'invalid');
});

test('GET /api/admin/audit-logs — returns an array for admin', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body), 'response should be an array');
});