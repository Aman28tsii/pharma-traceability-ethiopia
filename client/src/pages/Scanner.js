import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserMultiFormatReader } from '@zxing/library';
import { verifyProduct } from '../services/api';
import { useOffline } from '../contexts/OfflineContext';
import { 
  Camera, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Scan, 
  Package,
  Edit3,
  ArrowLeft
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const Scanner = () => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualGtin, setManualGtin] = useState('');
  const [manualSerial, setManualSerial] = useState('');
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const navigate = useNavigate();
  const { isOffline, addToQueue } = useOffline();

  // Vibrate on scan result
  const vibrate = () => {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(200);
    }
  };

  const startScanner = async () => {
    try {
      setScanning(true);
      setResult(null);
      setCameraError(null);
      
      const codeReader = new BrowserMultiFormatReader();
      readerRef.current = codeReader;
      
      const devices = await codeReader.listVideoInputDevices();
      
      if (devices.length === 0) {
        throw new Error('No camera found');
      }
      
      const backCamera = devices.find(d => 
        d.label.toLowerCase().includes('back') || 
        d.label.toLowerCase().includes('rear')
      ) || devices[0];
      
      await codeReader.decodeFromVideoDevice(backCamera.deviceId, videoRef.current, (result, err) => {
        if (result) {
          handleScan(result.getText());
          stopScanner();
        }
      });
    } catch (err) {
      console.error('Scanner error:', err);
      setCameraError('Failed to start camera. Please use manual entry.');
      setManualMode(true);
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    setScanning(false);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualGtin || !manualSerial) {
      alert('Please enter both GTIN and Serial Number');
      return;
    }
    await handleVerification(manualGtin, manualSerial);
  };

  const handleScan = async (scannedData) => {
    try {
      const gtinMatch = scannedData.match(/\(01\)(\d{14})/);
      const serialMatch = scannedData.match(/\(21\)([^(]+)/);
      
      if (!gtinMatch || !serialMatch) {
        throw new Error('Invalid GS1 barcode format');
      }
      
      const gtin = gtinMatch[1];
      const serial = serialMatch[1].trim();
      
      await handleVerification(gtin, serial);
    } catch (err) {
      setResult({
        status: 'error',
        message: err.message || 'Invalid barcode format',
        product: null
      });
      vibrate();
    }
  };

  const handleVerification = async (gtin, serial) => {
    setLoading(true);
    
    try {
      if (isOffline) {
        addToQueue({
          action: 'verify',
          payload: { gtin, serial_number: serial },
          timestamp: new Date().toISOString()
        });
        setResult({
          status: 'pending',
          message: '📱 Offline Mode - Will verify when online',
          product: null
        });
        vibrate();
        setLoading(false);
        return;
      }
      
      const response = await verifyProduct({ gtin, serial_number: serial });
      setResult(response.data);
      vibrate();
    } catch (err) {
      setResult({
        status: 'error',
        message: err.response?.data?.message || 'Verification failed',
        product: null
      });
      vibrate();
    } finally {
      setLoading(false);
    }
  };

  const getResultStyles = () => {
    if (!result) return {};
    switch(result.status) {
      case 'valid':
        return {
          bg: 'bg-gradient-to-br from-green-500 to-green-600',
          icon: <CheckCircle className="w-20 h-20 text-white" />,
          title: 'Product Verified',
          subtitle: 'Authentic Product'
        };
      case 'expired':
        return {
          bg: 'bg-gradient-to-br from-red-500 to-red-600',
          icon: <XCircle className="w-20 h-20 text-white" />,
          title: 'Product Expired',
          subtitle: 'Do Not Use'
        };
      case 'warning':
        return {
          bg: 'bg-gradient-to-br from-yellow-500 to-yellow-600',
          icon: <AlertTriangle className="w-20 h-20 text-white" />,
          title: 'Expiring Soon',
          subtitle: 'Check Expiry Date'
        };
      case 'recalled':
        return {
          bg: 'bg-gradient-to-br from-red-700 to-red-800',
          icon: <XCircle className="w-20 h-20 text-white" />,
          title: 'Product Recalled',
          subtitle: 'URGENT - Do Not Use'
        };
      default:
        return {
          bg: 'bg-gray-500',
          icon: <Scan className="w-20 h-20 text-white" />,
          title: 'Invalid Product',
          subtitle: 'Not Found in System'
        };
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header with back button */}
      <div className="mb-6">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Product Scanner</h1>
        <p className="text-gray-500 mt-1">Scan GS1 DataMatrix barcode to verify authenticity</p>
      </div>

      {/* Main Scanner Interface */}
      {!scanning && !result && !manualMode && (
        <div className="space-y-4">
          <Card className="text-center py-12">
            <div className="inline-flex p-6 bg-blue-50 rounded-full mb-6">
              <Scan className="w-12 h-12 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Ready to Scan</h2>
            <p className="text-gray-500 mb-8">
              Position the barcode within the camera frame
            </p>
            <Button onClick={startScanner} size="lg" fullWidth icon={Camera}>
              Start Camera
            </Button>
            <Button 
              onClick={() => setManualMode(true)} 
              variant="outline" 
              fullWidth 
              className="mt-3"
              icon={Edit3}
            >
              Enter Manually
            </Button>
          </Card>

          {cameraError && (
            <Card className="bg-yellow-50 border-yellow-200">
              <p className="text-yellow-800 text-sm">{cameraError}</p>
            </Card>
          )}

          <Card className="bg-blue-50 border-blue-100">
            <h3 className="font-semibold text-blue-800 mb-2">Tips for best results:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Ensure good lighting</li>
              <li>• Hold phone steady</li>
              <li>• Center barcode in frame</li>
            </ul>
          </Card>
        </div>
      )}

      {/* Manual Entry Form */}
      {manualMode && !scanning && !result && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Manual Entry</h2>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GTIN (14 digits)
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="06130000010001"
                maxLength="14"
                value={manualGtin}
                onChange={(e) => setManualGtin(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serial Number
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter serial number"
                value={manualSerial}
                onChange={(e) => setManualSerial(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" loading={loading} fullWidth>
                Verify Product
              </Button>
              <Button 
                type="button"
                variant="outline"
                onClick={() => setManualMode(false)}
              >
                Back
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Verification Result */}
      {result && (
        <div className="space-y-4 animate-fade-in">
          <div className={`${getResultStyles().bg} rounded-2xl p-8 text-center text-white`}>
            {getResultStyles().icon}
            <h2 className="text-2xl font-bold mt-4">{getResultStyles().title}</h2>
            <p className="text-lg opacity-90 mt-1">{result.message}</p>
            {result.status === 'warning' && result.product?.days_left && (
              <p className="mt-2 text-sm opacity-80">
                Expires in {result.product.days_left} days
              </p>
            )}
          </div>

          {result.product && (
            <Card>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Product Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Product Name:</span>
                  <span className="font-medium">{result.product.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">GTIN:</span>
                  <span className="font-mono text-sm">{result.product.gtin}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Serial Number:</span>
                  <span className="font-mono text-sm">{result.product.serial_number}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Batch:</span>
                  <span>{result.product.batch}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Expiry Date:</span>
                  <span className={result.product.days_left <= 30 ? 'text-red-600 font-semibold' : ''}>
                    {new Date(result.product.expiry_date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={() => {
                setResult(null);
                setManualMode(false);
              }} 
              fullWidth
              icon={Scan}
            >
              Scan Another
            </Button>
            <Button 
              onClick={() => navigate('/dashboard')} 
              variant="outline"
            >
              Dashboard
            </Button>
          </div>
        </div>
      )}

      {/* Camera Overlay */}
      {scanning && (
        <div className="fixed inset-0 bg-black z-50">
          <div className="relative h-full">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-4 border-green-400 w-80 h-80 rounded-2xl flex flex-col items-center justify-center bg-black bg-opacity-40">
                <Scan className="w-12 h-12 text-green-400 mb-3 animate-pulse" />
                <p className="text-white text-center font-medium">Align barcode inside frame</p>
              </div>
            </div>
            <div className="absolute bottom-10 left-0 right-0 text-center">
              <Button onClick={stopScanner} variant="danger" className="mx-auto">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 font-medium">Verifying product...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scanner;