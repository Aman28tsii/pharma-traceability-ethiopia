import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { ArrowLeft, Clock, Filter, Download, Calendar, User, Activity, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/LoadingSpinner';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({ 
        action: '', 
        start_date: '', 
        end_date: '',
        user_id: '' 
    });
    const [users, setUsers] = useState([]);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchUsers();
            fetchLogs();
        }
    }, [page, filters]);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/admin/users');
            setUsers(response.data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                limit: 50,
                offset: (page - 1) * 50
            });
            if (filters.action) params.append('action', filters.action);
            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);
            if (filters.user_id) params.append('user_id', filters.user_id);
            
            const response = await api.get(`/admin/audit-logs?${params.toString()}`);
            setLogs(response.data);
            setTotalPages(Math.ceil((response.data.length || 1) / 50));
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportLogs = async () => {
        try {
            const params = new URLSearchParams();
            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);
            
            const response = await api.get(`/admin/audit-logs/export?${params.toString()}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit_logs_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert('Failed to export logs');
        }
    };

    const getActionBadge = (action) => {
        const styles = {
            CREATE: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
            UPDATE: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
            DELETE: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
            LOGIN: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
            VERIFY: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300',
        };
        return styles[action] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    };

    if (user?.role !== 'admin') {
        return (
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
                <Card className="text-center max-w-md">
                    <Activity className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">Admin privileges required</p>
                    <Button onClick={() => navigate('/dashboard')}>Go Back</Button>
                </Card>
            </div>
        );
    }

    if (loading) {
        return <PageLoader />;
    }

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-blue-600 dark:bg-blue-700 text-white p-4 flex items-center gap-3 sticky top-0 z-10">
                <button onClick={() => navigate('/dashboard')} className="p-1 hover:bg-blue-700 rounded-lg">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold flex-1">Audit Logs</h1>
                <button onClick={() => setShowFilters(!showFilters)} className="p-2 hover:bg-blue-700 rounded-lg">
                    <Filter className="w-5 h-5" />
                </button>
                <button onClick={exportLogs} className="p-2 hover:bg-blue-700 rounded-lg">
                    <Download className="w-5 h-5" />
                </button>
                <button onClick={fetchLogs} className="p-2 hover:bg-blue-700 rounded-lg">
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            <div className="p-4">
                {/* Filters Panel */}
                {showFilters && (
                    <Card className="mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <Filter className="w-4 h-4" /> Filter Logs
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="label text-xs">Action Type</label>
                                <select 
                                    className="input text-sm" 
                                    value={filters.action} 
                                    onChange={(e) => setFilters({...filters, action: e.target.value, page: 1})}
                                >
                                    <option value="">All Actions</option>
                                    <option value="CREATE">Create</option>
                                    <option value="UPDATE">Update</option>
                                    <option value="DELETE">Delete</option>
                                    <option value="LOGIN">Login</option>
                                    <option value="VERIFY">Verify</option>
                                </select>
                            </div>
                            <div>
                                <label className="label text-xs">User</label>
                                <select 
                                    className="input text-sm" 
                                    value={filters.user_id} 
                                    onChange={(e) => setFilters({...filters, user_id: e.target.value, page: 1})}
                                >
                                    <option value="">All Users</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label text-xs">Start Date</label>
                                <input 
                                    type="date" 
                                    className="input text-sm" 
                                    value={filters.start_date} 
                                    onChange={(e) => setFilters({...filters, start_date: e.target.value, page: 1})}
                                />
                            </div>
                            <div>
                                <label className="label text-xs">End Date</label>
                                <input 
                                    type="date" 
                                    className="input text-sm" 
                                    value={filters.end_date} 
                                    onChange={(e) => setFilters({...filters, end_date: e.target.value, page: 1})}
                                />
                            </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setFilters({ action: '', user_id: '', start_date: '', end_date: '' })}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    </Card>
                )}

                {/* Logs Table */}
                <Card className="overflow-x-auto">
                    {logs.length === 0 ? (
                        <div className="text-center py-12">
                            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">No audit logs found</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="text-left py-3 px-2 text-gray-600 dark:text-gray-400">Time</th>
                                    <th className="text-left py-3 px-2 text-gray-600 dark:text-gray-400">User</th>
                                    <th className="text-left py-3 px-2 text-gray-600 dark:text-gray-400">Action</th>
                                    <th className="text-left py-3 px-2 text-gray-600 dark:text-gray-400">Entity</th>
                                    <th className="text-left py-3 px-2 text-gray-600 dark:text-gray-400">Details</th>
                                    <th className="text-left py-3 px-2 text-gray-600 dark:text-gray-400">IP Address</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="py-2 px-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="py-2 px-2">
                                            <div className="text-gray-900 dark:text-white">{log.user_name || 'System'}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-500">{log.user_email}</div>
                                        </td>
                                        <td className="py-2 px-2">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionBadge(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 text-gray-700 dark:text-gray-300">
                                            {log.entity_type} #{log.entity_id}
                                        </td>
                                        <td className="py-2 px-2 max-w-xs">
                                            {log.new_data ? (
                                                <details>
                                                    <summary className="cursor-pointer text-blue-600 dark:text-blue-400 text-xs">View changes</summary>
                                                    <pre className="text-xs mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded overflow-x-auto">
                                                        {JSON.stringify(log.new_data, null, 2)}
                                                    </pre>
                                                </details>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2 text-xs font-mono text-gray-500 dark:text-gray-400">
                                            {log.ip_address || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default AuditLogs;