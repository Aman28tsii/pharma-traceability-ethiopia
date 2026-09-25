// client/src/pages/Stock.js - Phase 7: adds batch trace link
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Package, Search, RefreshCw, ArrowDownToLine, ArrowUpFromLine,
    RotateCcw, Sliders, ArrowLeftRight, X, AlertTriangle, CheckCircle,
    History, Boxes, Eye
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
    getStockSummary,
    getStockMovements,
    getBranches,
    receiveStock,
    transferStock,
    dispenseStock,
    returnStock,
    adjustStock,
} from '../services/api';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

// ---------- helpers ----------
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '-';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString() : '-';
const movementLabel = {
    initial: 'Initial',
    receive: 'Receive',
    dispense: 'Dispense',
    transfer_in: 'Transfer In',
    transfer_out: 'Transfer Out',
    return_supplier: 'Return',
    adjustment: 'Adjust',
    recall: 'Recall',
};
const movementColor = {
    initial: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    receive: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    dispense: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    transfer_in: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    transfer_out: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    return_supplier: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    adjustment: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    recall: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

// ---------- status pill ----------
const BatchStatus = ({ batch }) => {
    if (batch.is_recalled) return <Badge variant="danger">Recalled</Badge>;
    if (batch.status === 'expired') return <Badge variant="warning">Expired</Badge>;
    if (batch.on_hand_quantity === 0) return <Badge variant="default">Empty</Badge>;
    return <Badge variant="success">Active</Badge>;
};

// ---------- inline banner ----------
const Banner = ({ type, message, onClose }) => {
    if (!message) return null;
    const styles = type === 'success'
        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
        : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800';
    const Icon = type === 'success' ? CheckCircle : AlertTriangle;
    return (
        <div className={`mb-3 p-3 rounded-xl border flex items-start gap-2 ${styles}`}>
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">{message}</div>
            {onClose && (
                <button onClick={onClose} className="shrink-0">
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

// ---------- action modal ----------
const ActionModal = ({ action, batch, branches, onClose, onSuccess }) => {
    const [form, setForm] = useState(() => ({
        quantity: '',
        quantity_delta: '',
        to_organization_id: '',
        counterparty: '',
        notes: '',
        reason: '',
        serial_number: '',
    }));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [confirmed, setConfirmed] = useState(false);

    const isDestructive = ['dispense', 'return', 'adjust', 'transfer'].includes(action);

    const title = {
        receive: 'Receive Stock',
        dispense: 'Dispense / Sell',
        return: 'Return to Supplier',
        adjust: 'Adjust Stock',
        transfer: 'Transfer Stock',
    }[action];

    const submit = async (e) => {
        e.preventDefault();
        setError('');

        const base = { batch_id: batch.batch_id, notes: form.notes || undefined };

        let payload;
        if (action === 'receive') {
            const q = parseInt(form.quantity);
            if (!q || q <= 0) return setError('Quantity must be a positive whole number.');
            payload = { ...base, quantity: q, counterparty: form.counterparty || undefined };
        } else if (action === 'dispense') {
            const q = parseInt(form.quantity);
            if (!q || q <= 0) return setError('Quantity must be a positive whole number.');
            if (q > batch.on_hand_quantity) return setError(`Only ${batch.on_hand_quantity} units available.`);
            payload = { ...base, quantity: q, counterparty: form.counterparty || undefined, serial_number: form.serial_number || undefined };
        } else if (action === 'return') {
            const q = parseInt(form.quantity);
            if (!q || q <= 0) return setError('Quantity must be a positive whole number.');
            if (q > batch.on_hand_quantity) return setError(`Only ${batch.on_hand_quantity} units available.`);
            payload = { ...base, quantity: q, counterparty: form.counterparty || undefined };
        } else if (action === 'adjust') {
            const d = parseInt(form.quantity_delta);
            if (!Number.isFinite(d) || d === 0) return setError('Adjustment must be a non-zero whole number.');
            if (batch.on_hand_quantity + d < 0) return setError('Adjustment would drive stock below zero.');
            payload = { ...base, quantity_delta: d, reason: form.reason || undefined };
        } else if (action === 'transfer') {
            const q = parseInt(form.quantity);
            if (!q || q <= 0) return setError('Quantity must be a positive whole number.');
            if (q > batch.on_hand_quantity) return setError(`Only ${batch.on_hand_quantity} units available.`);
            if (!form.to_organization_id) return setError('Please select a destination branch.');
            payload = { ...base, quantity: q, to_organization_id: parseInt(form.to_organization_id) };
        }

        if (isDestructive && !confirmed) {
            return setError('Please confirm this operation before submitting.');
        }

        setSubmitting(true);
        try {
            const fn = {
                receive: receiveStock,
                dispense: dispenseStock,
                return: returnStock,
                adjust: adjustStock,
                transfer: transferStock,
            }[action];
            await fn(payload);
            onSuccess(`${title} completed.`);
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Operation failed';
            const available = err.response?.data?.available;
            setError(available !== undefined ? `${msg} (available: ${available})` : msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400" disabled={submitting}>
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg mb-4">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {batch.product_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Batch {batch.batch_number} - Expires {fmtDate(batch.expiry_date)}
                    </p>
                    <p className="text-sm mt-2 text-gray-700 dark:text-gray-300">
                        Current on-hand: <span className="font-bold">{batch.on_hand_quantity}</span>
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-3">
                    {(action === 'receive' || action === 'dispense' || action === 'return' || action === 'transfer') && (
                        <div>
                            <label className="label">Quantity *</label>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                className="input"
                                value={form.quantity}
                                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                                required
                                disabled={submitting}
                            />
                        </div>
                    )}

                    {action === 'adjust' && (
                        <div>
                            <label className="label">Adjustment (positive or negative) *</label>
                            <input
                                type="number"
                                step="1"
                                className="input"
                                placeholder="e.g. -5 for damage, +3 for found stock"
                                value={form.quantity_delta}
                                onChange={(e) => setForm({ ...form, quantity_delta: e.target.value })}
                                required
                                disabled={submitting}
                            />
                        </div>
                    )}

                    {action === 'transfer' && (
                        <div>
                            <label className="label">Destination Branch *</label>
                            <select
                                className="input"
                                value={form.to_organization_id}
                                onChange={(e) => setForm({ ...form, to_organization_id: e.target.value })}
                                required
                                disabled={submitting}
                            >
                                <option value="">-- Select a branch --</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {action === 'dispense' && (
                        <div>
                            <label className="label">Serial Number (optional)</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Leave blank for batch-only dispense"
                                value={form.serial_number}
                                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                                disabled={submitting}
                            />
                        </div>
                    )}

                    {(action === 'receive' || action === 'dispense' || action === 'return') && (
                        <div>
                            <label className="label">
                                {action === 'dispense' ? 'Patient / Reference' : 'Supplier / Counterparty'} (optional)
                            </label>
                            <input
                                type="text"
                                className="input"
                                value={form.counterparty}
                                onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
                                disabled={submitting}
                            />
                        </div>
                    )}

                    {action === 'adjust' && (
                        <div>
                            <label className="label">Reason (optional)</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="damage / loss / correction"
                                value={form.reason}
                                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                disabled={submitting}
                            />
                        </div>
                    )}

                    <div>
                        <label className="label">Notes (optional)</label>
                        <input
                            type="text"
                            className="input"
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            disabled={submitting}
                        />
                    </div>

                    {isDestructive && (
                        <label className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg cursor-pointer">
                            <input
                                type="checkbox"
                                checked={confirmed}
                                onChange={(e) => setConfirmed(e.target.checked)}
                                className="mt-1"
                                disabled={submitting}
                            />
                            <span className="text-xs text-amber-800 dark:text-amber-300">
                                I confirm this action. It will be permanently recorded in the audit log.
                            </span>
                        </label>
                    )}

                    <Banner type="error" message={error} />

                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" fullWidth onClick={onClose} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" fullWidth loading={submitting}>
                            Submit
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ---------- main page ----------
const Stock = () => {
    const { user } = useAuth();
    const [tab, setTab] = useState('summary');
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');

    const [selectedBatch, setSelectedBatch] = useState(null);
    const [action, setAction] = useState(null);
    const [branches, setBranches] = useState([]);

    const [movements, setMovements] = useState([]);
    const [movementsLoading, setMovementsLoading] = useState(false);
    const [movementFilters, setMovementFilters] = useState({ movement_type: '', batch_id: '' });

    const canMutate = useMemo(() => ['admin', 'importer', 'distributor', 'pharmacy'].includes(user?.role), [user]);
    const canTransfer = useMemo(() => ['admin', 'importer', 'distributor'].includes(user?.role), [user]);
    const canReceiveOrReturnOrAdjust = useMemo(() => ['admin', 'importer'].includes(user?.role), [user]);
    const canDispense = useMemo(() => ['admin', 'pharmacy'].includes(user?.role), [user]);

    const loadSummary = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getStockSummary();
            setSummary(res.data);
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to load stock summary');
        } finally {
            setLoading(false);
        }
    };

    const loadBranches = async () => {
        if (!canTransfer) return;
        try {
            const res = await getBranches();
            setBranches(res.data);
        } catch (err) {
            setBranches([]);
        }
    };

    const loadMovements = async () => {
        setMovementsLoading(true);
        try {
            const params = {};
            if (movementFilters.movement_type) params.movement_type = movementFilters.movement_type;
            if (movementFilters.batch_id) params.batch_id = movementFilters.batch_id;
            const res = await getStockMovements(params);
            setMovements(res.data);
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to load movements');
        } finally {
            setMovementsLoading(false);
        }
    };

    useEffect(() => {
        loadSummary();
        loadBranches();
    }, []);

    useEffect(() => {
        if (tab === 'movements') loadMovements();
    }, [tab, movementFilters]);

    useEffect(() => {
        if (!success) return;
        const t = setTimeout(() => setSuccess(''), 4000);
        return () => clearTimeout(t);
    }, [success]);

    const filteredBatches = useMemo(() => {
        if (!summary?.batches) return [];
        const s = search.trim().toLowerCase();
        if (!s) return summary.batches;
        return summary.batches.filter(b =>
            b.product_name?.toLowerCase().includes(s) ||
            b.batch_number?.toLowerCase().includes(s) ||
            b.gtin?.includes(s)
        );
    }, [summary, search]);

    const openAction = (batch, kind) => {
        setSelectedBatch(batch);
        setAction(kind);
    };

    const closeAction = () => {
        setSelectedBatch(null);
        setAction(null);
    };

    const handleSuccess = (msg) => {
        setSuccess(msg);
        closeAction();
        loadSummary();
        if (tab === 'movements') loadMovements();
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Boxes className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        Stock / Inventory
                    </h1>
                    {summary?.branch && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Branch: <span className="font-medium text-gray-700 dark:text-gray-300">{summary.branch.name}</span>
                        </p>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setTab('summary')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'summary'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                    >
                        Summary
                    </button>
                    <button
                        onClick={() => setTab('movements')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 ${tab === 'movements'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                    >
                        <History className="w-4 h-4" /> Movements
                    </button>
                </div>
            </div>

            <Banner type="success" message={success} onClose={() => setSuccess('')} />
            <Banner type="error" message={error} onClose={() => setError('')} />

            {/* Summary tab */}
            {tab === 'summary' && (
                <>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search product, batch, or GTIN..."
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2 pl-10 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={loadSummary} icon={RefreshCw}>
                            Refresh
                        </Button>
                    </div>

                    {loading ? (
                        <PageLoader />
                    ) : filteredBatches.length === 0 ? (
                        <EmptyState title="No batches" description={search ? 'No batches match your search.' : 'No stock in this branch.'} />
                    ) : (
                        <Card padding={false} className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Product</th>
                                        <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Batch</th>
                                        <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Expiry</th>
                                        <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Status</th>
                                        <th className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">On hand</th>
                                        <th className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBatches.map((b) => (
                                        <tr key={b.batch_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-gray-900 dark:text-white">{b.product_name}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{b.gtin}</div>
                                            </td>
                                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{b.batch_number}</td>
                                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{fmtDate(b.expiry_date)}</td>
                                            <td className="py-3 px-4"><BatchStatus batch={b} /></td>
                                            <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">{b.on_hand_quantity}</td>
                                            <td className="py-3 px-4">
                                                <div className="flex gap-1 justify-end flex-wrap">
                                                    <Link
                                                        to={`/trace/batch/${encodeURIComponent(b.batch_number)}`}
                                                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                                        title="View full trace history"
                                                    >
                                                        <History className="w-4 h-4" />
                                                    </Link>
                                                    {canReceiveOrReturnOrAdjust && (
                                                        <button
                                                            onClick={() => openAction(b, 'receive')}
                                                            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                                                            title="Receive"
                                                            disabled={b.is_recalled}
                                                        >
                                                            <ArrowDownToLine className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {canDispense && (
                                                        <button
                                                            onClick={() => openAction(b, 'dispense')}
                                                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg disabled:opacity-30"
                                                            title="Dispense"
                                                            disabled={b.is_recalled || b.on_hand_quantity === 0}
                                                        >
                                                            <ArrowUpFromLine className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {canReceiveOrReturnOrAdjust && (
                                                        <>
                                                            <button
                                                                onClick={() => openAction(b, 'return')}
                                                                className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg disabled:opacity-30"
                                                                title="Return to supplier"
                                                                disabled={b.is_recalled || b.on_hand_quantity === 0}
                                                            >
                                                                <RotateCcw className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => openAction(b, 'adjust')}
                                                                className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                                                                title="Adjust"
                                                                disabled={b.is_recalled}
                                                            >
                                                                <Sliders className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {canTransfer && (
                                                        <button
                                                            onClick={() => openAction(b, 'transfer')}
                                                            className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg disabled:opacity-30"
                                                            title="Transfer to another branch"
                                                            disabled={b.is_recalled || b.on_hand_quantity === 0}
                                                        >
                                                            <ArrowLeftRight className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {!canMutate && (
                                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                                            <Eye className="w-3 h-3" /> Read only
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    )}
                </>
            )}

            {/* Movements tab */}
            {tab === 'movements' && (
                <>
                    <Card>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="label text-xs">Movement type</label>
                                <select
                                    className="input text-sm"
                                    value={movementFilters.movement_type}
                                    onChange={(e) => setMovementFilters({ ...movementFilters, movement_type: e.target.value })}
                                >
                                    <option value="">All</option>
                                    <option value="initial">Initial</option>
                                    <option value="receive">Receive</option>
                                    <option value="dispense">Dispense</option>
                                    <option value="transfer_in">Transfer In</option>
                                    <option value="transfer_out">Transfer Out</option>
                                    <option value="return_supplier">Return</option>
                                    <option value="adjustment">Adjust</option>
                                    <option value="recall">Recall</option>
                                </select>
                            </div>
                            <div>
                                <label className="label text-xs">Batch ID</label>
                                <input
                                    type="number"
                                    className="input text-sm"
                                    placeholder="e.g. 1"
                                    value={movementFilters.batch_id}
                                    onChange={(e) => setMovementFilters({ ...movementFilters, batch_id: e.target.value })}
                                />
                            </div>
                            <div className="flex items-end">
                                <Button variant="outline" size="sm" onClick={loadMovements} icon={RefreshCw}>
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    </Card>

                    {movementsLoading ? (
                        <PageLoader />
                    ) : movements.length === 0 ? (
                        <EmptyState title="No movements" description="No stock movements match these filters." />
                    ) : (
                        <Card padding={false} className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Time</th>
                                        <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Type</th>
                                        <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Batch</th>
                                        <th className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">Qty</th>
                                        <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">Reference</th>
                                        <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-400">By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map((m) => (
                                        <tr key={m.id} className="border-b border-gray-100 dark:border-gray-800">
                                            <td className="py-2 px-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                                {fmtDateTime(m.created_at)}
                                            </td>
                                            <td className="py-2 px-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${movementColor[m.movement_type] || ''}`}>
                                                    {movementLabel[m.movement_type] || m.movement_type}
                                                </span>
                                            </td>
                                            <td className="py-2 px-4 text-gray-700 dark:text-gray-300">{m.batch_number}</td>
                                            <td className={`py-2 px-4 text-right font-medium ${m.quantity_delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {m.quantity_delta >= 0 ? '+' : ''}{m.quantity_delta}
                                            </td>
                                            <td className="py-2 px-4 text-xs text-gray-500 dark:text-gray-400">
                                                {m.counterparty || m.reference_type || '-'}
                                                {m.notes && <div className="text-gray-400 italic">{m.notes}</div>}
                                            </td>
                                            <td className="py-2 px-4 text-xs text-gray-500 dark:text-gray-400">
                                                {m.performed_by_name || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    )}
                </>
            )}

            {/* Action modal */}
            {action && selectedBatch && (
                <ActionModal
                    action={action}
                    batch={selectedBatch}
                    branches={branches}
                    onClose={closeAction}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
};

export default Stock;
