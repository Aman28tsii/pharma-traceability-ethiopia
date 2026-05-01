import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, createBatch } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Package, AlertCircle, CheckCircle, X, Plus } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { PageLoader } from '../components/ui/LoadingSpinner';

const Batches = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(null);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        product_id: '',
        batch_number: '',
        expiry_date: '',
        quantity: 100
    });
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await getProducts();
            setProducts(response.data);
        } catch (error) {
            console.error('Failed to fetch products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccess(null);
        
        try {
            await createBatch(formData);
            setSuccess(`Batch ${formData.batch_number} created successfully with ${formData.quantity} serial units!`);
            setFormData({
                product_id: '',
                batch_number: '',
                expiry_date: '',
                quantity: 100
            });
            setShowModal(false);
            setTimeout(() => setSuccess(null), 5000);
        } catch (error) {
            setError(error.response?.data?.error || 'Failed to create batch');
        } finally {
            setSubmitting(false);
        }
    };

    const canCreateBatch = user?.role === 'admin' || user?.role === 'importer';

    if (loading) {
        return <PageLoader />;
    }

    if (!canCreateBatch) {
        return (
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
                <Card className="text-center max-w-md">
                    <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">Only Admins and Importers can create batches</p>
                    <Button onClick={() => navigate('/dashboard')}>Go Back</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-blue-600 dark:bg-blue-700 text-white p-4 flex items-center gap-3 sticky top-0 z-10">
                <button onClick={() => navigate('/dashboard')} className="p-1 hover:bg-blue-700 dark:hover:bg-blue-800 rounded-lg">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold flex-1">Create New Batch</h1>
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-white dark:bg-gray-100 text-blue-600 dark:text-blue-700 p-2 rounded-full"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="p-4">
                {/* Success Message */}
                {success && (
                    <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl flex items-center gap-2 border border-green-200 dark:border-green-800">
                        <CheckCircle className="w-5 h-5" />
                        {success}
                    </div>
                )}
                
                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-2 border border-red-200 dark:border-red-800">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                {/* Batches List */}
                <Card>
                    <h2 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">Recent Batches</h2>
                    <div className="space-y-3">
                        {products.length === 0 ? (
                            <div className="text-center py-8">
                                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-500 dark:text-gray-400">No batches created yet</p>
                                <Button onClick={() => setShowModal(true)} variant="primary" className="mt-4">
                                    Create First Batch
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Add your existing batches list here */}
                                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                                    Click the + button to create a new batch
                                </p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Create Batch Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 max-h-screen overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Batch</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 dark:text-gray-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label">Select Product *</label>
                                <select
                                    className="input"
                                    value={formData.product_id}
                                    onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                                    required
                                >
                                    <option value="">-- Choose a product --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.product_name} - {p.gtin}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Batch Number *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., BATCH001"
                                    value={formData.batch_number}
                                    onChange={(e) => setFormData({...formData, batch_number: e.target.value.toUpperCase()})}
                                    required
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Unique identifier for this batch</p>
                            </div>

                            <div>
                                <label className="label">Expiry Date *</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={formData.expiry_date}
                                    onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                                    required
                                />
                            </div>

                            <div>
                                <label className="label">Quantity (Number of Units) *</label>
                                <input
                                    type="number"
                                    className="input"
                                    min="1"
                                    max="10000"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})}
                                    required
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How many individual units in this batch?</p>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                                <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                    <Package className="w-4 h-4" />
                                    {formData.quantity} serial numbers will be generated automatically
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" onClick={() => setShowModal(false)} fullWidth>
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" loading={submitting} fullWidth>
                                    Create Batch
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Batches;