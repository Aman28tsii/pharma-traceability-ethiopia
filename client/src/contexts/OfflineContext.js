// client/src/contexts/OfflineContext.js - COMPLETE VERSION
import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const OfflineContext = createContext();

export const useOffline = () => {
    const context = useContext(OfflineContext);
    if (!context) {
        throw new Error('useOffline must be used within OfflineProvider');
    }
    return context;
};

export const OfflineProvider = ({ children }) => {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [pendingSyncs, setPendingSyncs] = useState([]);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            syncPendingData();
        };
        
        const handleOffline = () => setIsOffline(true);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Load pending syncs from localStorage
        const stored = localStorage.getItem('pendingSyncs');
        if (stored) {
            setPendingSyncs(JSON.parse(stored));
        }
        
        // Try to sync on initial load if online
        if (navigator.onLine && stored && JSON.parse(stored).length > 0) {
            syncPendingData();
        }
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const addToQueue = (data) => {
        const newItem = { 
            ...data, 
            id: Date.now(), 
            timestamp: new Date().toISOString(),
            retryCount: 0
        };
        const newQueue = [...pendingSyncs, newItem];
        setPendingSyncs(newQueue);
        localStorage.setItem('pendingSyncs', JSON.stringify(newQueue));
        
        // Show notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Offline Action Queued', {
                body: 'Will sync when connection is restored'
            });
        }
    };

    const removeFromQueue = (id) => {
        const newQueue = pendingSyncs.filter(item => item.id !== id);
        setPendingSyncs(newQueue);
        localStorage.setItem('pendingSyncs', JSON.stringify(newQueue));
    };

    const syncPendingData = async () => {
        if (syncing || pendingSyncs.length === 0) return;
        
        setSyncing(true);
        setSyncProgress({ current: 0, total: pendingSyncs.length });
        
        const failedItems = [];
        
        for (let i = 0; i < pendingSyncs.length; i++) {
            const item = pendingSyncs[i];
            setSyncProgress({ current: i + 1, total: pendingSyncs.length });
            
            try {
                if (item.action === 'verify') {
                    await api.post('/verify', item.payload);
                    removeFromQueue(item.id);
                } else if (item.action === 'create_batch') {
                    await api.post('/batches', item.payload);
                    removeFromQueue(item.id);
                } else if (item.action === 'create_product') {
                    await api.post('/products', item.payload);
                    removeFromQueue(item.id);
                } else if (item.action === 'initiate_recall') {
                    await api.post('/recalls', item.payload);
                    removeFromQueue(item.id);
                }
            } catch (err) {
                console.error(`Sync failed for ${item.action}:`, err);
                item.retryCount = (item.retryCount || 0) + 1;
                if (item.retryCount < 3) {
                    failedItems.push(item);
                }
            }
        }
        
        // Update queue with failed items
        if (failedItems.length > 0) {
            setPendingSyncs(failedItems);
            localStorage.setItem('pendingSyncs', JSON.stringify(failedItems));
        }
        
        setSyncing(false);
        
        // Show completion notification
        const syncedCount = pendingSyncs.length - failedItems.length;
        if (syncedCount > 0 && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Sync Complete', {
                body: `Successfully synced ${syncedCount} items`
            });
        }
    };

    const clearAllPending = () => {
        setPendingSyncs([]);
        localStorage.removeItem('pendingSyncs');
    };

    const requestNotificationPermission = () => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    };

    const value = {
        isOffline,
        pendingSyncs,
        syncing,
        syncProgress,
        addToQueue,
        syncPendingData,
        clearAllPending,
        requestNotificationPermission,
    };

    return (
        <OfflineContext.Provider value={value}>
            {children}
        </OfflineContext.Provider>
    );
};