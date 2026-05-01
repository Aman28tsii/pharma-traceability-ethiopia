// client/src/components/BarcodeGenerator.jsx
import React, { useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, QrCode, Copy, Check } from 'lucide-react';

const BarcodeGenerator = ({ gtin, serialNumber, batchNumber, expiryDate, productName }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [barcodeSize, setBarcodeSize] = useState(300);

    // Generate GS1 DataMatrix format string
    const generateGS1Data = () => {
        const expiryFormatted = expiryDate.replace(/-/g, '');
        return `(01)${gtin}(21)${serialNumber}(10)${batchNumber}(17)${expiryFormatted}`;
    };

    const generateBarcode = async () => {
        setLoading(true);
        try {
            const gs1Data = generateGS1Data();
            const url = await QRCode.toDataURL(gs1Data, {
                width: barcodeSize,
                margin: 2,
                errorCorrectionLevel: 'H',
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            setQrCodeUrl(url);
        } catch (err) {
            console.error('Barcode generation failed:', err);
            alert('Failed to generate barcode');
        } finally {
            setLoading(false);
        }
    };

    const downloadBarcode = () => {
        if (!qrCodeUrl) return;
        const link = document.createElement('a');
        link.download = `barcode_${serialNumber}.png`;
        link.href = qrCodeUrl;
        link.click();
    };

    const printBarcode = () => {
        if (!qrCodeUrl) return;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Print Barcode - ${serialNumber}</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            min-height: 100vh; 
                            font-family: Arial, sans-serif;
                            background: white;
                        }
                        .barcode-container {
                            text-align: center;
                            padding: 20px;
                            border: 1px solid #ddd;
                            border-radius: 8px;
                            background: white;
                        }
                        .barcode-image {
                            width: 300px;
                            height: 300px;
                            margin: 0 auto;
                        }
                        .product-name {
                            font-size: 14px;
                            font-weight: bold;
                            margin-top: 15px;
                        }
                        .details {
                            font-size: 12px;
                            margin-top: 10px;
                            color: #555;
                        }
                        .details p {
                            margin: 5px 0;
                        }
                        .gs1-data {
                            font-family: monospace;
                            font-size: 10px;
                            margin-top: 15px;
                            word-break: break-all;
                            background: #f5f5f5;
                            padding: 8px;
                            border-radius: 4px;
                        }
                        @media print {
                            body { margin: 0; padding: 0; }
                            .barcode-container { border: none; }
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="barcode-container">
                        <img class="barcode-image" src="${qrCodeUrl}" />
                        <div class="product-name">${productName || 'Pharmaceutical Product'}</div>
                        <div class="details">
                            <p><strong>GTIN:</strong> ${gtin}</p>
                            <p><strong>Serial:</strong> ${serialNumber}</p>
                            <p><strong>Batch:</strong> ${batchNumber}</p>
                            <p><strong>Expiry:</strong> ${new Date(expiryDate).toLocaleDateString()}</p>
                        </div>
                        <div class="gs1-data">
                            ${generateGS1Data()}
                        </div>
                    </div>
                    <script>
                        window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const copyToClipboard = () => {
        const gs1Data = generateGS1Data();
        navigator.clipboard.writeText(gs1Data);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-primary" />
                    GS1 DataMatrix Barcode
                </h3>
            </div>
            
            {!qrCodeUrl ? (
                <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">Barcode Size:</p>
                        <div className="flex gap-2">
                            {[200, 300, 400, 500].map(size => (
                                <button
                                    key={size}
                                    onClick={() => setBarcodeSize(size)}
                                    className={`px-3 py-1 rounded-lg text-sm ${
                                        barcodeSize === size 
                                            ? 'bg-primary text-white' 
                                            : 'bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    {size}px
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-blue-800">
                            <strong>GS1 Format:</strong> {generateGS1Data()}
                        </p>
                    </div>
                    
                    <button 
                        onClick={generateBarcode}
                        disabled={loading}
                        className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white"></div>
                                Generating...
                            </>
                        ) : (
                            <>
                                <QrCode className="w-4 h-4" />
                                Generate Barcode
                            </>
                        )}
                    </button>
                </div>
            ) : (
                <div className="text-center">
                    <img 
                        src={qrCodeUrl} 
                        alt="GS1 DataMatrix Barcode" 
                        className="mx-auto my-4 border rounded-lg shadow-lg"
                        style={{ width: barcodeSize, height: barcodeSize }}
                    />
                    
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <button onClick={downloadBarcode} className="btn-primary py-2 flex items-center justify-center gap-2">
                            <Download className="w-4 h-4" /> Download
                        </button>
                        <button onClick={printBarcode} className="border border-primary text-primary py-2 rounded-xl flex items-center justify-center gap-2">
                            <Printer className="w-4 h-4" /> Print
                        </button>
                    </div>
                    
                    <div className="mt-4">
                        <button onClick={copyToClipboard} className="text-sm text-gray-600 flex items-center justify-center gap-1">
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copied!' : 'Copy GS1 Data'}
                        </button>
                    </div>
                    
                    <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 font-mono break-all">
                            {generateGS1Data()}
                        </p>
                    </div>
                    
                    <button 
                        onClick={() => setQrCodeUrl(null)}
                        className="w-full mt-3 text-sm text-gray-500 underline"
                    >
                        Generate New Barcode
                    </button>
                </div>
            )}
        </div>
    );
};

export default BarcodeGenerator;