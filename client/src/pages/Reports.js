import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { ArrowLeft, Download, FileText, Shield, Calendar, Package } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const Reports = () => {
    const [loading, setLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [dateRange, setDateRange] = useState({ start_date: '', end_date: '' });
    const { user } = useAuth();
    const navigate = useNavigate();

    const downloadReport = async (format, type = 'efda') => {
        setLoading(true);
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
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download report');
        } finally {
            setLoading(false);
        }
    };

    if (user?.role !== 'admin' && user?.role !== 'auditor') {
        return (
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
                <Card className="text-center max-w-md">
                    <Shield className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">Only Auditors and Admins can access reports</p>
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
                <h1 className="text-xl font-bold flex-1">EFDA Reports</h1>
            </div>

            <div className="p-4 space-y-4">
                {/* Date Range Filter */}
                <Card>
                    <button 
                        onClick={() => setShowDatePicker(!showDatePicker)}
                        className="w-full flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <span className="font-semibold text-gray-900 dark:text-white">Filter by Date Range (Optional)</span>
                        </div>
                        <span className="text-gray-500 dark:text-gray-400">{showDatePicker ? '▲' : '▼'}</span>
                    </button>
                    
                    {showDatePicker && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label text-xs">Start Date</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={dateRange.start_date}
                                        onChange={(e) => setDateRange({...dateRange, start_date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="label text-xs">End Date</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={dateRange.end_date}
                                        onChange={(e) => setDateRange({...dateRange, end_date: e.target.value})}
                                    />
                                </div>
                            </div>
                            {(dateRange.start_date || dateRange.end_date) && (
                                <button 
                                    onClick={() => setDateRange({ start_date: '', end_date: '' })}
                                    className="mt-3 text-sm text-red-600 dark:text-red-400 hover:underline"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    )}
                </Card>

                {/* EFDA Compliance Report */}
                <Card className="hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">EFDA Compliance Report</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Complete traceability report for regulatory compliance
                            </p>
                        </div>
                        <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400 opacity-70" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Button 
                            onClick={() => downloadReport('json', 'efda')}
                            disabled={loading}
                            variant="secondary"
                            fullWidth
                            icon={Download}
                        >
                            JSON
                        </Button>
                        <Button 
                            onClick={() => downloadReport('csv', 'efda')}
                            disabled={loading}
                            variant="success"
                            fullWidth
                            icon={Download}
                        >
                            CSV
                        </Button>
                    </div>
                </Card>

                {/* Inventory Report */}
                <Card className="hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Inventory Report</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Current stock levels and product distribution
                            </p>
                        </div>
                        <Package className="w-8 h-8 text-green-600 dark:text-green-400 opacity-70" />
                    </div>
                    <Button 
                        onClick={() => downloadReport('json', 'inventory')}
                        disabled={loading}
                        variant="primary"
                        fullWidth
                        icon={Download}
                    >
                        Download Inventory Report
                    </Button>
                </Card>

                {/* Info Box */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">About EFDA Reports</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                        These reports comply with Ethiopian Food and Drug Authority (EFDA) requirements for pharmaceutical traceability.
                        Reports include GS1-standard serial numbers, batch information, and complete supply chain movement history.
                    </p>
                </div>

                {/* Loading Overlay */}
                {loading && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
                            <p className="mt-4 font-medium text-gray-900 dark:text-white">Generating report...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;