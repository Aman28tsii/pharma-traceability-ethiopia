import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Package, Layers, AlertTriangle, Scan, TrendingUp, TrendingDown,
    ArrowRight, CheckCircle, XCircle, Clock, Box, Activity, Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardStats, getRecentActivity, getExpiryAlerts } from '../services/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';

const StatCard = ({ title, value, icon: Icon, color, trend, trendValue }) => {
    return (
        <Card className="hover:shadow-lg transition-all">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value?.toLocaleString() || 0}</p>
                    {trend && (
                        <div className="flex items-center gap-1 mt-2">
                            {trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
                            <span className={`text-xs ${trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {trendValue}
                            </span>
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-xl ${color}`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
        </Card>
    );
};

const ActivityItem = ({ activity }) => {
    const getIcon = (type) => {
        switch(type) {
            case 'verify': return <Scan className="w-4 h-4 text-blue-500" />;
            case 'sale': return <Package className="w-4 h-4 text-green-500" />;
            case 'recall': return <AlertTriangle className="w-4 h-4 text-red-500" />;
            default: return <CheckCircle className="w-4 h-4 text-gray-500" />;
        }
    };
    return (
        <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
            <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                {getIcon(activity.event_type)}
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.product_name || 'Unknown Product'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{activity.event_type}</p>
            </div>
            <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(activity.created_at).toLocaleTimeString()}</p>
            </div>
        </div>
    );
};

const ExpiryAlertCard = ({ alert }) => {
    const getAlertColor = (days) => days <= 7 ? 'danger' : days <= 30 ? 'warning' : 'info';
    const getAlertIcon = (days) => days <= 7 ? <XCircle className="w-5 h-5 text-red-500" /> : days <= 30 ? <AlertTriangle className="w-5 h-5 text-yellow-500" /> : <Clock className="w-5 h-5 text-blue-500" />;
    const color = getAlertColor(alert.days_remaining);
    const colors = { 
        danger: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', 
        warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800', 
        info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
    };
    return (
        <div className={`p-3 rounded-xl border ${colors[color]}`}>
            <div className="flex items-start gap-3">
                {getAlertIcon(alert.days_remaining)}
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{alert.product_name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Batch: {alert.batch_number}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Expires: {new Date(alert.expiry_date).toLocaleDateString()}</p>
                </div>
                <Badge variant={color} size="sm">{alert.days_remaining} days left</Badge>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [recentActivity, setRecentActivity] = useState([]);
    const [expiryAlerts, setExpiryAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [scanData, setScanData] = useState([]);
    const { user } = useAuth();
    const navigate = useNavigate();

    // Role-based content configuration
    const roleConfig = {
        admin: { 
            showCharts: true, 
            showActivity: true, 
            showAlerts: true, 
            welcomeMessage: 'Full System Access',
            statCards: ['products', 'batches', 'units', 'scans']
        },
        importer: { 
            showCharts: true, 
            showActivity: true, 
            showAlerts: true, 
            welcomeMessage: 'Manage Your Products',
            statCards: ['products', 'batches', 'units', 'scans']
        },
        distributor: { 
            showCharts: false, 
            showActivity: true, 
            showAlerts: true, 
            welcomeMessage: 'Track Inventory',
            statCards: ['products', 'units', 'scans']
        },
        pharmacy: { 
            showCharts: false, 
            showActivity: true, 
            showAlerts: true, 
            welcomeMessage: 'Verify & Dispense',
            statCards: ['products', 'scans']
        },
        auditor: { 
            showCharts: true, 
            showActivity: false, 
            showAlerts: false, 
            welcomeMessage: 'Compliance Monitoring',
            statCards: ['products', 'batches', 'units']
        }
    };

    const config = roleConfig[user?.role] || roleConfig.pharmacy;

    useEffect(() => { fetchDashboardData(); }, []);

    const fetchDashboardData = async () => {
        try {
            const [statsRes, activityRes, alertsRes] = await Promise.all([
                getDashboardStats(), 
                getRecentActivity(), 
                getExpiryAlerts()
            ]);
            setStats(statsRes.data);
            setRecentActivity(activityRes.data);
            setExpiryAlerts(alertsRes.data);
            
            const last7Days = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dayScans = activityRes.data.filter(a => 
                    new Date(a.created_at).toDateString() === date.toDateString()
                ).length;
                last7Days.push({ date: date.toLocaleDateString('en-US', { weekday: 'short' }), scans: dayScans });
            }
            setScanData(last7Days);
        } catch (error) { 
            console.error('Failed to fetch dashboard data:', error); 
        } finally { 
            setLoading(false); 
        }
    };

    if (loading) {
        return <PageLoader />;
    }

    const allStatCards = {
        products: { title: 'Total Products', value: stats?.total_products, icon: Package, color: 'bg-blue-600', trend: 'up', trendValue: '+12%' },
        batches: { title: 'Active Batches', value: stats?.total_batches, icon: Layers, color: 'bg-green-600', trend: 'up', trendValue: '+8%' },
        units: { title: 'Total Units', value: stats?.total_units, icon: Box, color: 'bg-purple-600', trend: 'up', trendValue: '+15%' },
        scans: { title: '30-Day Scans', value: stats?.scans_last_30_days, icon: Scan, color: 'bg-orange-600', trend: 'up', trendValue: '+23%' },
    };

    const statCardsToShow = config.statCards.map(key => allStatCards[key]);

    return (
        <div className="space-y-6">
            {/* Welcome Section */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Welcome back, {user?.name?.split(' ')[0] || 'User'}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{config.welcomeMessage}</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 capitalize">Role: {user?.role}</p>
            </div>

            {/* Stats Grid - Role-based */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCardsToShow.map((stat, index) => (<StatCard key={index} {...stat} />))}
            </div>

            {/* Alerts Section - Role-based */}
            {config.showAlerts && (stats?.expired_units > 0 || stats?.recalled_units > 0) && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        <div>
                            <h3 className="font-semibold text-red-800 dark:text-red-300">Critical Alerts</h3>
                            <p className="text-sm text-red-700 dark:text-red-400">
                                {stats?.expired_units > 0 && `${stats.expired_units} expired products`}
                                {stats?.expired_units > 0 && stats?.recalled_units > 0 && ' • '}
                                {stats?.recalled_units > 0 && `${stats.recalled_units} recalled products`}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Charts Section - Role-based (Admin, Importer, Auditor only) */}
            {config.showCharts && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                            <Activity className="w-5 h-5 text-blue-500" /> Scan Activity (Last 7 Days)
                        </h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={scanData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="date" stroke="#888888" />
                                <YAxis stroke="#888888" />
                                <Tooltip />
                                <Line type="monotone" dataKey="scans" stroke="#2563eb" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>
                    <Card>
                        <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                            <Package className="w-5 h-5 text-green-500" /> Weekly Overview
                        </h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={scanData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="date" stroke="#888888" />
                                <YAxis stroke="#888888" />
                                <Tooltip />
                                <Bar dataKey="scans" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </div>
            )}

            {/* Quick Scan Button */}
            <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h3 className="text-lg font-semibold mb-1">Quick Scan</h3>
                        <p className="text-blue-100 text-sm">Verify product authenticity instantly</p>
                    </div>
                    <button 
                        onClick={() => navigate('/scanner')} 
                        className="bg-white text-blue-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition shadow-md flex items-center gap-2"
                    >
                        <Scan className="w-4 h-4" /> Scan Now
                    </button>
                </div>
            </Card>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity - Role-based */}
                {config.showActivity && (
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Recent Activity</CardTitle>
                                    <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
                                        View All <ArrowRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {recentActivity.length === 0 ? (
                                    <EmptyState title="No activity yet" description="Scans and events will appear here" icon={Scan} />
                                ) : (
                                    <div className="space-y-1">
                                        {recentActivity.slice(0, 8).map((activity, idx) => (<ActivityItem key={idx} activity={activity} />))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Expiry Alerts - Role-based */}
                {config.showAlerts && (
                    <div>
                        <Card>
                            <CardHeader>
                                <CardTitle>Expiry Alerts</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {expiryAlerts.length === 0 ? (
                                    <EmptyState title="No expiry alerts" description="All products are within expiry" icon={CheckCircle} />
                                ) : (
                                    expiryAlerts.slice(0, 5).map((alert, idx) => (<ExpiryAlertCard key={idx} alert={alert} />))
                                )}
                                {expiryAlerts.length > 0 && (
                                    <Button variant="outline" fullWidth onClick={() => navigate('/batches')} className="mt-2">
                                        View All Batches
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* System Status */}
            <Card className="bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">System Status: Operational</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                        <span>Last sync: Just now</span>
                        <span>EFDA Compliant ✓</span>
                        <span>GS1 Standards ✓</span>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default Dashboard;