import React, { useState } from 'react';
import { Upload, Download, X, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import api from '../services/api';

const BulkImport = ({ type = 'products', onClose, onSuccess }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [dragActive, setDragActive] = useState(false);

    const downloadTemplate = () => {
        let headers = '';
        let sample = '';
        
        if (type === 'products') {
            headers = 'gtin,product_name,manufacturer,strength\n';
            sample = '06130000010001,Paracetamol 500mg,Ethio Pharma,500mg\n06130000010002,Amoxicillin 250mg,Addis Pharma,250mg';
        } else {
            headers = 'product_gtin,batch_number,expiry_date,quantity\n';
            sample = '06130000010001,BATCH001,2026-12-31,1000\n06130000010002,BATCH002,2025-12-31,500';
        }
        
        const blob = new Blob([headers + sample], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_import_template.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type === 'text/csv') {
            setFile(droppedFile);
        } else {
            alert('Please upload a CSV file');
        }
    };

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && selectedFile.type === 'text/csv') {
            setFile(selectedFile);
        } else {
            alert('Please upload a CSV file');
        }
    };

    const handleUpload = async () => {
        if (!file) {
            alert('Please select a file first');
            return;
        }
        
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await api.post(`/import/${type}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResults(response.data);
            if (response.data.imported > 0 && onSuccess) {
                setTimeout(() => onSuccess(), 2000);
            }
        } catch (error) {
            alert('Upload failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
            <Card className="max-w-lg w-full">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Bulk Import {type === 'products' ? 'Products' : 'Batches'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="space-y-4">
                    {/* Instructions */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Instructions:</h3>
                        <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                            <li>Download the CSV template below</li>
                            <li>Fill in your data (don't change the headers)</li>
                            <li>Save as CSV format</li>
                            <li>Upload the file here</li>
                        </ol>
                    </div>
                    
                    {/* Download Template Button */}
                    <Button onClick={downloadTemplate} variant="outline" fullWidth icon={Download}>
                        Download CSV Template
                    </Button>
                    
                    {/* Upload Area */}
                    <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                            dragActive 
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                : 'border-gray-300 dark:border-gray-600'
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                            Drag and drop your CSV file here, or click to select
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                            Supported format: .csv
                        </p>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="file-upload"
                        />
                        <label
                            htmlFor="file-upload"
                            className="inline-block mt-3 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                        >
                            Select File
                        </label>
                    </div>
                    
                    {/* Selected File */}
                    {file && (
                        <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <FileText className="w-4 h-4 text-blue-500" />
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{file.name}</span>
                            <button onClick={() => setFile(null)} className="text-red-500">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    
                    {/* Upload Button */}
                    <Button 
                        onClick={handleUpload} 
                        variant="primary" 
                        fullWidth 
                        loading={loading}
                        disabled={!file}
                        icon={Upload}
                    >
                        Upload & Import
                    </Button>
                    
                    {/* Results */}
                    {results && (
                        <div className={`p-3 rounded-lg ${
                            results.failed === 0 
                                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                                : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {results.failed === 0 ? (
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                                )}
                                <span className="font-semibold text-gray-900 dark:text-white">Import Results:</span>
                            </div>
                            <p className="text-sm text-green-600 dark:text-green-400">
                                ✅ Successfully imported: {results.imported}
                            </p>
                            {results.failed > 0 && (
                                <p className="text-sm text-red-600 dark:text-red-400">
                                    ❌ Failed: {results.failed}
                                </p>
                            )}
                            {results.errors && results.errors.length > 0 && (
                                <details className="mt-2">
                                    <summary className="text-sm cursor-pointer text-gray-600 dark:text-gray-400">
                                        View errors ({results.errors.length})
                                    </summary>
                                    <div className="mt-2 text-xs space-y-1 max-h-40 overflow-y-auto">
                                        {results.errors.map((err, idx) => (
                                            <p key={idx} className="text-red-600 dark:text-red-400">
                                                Row {err.row?.gtin ? JSON.stringify(err.row) : idx + 1}: {err.error}
                                            </p>
                                        ))}
                                    </div>
                                </details>
                            )}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default BulkImport;