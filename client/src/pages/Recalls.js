import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRecalls, createRecall, getBatches } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, AlertTriangle, Plus, CheckCircle, X } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { PageLoader } from '../components/ui/LoadingSpinner';

const Recalls = () => {
    const [recalls, setRecalls] = useState([]);
    const [batches, setBatches] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        batch_number: '',
        recall_reason: '',
        recall_level: 'Class II',
        instructions: ''
    });
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [recallsRes, batchesRes] = await Promise.all([
                getRecalls(),
                getBatches()
            ]);
            setRecalls(recallsRes.data);
            setBatches(batchesRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await createRecall(formData);
            setShowModal(false);
            setFormData({ batch_number: '', recall_reason: '', recall_level: 'Class II', instructions: '' });
            fetchData();
        } catch (error) {
            alert('Failed to initiate recall: ' + error.response?.data?.error);
        } finally {
            setSubmitting(false);
        }
    };

    const getSeverityColor = (severity) => {
        switch(severity) {
            case 'Class I': return 'bg-red-600 text-white';
            case 'Class II': return 'bg-orange-500 text-white';
            case 'Class III': return 'bg-yellow-500 text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    const getStatusBadge = (status) => {
        if (status === 'active') {
            return <span className="badge-danger">Active</span>;
        }
        return <span className="badge-success">Resolved</span>;
    };

    const canInitiateRecall = user?.role === 'admin' || user?.role === 'importer';

    if (loading) {
        return <PageLoader />;
    }

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-red-600 dark:bg-red-700 text-white p-4 flex items-center gap-3 sticky top-0 z-10">
                <button onClick={() => navigate('/dashboard')} className="p-1 hover:bg-red-700 dark:hover:bg-red-800 rounded-lg">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold flex-1">Recall Management</h1>
                {canInitiateRecall && (
                    <button 
                        onClick={() => setShowModal(true)}
                        className="bg-white dark:bg-gray-100 text-red-600 dark:text-red-700 p-2 rounded-full"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="p-4">
                {recalls.length === 0 ? (
                    <Card className="text-center py-12">
                        <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" />
                        <h3 className="font-semibold text-lg text-gray-900 dark:text-white">No Active Recalls</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">All products are currently safe</p>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {recalls.map(recall => (
                            <Card key={recall.id} className="hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                                            {recall.product_name || recall.batch_number}
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Batch: {recall.batch_number}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getSeverityColor(recall.severity)}`}>
                                        {recall.severity}
                                    </span>
                                </div>
                                
                                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reason:</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{recall.reason}</p>
                                    {recall.instructions && (
                                        <>
                                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-2">Instructions:</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">{recall.instructions}</p>
                                        </>
                                    )}
                                </div>
                                
                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
                                        {getStatusBadge(recall.status)}
                                    </div>
                                    <div className="text-gray-500 dark:text-gray-400">
                                        <span className="text-xs">Initiated: {new Date(recall.initiated_date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                
                                {recall.status === 'active' && (
                                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 border border-red-200 dark:border-red-800">
                                        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                        <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                                            URGENT: Action Required - Notify all locations
                                        </span>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Initiate Recall Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                Initiate Product Recall
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 dark:text-gray-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label">Select Batch *</label>
                                <select
                                    className="input"
                                    value={formData.batch_number}
                                    onChange={(e) => setFormData({...formData, batch_number: e.target.value})}
                                    required
                                >
                                    <option value="">-- Choose a batch --</option>
                                    {batches.map(b => (
                                        <option key={b.id} value={b.batch_number}>
                                            {b.batch_number} - {b.product_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div>
                                <label className="label">Recall Level *</label>
                                <select
                                    className="input"
                                    value={formData.recall_level}
                                    onChange={(e) => setFormData({...formData, recall_level: e.target.value})}
                                >
                                    <option value="Class I">Class I - Life-threatening / Death</option>
                                    <option value="Class II">Class II - May cause temporary health issues</option>
                                    <option value="Class III">Class III - Unlikely to cause adverse effects</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="label">Recall Reason *</label>
                                <textarea
                                    className="input"
                                    rows="4"
                                    placeholder="Detailed explanation of why this batch is being recalled..."
                                    value={formData.recall_reason}
                                    onChange={(e) => setFormData({...formData, recall_reason: e.target.value})}
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="label">Instructions for Pharmacies</label>
                                <textarea
                                    className="input"
                                    rows="3"
                                    placeholder="What should pharmacies do with this product? (Return, destroy, quarantine, etc.)"
                                    value={formData.instructions}
                                    onChange={(e) => setFormData({...formData, instructions: e.target.value})}
                                />
                            </div>
                            
                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" onClick={() => setShowModal(false)} fullWidth>
                                    Cancel
                                </Button>
                                <Button type="submit" variant="danger" loading={submitting} fullWidth>
                                    Initiate Recall
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Recalls;