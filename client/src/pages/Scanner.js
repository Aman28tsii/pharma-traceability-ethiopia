// client/src/pages/Scanner.js
// Phase 13A: Manual pharmaceutical verification UI.
// Uses the existing verifyProduct() service and the existing /api/verify backend.
// Camera scanning (13B) is not implemented here.

import React, { useState } from 'react';
import { Scan, Search, X, CheckCircle, AlertTriangle, XCircle, HelpCircle, Package, Boxes } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { verifyProduct } from '../services/api';

const STATUS_META = {
    valid: {
        label: 'VALID',
        variant: 'success',
        Icon: CheckCircle,
        tone: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    },
    warning: {
        label: 'EXPIRING SOON',
        variant: 'warning',
        Icon: AlertTriangle,
        tone: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    },
    expired: {
        label: 'EXPIRED',
        variant: 'danger',
        Icon: XCircle,
        tone: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    },
    recalled: {
        label: 'RECALLED',
        variant: 'danger',
        Icon: XCircle,
        tone: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    },
    invalid: {
        label: 'INVALID / NOT FOUND',
        variant: 'default',
        Icon: HelpCircle,
        tone: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200',
    },
};

const fmtDate = (d) => {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleDateString();
    } catch {
        return String(d);
    }
};

const ResultField = ({ label, value }) => (
    <div>
        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-sm font-medium text-gray-900 dark:text-white break-words">{value || '—'}</div>
    </div>
);

const Scanner = () => {
    const [gtin, setGtin] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const reset = () => {
        setGtin('');
        setSerialNumber('');
        setResult(null);
        setError('');
        setLoading(false);
    };

    const handleVerify = async (e) => {
        if (e) e.preventDefault();
        setError('');
        setResult(null);

        const trimmedGtin = gtin.trim();
        const trimmedSerial = serialNumber.trim();

        if (!trimmedGtin) {
            setError('GTIN is required.');
            return;
        }
        if (!/^\d{14}$/.test(trimmedGtin)) {
            setError('GTIN must be exactly 14 digits.');
            return;
        }
        if (!trimmedSerial) {
            setError('Serial number is required.');
            return;
        }

        setLoading(true);
        try {
            const res = await verifyProduct({ gtin: trimmedGtin, serial_number: trimmedSerial });
            setResult(res.data);
        } catch (err) {
            const status = err?.response?.status;
            const bodyError = err?.response?.data?.error;
            if (status === 401 || status === 403) {
                setError('Your session has expired or you are not authorized. Please log in again.');
            } else if (status === 400) {
                setError(bodyError || 'The server rejected the request. Check the GTIN and serial number.');
            } else if (status >= 500) {
                setError('The server encountered an error. Please try again in a moment.');
            } else if (err?.message) {
                setError('Network error. Please check your connection and try again.');
            } else {
                setError('Verification failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const meta = result ? (STATUS_META[result.status] || STATUS_META.invalid) : null;
    const StatusIcon = meta?.Icon;
    const product = result?.product;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Scan className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    Verify Product
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Enter the GTIN and serial number to verify a pharmaceutical product.
                </p>
            </div>

            {/* Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        Manual Verification
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleVerify} className="space-y-4">
                        <div>
                            <label className="label" htmlFor="gtin">GTIN (14 digits)</label>
                            <input
                                id="gtin"
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                className="input text-base py-3"
                                placeholder="06130000010001"
                                maxLength={14}
                                value={gtin}
                                onChange={(e) => setGtin(e.target.value.replace(/\D/g, ''))}
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="label" htmlFor="serial">Serial Number</label>
                            <input
                                id="serial"
                                type="text"
                                autoComplete="off"
                                className="input text-base py-3"
                                placeholder="e.g. P11BSER0000001"
                                value={serialNumber}
                                onChange={(e) => setSerialNumber(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                <div className="text-sm flex-1">{error}</div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-1">
                            <Button
                                type="submit"
                                variant="primary"
                                fullWidth
                                loading={loading}
                                icon={Search}
                            >
                                {loading ? 'Verifying...' : 'Verify'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={reset}
                                disabled={loading}
                                icon={X}
                            >
                                Clear
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Result */}
            {result && meta && (
                <Card>
                    <div className={`rounded-xl border p-4 ${meta.tone}`}>
                        <div className="flex items-center gap-3">
                            <StatusIcon className="w-7 h-7 shrink-0" />
                            <div className="flex-1">
                                <div className="text-lg font-bold">{meta.label}</div>
                                {result.message && (
                                    <div className="text-sm mt-0.5">{result.message}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {product ? (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <ResultField label="Product Name" value={product.name} />
                            <ResultField label="GTIN" value={product.gtin} />
                            <ResultField label="Serial Number" value={product.serial_number} />
                            <ResultField label="Batch Number" value={product.batch} />
                            <ResultField label="Manufacturer" value={product.manufacturer} />
                            <ResultField label="Strength" value={product.strength} />
                            <ResultField label="Expiry Date" value={fmtDate(product.expiry_date)} />
                            <ResultField
                                label="Days to Expiry"
                                value={
                                    typeof product.days_left === 'number'
                                        ? `${product.days_left} day${product.days_left === 1 ? '' : 's'}`
                                        : '—'
                                }
                            />
                            <ResultField label="Unit Status" value={product.current_status} />
                        </div>
                    ) : (
                        <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
                            No product record was returned. This serial and GTIN pair is not registered in
                            your branch. If you believe this is an error, check the numbers and try again.
                        </div>
                    )}
                </Card>
            )}

            {/* Informational card */}
            {!result && !error && (
                <Card>
                    <CardContent>
                        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                            <Boxes className="w-4 h-4 mt-0.5 shrink-0" />
                            Camera scanning is not yet available. For now, verification is performed by
                            typing the GTIN and serial number exactly as printed on the packaging.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default Scanner;