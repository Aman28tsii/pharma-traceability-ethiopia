import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Menu, X, LayoutDashboard, Scan, Package, Layers, AlertTriangle, FileText, Users, LogOut, Shield, Sun, Moon, Activity } from 'lucide-react';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();

  // Role-based navigation items
  const allNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'importer', 'distributor', 'pharmacy', 'auditor'] },
    { path: '/scanner', icon: Scan, label: 'Scanner', roles: ['admin', 'importer', 'distributor', 'pharmacy', 'auditor'] },
    { path: '/products', icon: Package, label: 'Products', roles: ['admin', 'importer', 'distributor', 'pharmacy', 'auditor'] },
    { path: '/batches', icon: Layers, label: 'Batches', roles: ['admin', 'importer'] },
    { path: '/recalls', icon: AlertTriangle, label: 'Recalls', roles: ['admin', 'importer', 'distributor', 'pharmacy'] },
    { path: '/reports', icon: FileText, label: 'Reports', roles: ['admin', 'auditor'] },
    { path: '/admin/users', icon: Users, label: 'Users', roles: ['admin'] },
    { path: '/admin/audit-logs', icon: Activity, label: 'Audit Logs', roles: ['admin'] },
  ];

  // Filter navigation based on user role
  const navItems = allNavItems.filter(item => item.roles.includes(user?.role));

  // Bottom navigation for mobile (simplified - only main pages)
  const bottomNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Home', roles: ['admin', 'importer', 'distributor', 'pharmacy', 'auditor'] },
    { path: '/scanner', icon: Scan, label: 'Scan', roles: ['admin', 'importer', 'distributor', 'pharmacy', 'auditor'] },
    { path: '/products', icon: Package, label: 'Products', roles: ['admin', 'importer', 'distributor', 'pharmacy', 'auditor'] },
  ];

  const filteredBottomNav = bottomNavItems.filter(item => item.roles.includes(user?.role));

  const isActive = (path) => location.pathname === path;

  if (location.pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* DESKTOP SIDEBAR */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 bg-gradient-to-b from-blue-900 to-blue-800 dark:from-gray-800 dark:to-gray-900">
          <div className="p-6 border-b border-blue-700 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-green-400" />
              <div>
                <h1 className="text-xl font-bold text-white">PharmaTrace</h1>
                <p className="text-xs text-blue-300 dark:text-gray-400">EFDA Compliant</p>
              </div>
            </div>
          </div>
          
          <nav className="flex-1 py-6 px-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive(item.path) 
                      ? 'bg-blue-700 dark:bg-gray-700 text-white' 
                      : 'text-blue-100 dark:text-gray-300 hover:bg-blue-800 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
          
          <div className="p-4 border-t border-blue-700 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-700 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-white font-semibold">{user?.name?.charAt(0) || 'A'}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{user?.name}</p>
                  <p className="text-xs text-blue-300 dark:text-gray-400 capitalize">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-blue-700 dark:bg-gray-700 text-white hover:bg-blue-600 dark:hover:bg-gray-600 transition"
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-700 dark:bg-gray-700 text-blue-100 dark:text-gray-300 hover:bg-blue-600 dark:hover:bg-gray-600 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE HEADER */}
      <div className="lg:hidden sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-lg font-bold text-blue-800 dark:text-white">PharmaTrace</h1>
          <button onClick={toggleDarkMode} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            {darkMode ? <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" /> : <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
          </button>
        </div>
      </div>

      {/* MOBILE SIDEBAR OVERLAY */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setSidebarOpen(false)} />
          <div className="fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-blue-900 to-blue-800 dark:from-gray-800 dark:to-gray-900 shadow-2xl z-50">
            <div className="p-4 border-b border-blue-700 dark:border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-green-400" />
                <div>
                  <h1 className="text-xl font-bold text-white">PharmaTrace</h1>
                  <p className="text-xs text-blue-300 dark:text-gray-400">EFDA Compliant</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <nav className="py-4 px-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive(item.path) 
                        ? 'bg-blue-700 dark:bg-gray-700 text-white' 
                        : 'text-blue-100 dark:text-gray-300 hover:bg-blue-800 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => { logout(); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 dark:text-gray-300 hover:bg-blue-800 dark:hover:bg-gray-800 mt-4"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </nav>
          </div>
        </>
      )}

      {/* MOBILE BOTTOM NAVIGATION - Role-based */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-40 lg:hidden">
        <div className="flex justify-around items-center py-2">
          {filteredBottomNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl min-w-[64px] transition-all ${
                  isActive(item.path) 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="lg:pl-64">
        <main className="p-4 pb-20 lg:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;