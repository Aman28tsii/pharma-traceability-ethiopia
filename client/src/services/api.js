// client/src/services/api.js - Smart API URL detection
import axios from 'axios';

// Auto-detect which API URL to use based on where the app is running
const getApiUrl = () => {
    // Check if we're in production (on Render)
    const isProduction = window.location.hostname !== 'localhost' && 
                        !window.location.hostname.includes('127.0.0.1') &&
                        !window.location.hostname.includes('192.168');
    
    if (isProduction) {
        return 'https://pharma-traceability-ethiopia.onrender.com/api';
    }
    // Development mode (localhost)
    return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiUrl();
console.log('🔗 API URL:', API_BASE_URL); // Helpful for debugging

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000,
});

// Request interceptor - Add token to all requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// ============ AUTHENTICATION APIS ============
export const login = (email, password) => {
    return api.post('/auth/login', { email, password });
};

export const register = (userData) => {
    return api.post('/auth/register', userData);
};

export const getCurrentUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
};

export const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
};

// ============ USER MANAGEMENT APIS ============
export const getUsers = () => {
    return api.get('/admin/users');
};

export const updateUser = (id, userData) => {
    return api.put(`/admin/users/${id}`, userData);
};

export const deleteUser = (id) => {
    return api.delete(`/admin/users/${id}`);
};

// ============ PRODUCT APIS ============
export const getProducts = () => {
    return api.get('/products');
};

export const getProduct = (id) => {
    return api.get(`/products/${id}`);
};

export const createProduct = (productData) => {
    return api.post('/products', productData);
};

export const updateProduct = (id, productData) => {
    return api.put(`/products/${id}`, productData);
};

export const deleteProduct = (id) => {
    return api.delete(`/products/${id}`);
};

// ============ BATCH APIS ============
export const getBatches = () => {
    return api.get('/batches');
};

export const getBatch = (batchNumber) => {
    return api.get(`/batches/${batchNumber}`);
};

export const createBatch = (batchData) => {
    return api.post('/batches', batchData);
};

// ============ VERIFICATION APIS ============
export const verifyProduct = (data) => {
    return api.post('/verify', data);
};

// ============ DASHBOARD APIS ============
export const getDashboardStats = () => {
    return api.get('/dashboard/stats');
};

export const getRecentActivity = () => {
    return api.get('/dashboard/recent-activity');
};

export const getExpiryAlerts = () => {
    return api.get('/dashboard/expiry-alerts');
};

// ============ RECALL APIS ============
export const getRecalls = () => {
    return api.get('/recalls');
};

export const createRecall = (recallData) => {
    return api.post('/recalls', recallData);
};

// ============ REPORT APIS ============
export const getEFDAReport = (params) => {
    return api.get('/reports/efda', { params });
};

export const getInventoryReport = () => {
    return api.get('/reports/inventory');
};

export default api;