import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, createBatch, getBatches } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Package, AlertCircle, CheckCircle, X, Plus, RefreshCw } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/LoadingSpinner';

const fmtDate = (d) => {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleDateString();
    } catch {
        return String(d);
    }
};

const statusBadgeVariant = (batch) => {
    if (batch.is_recalled) return 'danger';
    if (batch.status === 'expired') return 'warning';
    if (Number(batch.on_hand_quantity) === 0) return 'default';
    return 'success';
};

const statusLabel = (batch) => {
    if (batch.is_recalled) return 'Recalled';
    if (batch.status === 'expired') return 'Expired';
    if (Number(batch.on_hand_quantity) === 0) return 'Empty';
    return 'Active';
};

const emptyForm = {
    product_id: '',
    batch_number: '',
    expiry_date: '',
    quantity: 100,
    serialization: 'none',
    serialsText: '',
};

const Batches = () => {
    const [products, setProducts] = useState([]);
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [batchesLoading, setBatchesLoading] = useState(false);
    const [batchesError, setBatchesError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(null);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState(emptyForm);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        fetchProducts();
        fetchBatches();
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

    const fetchBatches = async () => {
        setBatchesLoading(true);
        setBatchesError(null);
        try {
            const response = await getBatches();
            setBatches(response.data || []);
        } catch (err) {
            console.error('Failed to fetch batches:', err);
            setBatchesError('Failed to load batches.');
        } finally {
            setBatchesLoading(false);
        }
    };

    const parsedSerials = () => {
        if (formData.serialization !== 'supplied') return [];
        return formData.serialsText
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const payload = {
                product_id: formData.product_id,
                batch_number: formData.batch_number,
                expiry_date: formData.expiry_date,
                quantity: formData.quantity,
                serialization: formData.serialization,
            };

            if (formData.serialization === 'supplied') {
                const list = parsedSerials();
                if (list.length !== Number(formData.quantity)) {
                    setError(`Expected ${formData.quantity} serials, got ${list.length}.`);
                    setSubmitting(false);
                    return;
                }
                const seen = new Set();
                for (const s of list) {
                    if (seen.has(s)) {
                        setError(`Duplicate serial: ${s}`);
                        setSubmitting(false);
                        return;
                    }
                    seen.add(s);
                }
                payload.serials = list;
            }

            const res = await createBatch(payload);
            const count = res?.data?.serial_units_count ?? 0;
            const mode = res?.data?.serialization ?? formData.serialization;
            setSuccess(
                mode === 'none'
                    ? `Batch ${formData.batch_number} created (non-serialized, qty ${formData.quantity}).`
                    : `Batch ${formData.batch_number} created with ${count} serial units.`
            );
            setFormData(emptyForm);
            setShowModal(false);
            setTimeout(() => setSuccess(null), 5000);
            fetchBatches();
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
                <h1 className="text-xl font-bold flex-1">Batches</h1>
                <button
                    onClick={fetchBatches}
                    className="p-2 hover:bg-blue-700 dark:hover:bg-blue-800 rounded-lg"
                    title="Refresh batches"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
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

                    {batchesLoading ? (
                        <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600" />
                        </div>
                    ) : batchesError ? (
                        <div className="text-center py-8">
                            <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto mb-3" />
                            <p className="text-red-600 dark:text-red-400">{batchesError}</p>
                            <Button onClick={fetchBatches} variant="outline" className="mt-4">
                                Try Again
                            </Button>
                        </div>
                    ) : batches.length === 0 ? (
                        <div className="text-center py-8">
                            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">No batches created yet</p>
                            <Button onClick={() => setShowModal(true)} variant="primary" className="mt-4">
                                Create First Batch
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-gray-200 dark:border-gray-700">
                                        <tr>
                                            <th className="text-left py-3 px-3 text-gray-600 dark:text-gray-400 font-medium">Batch Number</th>
                                            <th className="text-left py-3 px-3 text-gray-600 dark:text-gray-400 font-medium">Product</th>
                                            <th className="text-left py-3 px-3 text-gray-600 dark:text-gray-400 font-medium">Expiry</th>
                                            <th className="text-right py-3 px-3 text-gray-600 dark:text-gray-400 font-medium">On Hand</th>
                                            <th className="text-right py-3 px-3 text-gray-600 dark:text-gray-400 font-medium">Serialized</th>
                                            <th className="text-left py-3 px-3 text-gray-600 dark:text-gray-400 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batches.map((b) => (
                                            <tr key={b.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                <td className="py-3 px-3 font-mono text-gray-900 dark:text-white">{b.batch_number}</td>
                                                <td className="py-3 px-3">
                                                    <div className="text-gray-900 dark:text-white">{b.product_name || '—'}</div>
                                                    {b.gtin && <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{b.gtin}</div>}
                                                </td>
                                                <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{fmtDate(b.expiry_date)}</td>
                                                <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">{b.on_hand_quantity}</td>
                                                <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300">{b.serialized_count ?? 0}</td>
                                                <td className="py-3 px-3">
                                                    <Badge variant={statusBadgeVariant(b)}>{statusLabel(b)}</Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile card list */}
                            <div className="md:hidden space-y-3">
                                {batches.map((b) => (
                                    <div key={b.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="font-mono font-semibold text-gray-900 dark:text-white break-all">
                                                {b.batch_number}
                                            </div>
                                            <Badge variant={statusBadgeVariant(b)}>{statusLabel(b)}</Badge>
                                        </div>
                                        <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                                            {b.product_name || '—'}
                                        </div>
                                        {b.gtin && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 break-all">
                                                {b.gtin}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-600 dark:text-gray-400">
                                            <div>
                                                <div className="uppercase tracking-wide">Expiry</div>
                                                <div className="text-gray-900 dark:text-white">{fmtDate(b.expiry_date)}</div>
                                            </div>
                                            <div>
                                                <div className="uppercase tracking-wide">On Hand</div>
                                                <div className="text-gray-900 dark:text-white font-semibold">{b.on_hand_quantity}</div>
                                            </div>
                                            <div>
                                                <div className="uppercase tracking-wide">Serialized</div>
                                                <div className="text-gray-900 dark:text-white">{b.serialized_count ?? 0}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </Card>
            </div>

            {/* Create Batch Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 max-h-screen overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Batch</h2>
                            <button onClick={() => { setShowModal(false); setFormData(emptyForm); }} className="text-gray-500 dark:text-gray-400">
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
                                    onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                                    required
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How many individual units in this batch?</p>
                            </div>

                            <div>
                                <label className="label">Serialization *</label>
                                <select
                                    className="input"
                                    value={formData.serialization}
                                    onChange={(e) => setFormData({...formData, serialization: e.target.value, serialsText: ''})}
                                >
                                    <option value="none">Non-serialized (batch + quantity tracking)</option>
                                    <option value="supplied">Serialized (provide individual serial numbers)</option>
                                </select>
                            </div>

                            {formData.serialization === 'supplied' && (
                                <div>
                                    <label className="label">Serial numbers (one per line) *</label>
                                    <textarea
                                        className="input font-mono text-sm"
                                        rows="6"
                                        placeholder={`Paste ${formData.quantity} serials, one per line`}
                                        value={formData.serialsText}
                                        onChange={(e) => setFormData({...formData, serialsText: e.target.value})}
                                        required
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Expected: {formData.quantity} serials. Provided: {parsedSerials().length}.
                                    </p>
                                </div>
                            )}

                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                                <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                    <Package className="w-4 h-4" />
                                    {formData.serialization === 'none'
                                        ? `Batch will be tracked by quantity only (${formData.quantity} units, no serials).`
                                        : `Batch will include ${formData.quantity} individual serialized units.`}
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setShowModal(false); setFormData(emptyForm); }} fullWidth>
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