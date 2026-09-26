// client/src/pages/Scanner.js
// Phase 13A: Manual pharmaceutical verification UI.
// Phase 13B: Camera/DataMatrix scanning (decode-to-fields, no auto-verify).

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Scan, Search, X, CheckCircle, AlertTriangle, XCircle, HelpCircle, Boxes,
    Camera, CameraOff,
} from 'lucide-react';
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/library';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { verifyProduct } from '../services/api';
import { parseGS1 } from '../utils/gs1Parser';

const STATUS_META = {
    valid: { label: 'VALID', Icon: CheckCircle, tone: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200' },
    warning: { label: 'EXPIRING SOON', Icon: AlertTriangle, tone: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200' },
    expired: { label: 'EXPIRED', Icon: XCircle, tone: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200' },
    recalled: { label: 'RECALLED', Icon: XCircle, tone: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200' },
    invalid: { label: 'INVALID / NOT FOUND', Icon: HelpCircle, tone: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200' },
};

const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString(); } catch { return String(d); }
};

const ResultField = ({ label, value }) => (
    <div>
        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-sm font-medium text-gray-900 dark:text-white break-words">{value || '—'}</div>
    </div>
);

const Scanner = () => {
    // ---- manual verification state (unchanged) ----
    const [gtin, setGtin] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    // ---- camera state (new) ----
    const [cameraOn, setCameraOn] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [scanStatus, setScanStatus] = useState('');
    const [decoded, setDecoded] = useState(null);
    const codeReaderRef = useRef(null);
    const videoRef = useRef(null);
    const decodedOnceRef = useRef(false);

    const reset = () => {
        setGtin('');
        setSerialNumber('');
        setResult(null);
        setError('');
        setLoading(false);
    };

    const handleVerify = async () => {
        setError('');
        setResult(null);

        const trimmedGtin = gtin.trim();
        const trimmedSerial = serialNumber.trim();

        if (!trimmedGtin) { setError('GTIN is required.'); return; }
        if (!/^\d{14}$/.test(trimmedGtin)) { setError('GTIN must be exactly 14 digits.'); return; }
        if (!trimmedSerial) { setError('Serial number is required.'); return; }

        setLoading(true);
        try {
            const res = await verifyProduct({ gtin: trimmedGtin, serial_number: trimmedSerial });
            setResult(res.data);
        } catch (err) {
            const status = err?.response?.status;
            const bodyError = err?.response?.data?.error;
            if (status === 401 || status === 403) setError('Session expired or not authorized. Please log in again.');
            else if (status === 400) setError(bodyError || 'The server rejected the request.');
            else if (status >= 500) setError('Server error. Please try again in a moment.');
            else setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const stopCamera = useCallback(() => {
        try {
            if (codeReaderRef.current) {
                codeReaderRef.current.reset();
            }
        } catch (e) {
            // ignore
        }
        codeReaderRef.current = null;
        if (videoRef.current && videoRef.current.srcObject) {
            try {
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach((t) => t.stop());
            } catch (e) {
                // ignore
            }
            videoRef.current.srcObject = null;
        }
        setCameraOn(false);
    }, []);

    const handleDecoded = useCallback((text) => {
        if (decodedOnceRef.current) return;
        const parsed = parseGS1(text);
        if (!parsed.ok) {
            // Do not spam: only report once per frame; keep camera running
            // so the user can reposition the code.
            setScanStatus(`Could not parse code (${parsed.reason}). Reposition and try again.`);
            return;
        }
        decodedOnceRef.current = true;
        setDecoded(parsed);
        setScanStatus('Code captured.');
        if (parsed.gtin) setGtin(parsed.gtin);
        if (parsed.serial) setSerialNumber(parsed.serial);
        stopCamera();
    }, [stopCamera]);

    const startCamera = useCallback(async () => {
        setCameraError('');
        setScanStatus('');
        setDecoded(null);
        decodedOnceRef.current = false;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError('Camera is not supported in this browser.');
            return;
        }

        let deviceId = null;
        try {
            const devices = await BrowserCodeReader.listVideoInputDevices();
            if (devices && devices.length > 0) {
                // Prefer environment-facing on mobile
                const env = devices.find((d) =>
                    (d.label || '').toLowerCase().includes('back') ||
                    (d.label || '').toLowerCase().includes('environment') ||
                    (d.label || '').toLowerCase().includes('rear')
                );
                deviceId = (env || devices[0]).deviceId;
            }
        } catch (e) {
            // enumeration can fail silently; fall through to default device
        }

        try {
            const reader = new BrowserMultiFormatReader();
            codeReaderRef.current = reader;
            setCameraOn(true);
            setScanStatus('Point the camera at a GS1 DataMatrix code.');

            // decodeFromVideoDevice handles getUserMedia + attach to <video>.
            await reader.decodeFromVideoDevice(
                deviceId,
                videoRef.current,
                (res, err) => {
                    if (res) {
                        handleDecoded(res.getText());
                    }
                    // err is normal on every frame without a code; do nothing.
                }
            );
        } catch (e) {
            const name = e?.name || '';
            if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
                setCameraError('Camera permission denied. Enable camera access and try again.');
            } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
                setCameraError('No camera was found on this device.');
            } else if (name === 'NotReadableError' || name === 'TrackStartError') {
                setCameraError('Camera is in use by another app or tab.');
            } else {
                setCameraError('Camera failed to start.');
            }
            setCameraOn(false);
            setScanStatus('');
            try { codeReaderRef.current?.reset(); } catch (e2) { /* ignore */ }
            codeReaderRef.current = null;
        }
    }, [handleDecoded]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    const meta = result ? (STATUS_META[result.status] || STATUS_META.invalid) : null;
    const StatusIcon = meta?.Icon;
    const product = result?.product;

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Scan className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    Verify Product
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Scan a GS1 DataMatrix code or enter the GTIN and serial number manually.
                </p>
            </div>

            {/* ---- Camera card ---- */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Camera className="w-5 h-5" />
                        Scan DataMatrix
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex gap-3 flex-wrap">
                        <Button
                            type="button"
                            variant="primary"
                            icon={Camera}
                            onClick={startCamera}
                            disabled={cameraOn || loading}
                        >
                            Start Camera
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            icon={CameraOff}
                            onClick={stopCamera}
                            disabled={!cameraOn}
                        >
                            Stop Camera
                        </Button>
                    </div>

                    {cameraError && (
                        <div className="p-3 rounded-xl border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div className="text-sm flex-1">{cameraError}</div>
                        </div>
                    )}

                    <div className={`relative w-full rounded-xl overflow-hidden bg-black ${cameraOn ? 'block' : 'hidden'}`}>
                        <video
                            ref={videoRef}
                            className="w-full h-64 sm:h-80 object-cover"
                            playsInline
                            muted
                            autoPlay
                        />
                    </div>

                    {scanStatus && (
                        <div className="text-sm text-gray-700 dark:text-gray-300">{scanStatus}</div>
                    )}

                    {decoded && (
                        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                                Decoded GS1 data
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                <ResultField label="GTIN" value={decoded.gtin} />
                                <ResultField label="Batch" value={decoded.batch} />
                                <ResultField label="Expiry" value={decoded.expiryISO ? fmtDate(decoded.expiryISO) : ''} />
                                <ResultField label="Serial" value={decoded.serial} />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Review the values and press Verify below.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ---- Manual verification card (unchanged structure) ---- */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        Manual Verification
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
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
                                type="button"
                                variant="primary"
                                fullWidth
                                loading={loading}
                                icon={Search}
                                onClick={handleVerify}
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
                    </div>
                </CardContent>
            </Card>

            {result && meta && (
                <Card>
                    <div className={`rounded-xl border p-4 ${meta.tone}`}>
                        <div className="flex items-center gap-3">
                            <StatusIcon className="w-7 h-7 shrink-0" />
                            <div className="flex-1">
                                <div className="text-lg font-bold">{meta.label}</div>
                                {result.message && <div className="text-sm mt-0.5">{result.message}</div>}
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
                            No product record was returned. This serial and GTIN pair is not registered in your branch.
                        </div>
                    )}
                </Card>
            )}

            {!result && !error && !decoded && (
                <Card>
                    <CardContent>
                        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                            <Boxes className="w-4 h-4 mt-0.5 shrink-0" />
                            You can scan a GS1 DataMatrix code with the camera, or enter the GTIN and serial number manually.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default Scanner;