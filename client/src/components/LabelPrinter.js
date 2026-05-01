import React, { useState, useRef } from 'react';
import { Printer, Download, Settings, Plus, Minus, Package, QrCode } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import QRCode from 'qrcode';

const LabelPrinter = ({ products, batches, onClose }) => {
    const [settings, setSettings] = useState({
        paperSize: 'a4',
        labelsPerRow: 3,
        labelWidth: 80,
        labelHeight: 40,
        showProductName: true,
        showGTIN: true,
        showBatch: true,
        showExpiry: true,
        showLogo: true,
        fontSize: 10
    });
    const [previewLabels, setPreviewLabels] = useState([]);
    const [generating, setGenerating] = useState(false);
    const printRef = useRef();

    const generateLabels = async () => {
        setGenerating(true);
        const items = batches || products;
        if (!items || items.length === 0) return;
        
        const labels = [];
        for (let i = 0; i < Math.min(24, items.length * 2); i++) {
            const item = items[i % items.length];
            let barcodeUrl = null;
            
            if (item.gtin && item.batch_number) {
                const gs1Data = `(01)${item.gtin}(10)${item.batch_number}`;
                barcodeUrl = await QRCode.toDataURL(gs1Data, { width: 150, margin: 1 });
            }
            
            labels.push({ ...item, barcodeUrl });
        }
        setPreviewLabels(labels);
        setGenerating(false);
    };

    const printLabels = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>PharmaTrace Labels</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { 
                            font-family: Arial, sans-serif; 
                            padding: 20px;
                            background: white;
                        }
                        .label-container {
                            display: flex;
                            flex-wrap: wrap;
                            gap: 5px;
                            justify-content: flex-start;
                        }
                        .label {
                            width: ${settings.labelWidth}mm;
                            height: ${settings.labelHeight}mm;
                            border: 1px solid #ccc;
                            padding: 3mm;
                            page-break-inside: avoid;
                            display: flex;
                            flex-direction: column;
                            font-size: ${settings.fontSize}px;
                        }
                        .label-header {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 2mm;
                        }
                        .label-content {
                            flex: 1;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                        }
                        .barcode-img {
                            max-width: 100%;
                            height: auto;
                            margin: 2mm 0;
                        }
                        .product-name {
                            font-weight: bold;
                            font-size: ${settings.fontSize + 2}px;
                            margin-bottom: 1mm;
                        }
                        .details {
                            font-size: ${settings.fontSize - 1}px;
                            color: #555;
                        }
                        .footer {
                            font-size: ${settings.fontSize - 2}px;
                            text-align: center;
                            margin-top: 2mm;
                            color: #999;
                        }
                        @media print {
                            body { margin: 0; padding: 0; }
                            .label { border: 0.5px solid #ddd; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="no-print" style="margin-bottom: 20px; text-align: center;">
                        <button onclick="window.print()">Print</button>
                        <button onclick="window.close()">Close</button>
                    </div>
                    <div class="label-container">
                        ${previewLabels.map(label => `
                            <div class="label">
                                <div class="label-header">
                                    ${settings.showLogo ? '<strong>PT</strong>' : ''}
                                    <span>Rx</span>
                                </div>
                                <div class="label-content">
                                    ${settings.showProductName ? `<div class="product-name">${label.product_name || label.name || 'Product'}</div>` : ''}
                                    ${label.barcodeUrl ? `<img class="barcode-img" src="${label.barcodeUrl}" />` : ''}
                                    <div class="details">
                                        ${settings.showGTIN && label.gtin ? `<div>GTIN: ${label.gtin}</div>` : ''}
                                        ${settings.showBatch && label.batch_number ? `<div>Batch: ${label.batch_number}</div>` : ''}
                                        ${settings.showExpiry && label.expiry_date ? `<div>Exp: ${new Date(label.expiry_date).toLocaleDateString()}</div>` : ''}
                                    </div>
                                </div>
                                <div class="footer">PharmaTrace Ethiopia</div>
                            </div>
                        `).join('')}
                    </div>
                    <script>
                        window.onload = () => { setTimeout(() => window.print(), 500); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Printer className="w-5 h-5" /> Label Printer
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        ✕
                    </button>
                </div>
                
                <div className="space-y-4">
                    {/* Settings */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <Settings className="w-4 h-4" /> Print Settings
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="label text-xs">Paper Size</label>
                                <select className="input text-sm" value={settings.paperSize} onChange={(e) => setSettings({...settings, paperSize: e.target.value})}>
                                    <option value="a4">A4</option>
                                    <option value="letter">Letter</option>
                                </select>
                            </div>
                            <div>
                                <label className="label text-xs">Labels per row</label>
                                <input type="number" className="input text-sm" value={settings.labelsPerRow} onChange={(e) => setSettings({...settings, labelsPerRow: parseInt(e.target.value)})} min={1} max={4} />
                            </div>
                            <div>
                                <label className="label text-xs">Font Size (px)</label>
                                <input type="number" className="input text-sm" value={settings.fontSize} onChange={(e) => setSettings({...settings, fontSize: parseInt(e.target.value)})} min={8} max={14} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input type="checkbox" checked={settings.showProductName} onChange={(e) => setSettings({...settings, showProductName: e.target.checked})} />
                                Product Name
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input type="checkbox" checked={settings.showGTIN} onChange={(e) => setSettings({...settings, showGTIN: e.target.checked})} />
                                GTIN
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input type="checkbox" checked={settings.showBatch} onChange={(e) => setSettings({...settings, showBatch: e.target.checked})} />
                                Batch Number
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input type="checkbox" checked={settings.showExpiry} onChange={(e) => setSettings({...settings, showExpiry: e.target.checked})} />
                                Expiry Date
                            </label>
                        </div>
                    </div>
                    
                    {/* Generate Preview Button */}
                    <Button onClick={generateLabels} variant="primary" fullWidth loading={generating} icon={QrCode}>
                        Generate Preview Labels
                    </Button>
                    
                    {/* Preview Section */}
                    {previewLabels.length > 0 && (
                        <>
                            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Preview</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {previewLabels.slice(0, 6).map((label, idx) => (
                                        <div key={idx} className="border rounded p-2 text-center bg-white dark:bg-gray-700">
                                            <div className="font-bold text-xs truncate">{label.product_name || label.name}</div>
                                            {label.gtin && <div className="text-xs text-gray-500">GTIN: {label.gtin}</div>}
                                            {label.batch_number && <div className="text-xs">Batch: {label.batch_number}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <Button onClick={printLabels} variant="success" fullWidth icon={Printer}>
                                Print Labels ({previewLabels.length} labels)
                            </Button>
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default LabelPrinter;