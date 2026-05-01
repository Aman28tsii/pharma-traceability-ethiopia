// client/src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Package, Scan, Shield } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
            <div className="card max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="bg-primary w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-primary">PharmaTrace</h1>
                    <p className="text-gray-600 mt-2">Pharmaceutical Traceability System</p>
                    <p className="text-xs text-gray-500 mt-1">EFDA Compliant | GS1 Standards</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="label">Email Address</label>
                        <input
                            type="email"
                            className="input"
                            placeholder="admin@pharma.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="label">Password</label>
                        <input
                            type="password"
                            className="input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    
                    {error && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm border border-red-200">
                            {error}
                        </div>
                    )}
                    
                    <button 
                        type="submit" 
                        className="btn-primary w-full py-3 text-lg"
                        disabled={loading}
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                
                <div className="mt-8 pt-6 border-t text-center">
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                        <Shield className="w-4 h-4" />
                        <span>Secure GS1 Compliant System</span>
                    </div>
                    <div className="mt-3 text-xs text-gray-400">
                        <p>Demo Credentials:</p>
                        <p className="font-mono">admin@pharma.com / admin123</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;