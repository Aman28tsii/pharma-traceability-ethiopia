// client/src/pages/TraceTimeline.js - Phase 6 traceability timeline
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Search, RefreshCw, History, Boxes, MapPin,
    ArrowRight, User as UserIcon, AlertTriangle, CheckCircle, X
} from 'lucide-react';
import api from '../services/api';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

// ---------- helpers ----------
const fmtDateTime = (d) => d ? new Date(d).toLocaleString() : 'â€”';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : 'â€”';

const eventLabel = {
    manufacture: 'Manufacture',
    receive: 'Receive',
    dispatch: 'Dispatch',
    transfer_in: 'Transfer In',
    transfer_out: 'Transfer Out',
    verify: 'Verify',
    dispense: 'Dispense',
    return_supplier: 'Return to Supplier',
    adjust: 'Adjustment',
    adjustment: 'Adjustment',
    recall: 'Recall',
};

const eventColor = {
    manufacture: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    receive: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    dispatch: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    transfer_in: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    transfer_out: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    verify: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    dispense: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    return_supplier: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    adjust: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    adjustment: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    recall: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

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

// ---------- single event card ----------
const EventItem = ({ event, showSerial }) => {
    const [expanded, setExpanded] = useState(false);
    const hasData = event.event_data && Object.keys(event.event_data).length > 0;
    const eventType = event.event_type;
    const colorClass = eventColor[eventType] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

    return (
        <div className="border-b border-gray-100 dark:border-gray-800 py-3 last:border-0">
            <div className="flex items-start gap-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${colorClass}`}>
                    {eventLabel[eventType] || eventType}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 dark:text-white">
                        {fmtDateTime(event.created_at)}
                    </div>
                    {(event.from_gln || event.to_gln) && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                            <span>{event.from_gln || 'â€”'}</span>
                            <ArrowRight className="w-3 h-3" />
                            <span>{event.to_gln || 'â€”'}</span>
                        </div>
                    )}
                    {event.location && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            <span>{event.location}</span>
                        </div>
                    )}
                    {showSerial && event.serial_number && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                            {event.serial_number}
                        </div>
                    )}
                    {event.user_name && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                            <UserIcon className="w-3 h-3" />
                            <span>{event.user_name}</span>
                        </div>
                    )}
                </div>
                {hasData && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-xs text-blue-600 dark:text-blue-400 shrink-0"
                    >
                        {expanded ? 'Hide' : 'Details'}
                    </button>
                )}
            </div>
            {expanded && hasData && (
                <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-x-auto">
                    {JSON.stringify(event.event_data, null, 2)}
                </pre>
            )}
        </div>
    );
};

// ---------- main page ----------
const TraceTimeline = ({ mode }) => {
    const { serialNumber, batchNumber } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const identifier = mode === 'serial' ? serialNumber : batchNumber;
    const endpoint = mode === 'serial'
        ? `/trace/serial/${encodeURIComponent(identifier)}`
        : `/trace/batch/${encodeURIComponent(identifier)}`;

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get(endpoint);
            setData(res.data);
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to load trace');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, identifier]);

    const title = mode === 'serial' ? 'Serial Trace' : 'Batch Trace';

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {mode === 'serial' ? <Search className="w-6 h-6" /> : <Boxes className="w-6 h-6" />}
                        {title}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono break-all">
                        {identifier}
                    </p>
                    {data?.batch_number && mode === 'serial' && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Batch: {data.batch_number}
                        </p>
                    )}
                </div>
                <Button variant="outline" size="sm" onClick={load} icon={RefreshCw}>
                    Refresh
                </Button>
            </div>

            <Banner type="error" message={error} onClose={() => setError('')} />

            {loading ? (
                <PageLoader />
            ) : !data || data.events.length === 0 ? (
                <Card>
                    <EmptyState
                        title="No trace events"
                        description="No events recorded for this identifier in your branch."
                    />
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="w-5 h-5" />
                            Timeline ({data.events.length} {data.events.length === 1 ? 'event' : 'events'})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.events.map((event, idx) => (
                            <EventItem key={event.id} event={event} showSerial={mode === 'batch'} />
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default TraceTimeline;

