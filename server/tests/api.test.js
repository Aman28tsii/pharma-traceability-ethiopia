import request from 'supertest';
import { app } from '../index.js';

describe('Pharmaceutical Traceability API', () => {
    let authToken;
    
    describe('Authentication', () => {
        test('POST /api/auth/login - valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'admin@pharma.com', password: 'admin123' });
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            authToken = response.body.token;
        });
        
        test('POST /api/auth/login - invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'wrong@email.com', password: 'wrong' });
            
            expect(response.status).toBe(401);
        });
    });
    
    describe('Product Verification (Scanner)', () => {
        test('POST /api/verify - valid product', async () => {
            const response = await request(app)
                .post('/api/verify')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ 
                    gtin: '06130000010001', 
                    serial_number: '61300000010001000001' 
                });
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status');
        });
        
        test('POST /api/verify - invalid product', async () => {
            const response = await request(app)
                .post('/api/verify')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ 
                    gtin: '00000000000000', 
                    serial_number: 'invalid' 
                });
            
            expect(response.status).toBe(404);
        });
    });
    
    describe('Dashboard', () => {
        test('GET /api/dashboard/stats', async () => {
            const response = await request(app)
                .get('/api/dashboard/stats')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('total_products');
        });
    });
});