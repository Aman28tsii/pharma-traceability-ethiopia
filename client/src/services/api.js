// client/src/services/api.js - Complete API Service
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
            // Token expired or invalid
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

// ============ USER MANAGEMENT APIS (Admin only) ============

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

// ============ VERIFICATION APIS (Scanner) ============

export const verifyProduct = (data) => {
    return api.post('/verify', data);
};

export const bulkVerify = (products) => {
    return api.post('/verify/bulk', products);
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

export const updateRecall = (id, recallData) => {
    return api.put(`/recalls/${id}`, recallData);
};

// ============ REPORT APIS ============

export const getEFDAReport = (params) => {
    return api.get('/reports/efda', { params });
};

export const getInventoryReport = () => {
    return api.get('/reports/inventory');
};

// ============ INVENTORY APIS ============

export const getInventory = () => {
    return api.get('/inventory');
};

export const moveInventory = (data) => {
    return api.post('/inventory/move', data);
};

// ============ HELPER FUNCTIONS ============

export const downloadReport = async (type, format = 'json', dateRange = {}) => {
    try {
        let url = '';
        if (type === 'efda') {
            url = `/reports/efda?format=${format}`;
            if (dateRange.start_date) url += `&start_date=${dateRange.start_date}`;
            if (dateRange.end_date) url += `&end_date=${dateRange.end_date}`;
        } else if (type === 'inventory') {
            url = `/reports/inventory?format=${format}`;
        }
        
        const response = await api.get(url, { responseType: 'blob' });
        
        const blob = new Blob([response.data], { 
            type: format === 'csv' ? 'text/csv' : 'application/json' 
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${type}_report_${Date.now()}.${format}`;
        link.click();
        
        return true;
    } catch (error) {
        console.error('Download failed:', error);
        throw error;
    }
};

export default api;