import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { ArrowLeft, Users, Plus, Edit2, Trash2, Shield, CheckCircle, XCircle, X } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/LoadingSpinner';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'pharmacy',
        gln: ''
    });
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/admin/users');
            setUsers(response.data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingUser) {
                await api.put(`/admin/users/${editingUser.id}`, {
                    role: formData.role,
                    is_active: formData.is_active
                });
            } else {
                await api.post('/auth/register', {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role,
                    gln: formData.gln
                });
            }
            setShowModal(false);
            setEditingUser(null);
            setFormData({ name: '', email: '', password: '', role: 'pharmacy', gln: '' });
            fetchUsers();
        } catch (error) {
            alert('Operation failed: ' + error.response?.data?.error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            try {
                await api.delete(`/admin/users/${id}`);
                fetchUsers();
            } catch (error) {
                alert('Failed to delete user');
            }
        }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        try {
            await api.put(`/admin/users/${id}`, { is_active: !currentStatus });
            fetchUsers();
        } catch (error) {
            alert('Failed to update user status');
        }
    };

    const roleColors = {
        admin: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
        importer: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
        distributor: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
        pharmacy: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
        auditor: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
    };

    if (loading) {
        return <PageLoader />;
    }

    if (user?.role !== 'admin') {
        return (
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
                <Card className="text-center max-w-md">
                    <Shield className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">Admin privileges required</p>
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
                <h1 className="text-xl font-bold flex-1">User Management</h1>
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-white dark:bg-gray-100 text-blue-600 dark:text-blue-700 p-2 rounded-full"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="p-4">
                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <Card className="text-center py-3">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{users.length}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Users</p>
                    </Card>
                    <Card className="text-center py-3">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{users.filter(u => u.is_active).length}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
                    </Card>
                    <Card className="text-center py-3">
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {users.filter(u => u.role === 'admin').length}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Admins</p>
                    </Card>
                </div>

                {/* Users List */}
                <div className="space-y-3">
                    {users.map(u => (
                        <Card key={u.id} className="hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">{u.name}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[u.role]}`}>
                                            {u.role}
                                        </span>
                                        {u.is_active ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                                <CheckCircle className="w-3 h-3" /> Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                                                <XCircle className="w-3 h-3" /> Inactive
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{u.email}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                        GLN: {u.gln || 'Not set'} | Joined: {new Date(u.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleToggleStatus(u.id, u.is_active)}
                                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                        title={u.is_active ? 'Deactivate' : 'Activate'}
                                    >
                                        {u.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setEditingUser(u);
                                            setFormData({
                                                name: u.name,
                                                email: u.email,
                                                password: '',
                                                role: u.role,
                                                gln: u.gln || '',
                                                is_active: u.is_active
                                            });
                                            setShowModal(true);
                                        }}
                                        className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                                        title="Edit User"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    {u.id !== user.id && (
                                        <button 
                                            onClick={() => handleDelete(u.id)}
                                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                            title="Delete User"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                {users.length === 0 && (
                    <Card className="text-center py-12">
                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">No users found</p>
                        <Button onClick={() => setShowModal(true)} className="mt-4">
                            Add First User
                        </Button>
                    </Card>
                )}
            </div>

            {/* Add/Edit User Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 max-h-screen overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingUser ? 'Edit User' : 'Add New User'}
                            </h2>
                            <button onClick={() => {
                                setShowModal(false);
                                setEditingUser(null);
                                setFormData({ name: '', email: '', password: '', role: 'pharmacy', gln: '' });
                            }} className="text-gray-500 dark:text-gray-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!editingUser && (
                                <>
                                    <div>
                                        <label className="label">Full Name *</label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="John Doe"
                                            value={formData.name}
                                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                                            required
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="label">Email Address *</label>
                                        <input
                                            type="email"
                                            className="input"
                                            placeholder="user@example.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                                            required
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="label">Password *</label>
                                        <input
                                            type="password"
                                            className="input"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                                            required
                                        />
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum 6 characters</p>
                                    </div>
                                </>
                            )}
                            
                            <div>
                                <label className="label">Role *</label>
                                <select
                                    className="input"
                                    value={formData.role}
                                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                                >
                                    <option value="admin">Admin - Full system access</option>
                                    <option value="importer">Importer - Create products and batches</option>
                                    <option value="distributor">Distributor - Manage inventory</option>
                                    <option value="pharmacy">Pharmacy - Scan and sell products</option>
                                    <option value="auditor">Auditor - View reports only</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="label">GLN (Global Location Number)</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="6130000000001"
                                    maxLength="13"
                                    value={formData.gln}
                                    onChange={(e) => setFormData({...formData, gln: e.target.value})}
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Optional: 13-digit GS1 location code</p>
                            </div>
                            
                            {editingUser && (
                                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">User is active</span>
                                    </label>
                                </div>
                            )}
                            
                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" onClick={() => {
                                    setShowModal(false);
                                    setEditingUser(null);
                                    setFormData({ name: '', email: '', password: '', role: 'pharmacy', gln: '' });
                                }} fullWidth>
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" loading={submitting} fullWidth>
                                    {editingUser ? 'Update User' : 'Create User'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;