import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, createProduct, deleteProduct, updateProduct } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { 
    ArrowLeft, 
    Package, 
    Plus, 
    Search, 
    Edit2, 
    Trash2, 
    X, 
    Check, 
    AlertCircle,
    QrCode,
    Download,
    Printer,
    Copy,
    Eye,
    Filter
} from 'lucide-react';
import QRCode from 'qrcode';
import { PageLoader } from '../components/ui/LoadingSpinner';

const Products = () => {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showBarcodeModal, setShowBarcodeModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [deletingProduct, setDeletingProduct] = useState(null);
    const [viewingProduct, setViewingProduct] = useState(null);
    const [barcodeProduct, setBarcodeProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filterPrescription, setFilterPrescription] = useState('all');
    const [filterManufacturer, setFilterManufacturer] = useState('all');
    const [qrCodeUrl, setQrCodeUrl] = useState(null);
    const [barcodeLoading, setBarcodeLoading] = useState(false);
    const [barcodeSize, setBarcodeSize] = useState(300);
    const [copied, setCopied] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        gtin: '',
        product_name: '',
        manufacturer: '',
        strength: '',
        dosage_form: '',
        pack_size: '',
        prescription_required: false
    });

    const manufacturers = [...new Set(products.map(p => p.manufacturer).filter(Boolean))];

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        filterProducts();
    }, [searchTerm, products, filterPrescription, filterManufacturer]);

    const fetchProducts = async () => {
        try {
            const response = await getProducts();
            setProducts(response.data);
            setFilteredProducts(response.data);
        } catch (error) {
            console.error('Failed to fetch products:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterProducts = () => {
        let filtered = [...products];
        
        if (searchTerm.trim()) {
            filtered = filtered.filter(p => 
                p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.gtin?.includes(searchTerm) ||
                p.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        if (filterPrescription !== 'all') {
            filtered = filtered.filter(p => p.prescription_required === (filterPrescription === 'required'));
        }
        
        if (filterManufacturer !== 'all') {
            filtered = filtered.filter(p => p.manufacturer === filterManufacturer);
        }
        
        setFilteredProducts(filtered);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingProduct) {
                await updateProduct(editingProduct.id, formData);
            } else {
                await createProduct(formData);
            }
            setShowModal(false);
            setEditingProduct(null);
            setFormData({
                gtin: '',
                product_name: '',
                manufacturer: '',
                strength: '',
                dosage_form: '',
                pack_size: '',
                prescription_required: false
            });
            fetchProducts();
        } catch (error) {
            alert(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async () => {
        if (!deletingProduct) return;
        try {
            await deleteProduct(deletingProduct.id);
            setShowDeleteModal(false);
            setDeletingProduct(null);
            fetchProducts();
        } catch (error) {
            alert('Failed to delete product');
        }
    };

    const generateSampleBarcode = async (product) => {
        setBarcodeLoading(true);
        setBarcodeProduct(product);
        try {
            const sampleSerial = `${product.gtin.slice(-6)}SAMPLE001`;
            const sampleBatch = 'BATCH001';
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 2);
            const expiryFormatted = expiryDate.toISOString().split('T')[0].replace(/-/g, '');
            
            const gs1Data = `(01)${product.gtin}(21)${sampleSerial}(10)${sampleBatch}(17)${expiryFormatted}`;
            const url = await QRCode.toDataURL(gs1Data, {
                width: barcodeSize,
                margin: 2,
                errorCorrectionLevel: 'H',
                color: { dark: '#000000', light: '#FFFFFF' }
            });
            setQrCodeUrl(url);
            setShowBarcodeModal(true);
        } catch (err) {
            console.error('Barcode generation failed:', err);
            alert('Failed to generate barcode');
        } finally {
            setBarcodeLoading(false);
        }
    };

    const downloadBarcode = () => {
        if (!qrCodeUrl) return;
        const link = document.createElement('a');
        link.download = `barcode_${barcodeProduct?.gtin}.png`;
        link.href = qrCodeUrl;
        link.click();
    };

    const printBarcode = () => {
        if (!qrCodeUrl || !barcodeProduct) return;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Print Barcode - ${barcodeProduct.product_name}</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: Arial, sans-serif; background: white; }
                        .barcode-container { text-align: center; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: white; }
                        .barcode-image { width: 300px; height: 300px; margin: 0 auto; }
                        .product-name { font-size: 14px; font-weight: bold; margin-top: 15px; }
                        .details { font-size: 12px; margin-top: 10px; color: #555; }
                        .details p { margin: 5px 0; }
                        @media print { body { margin: 0; padding: 0; } .barcode-container { border: none; } }
                    </style>
                </head>
                <body>
                    <div class="barcode-container">
                        <img class="barcode-image" src="${qrCodeUrl}" />
                        <div class="product-name">${barcodeProduct.product_name}</div>
                        <div class="details">
                            <p><strong>GTIN:</strong> ${barcodeProduct.gtin}</p>
                            <p><strong>Manufacturer:</strong> ${barcodeProduct.manufacturer || 'N/A'}</p>
                            <p><strong>Strength:</strong> ${barcodeProduct.strength || 'N/A'}</p>
                        </div>
                    </div>
                    <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const copyToClipboard = () => {
        if (!barcodeProduct) return;
        const sampleSerial = `${barcodeProduct.gtin.slice(-6)}SAMPLE001`;
        const sampleBatch = 'BATCH001';
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 2);
        const expiryFormatted = expiryDate.toISOString().split('T')[0].replace(/-/g, '');
        const gs1Data = `(01)${barcodeProduct.gtin}(21)${sampleSerial}(10)${sampleBatch}(17)${expiryFormatted}`;
        navigator.clipboard.writeText(gs1Data);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilterPrescription('all');
        setFilterManufacturer('all');
    };

    const canEdit = user?.role === 'admin' || user?.role === 'importer';

    if (loading) {
        return <PageLoader />;
    }

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-16">
            {/* Header */}
            <div className="bg-blue-600 dark:bg-blue-700 text-white p-4 flex items-center gap-3 sticky top-0 z-10">
                <button onClick={() => navigate('/dashboard')} className="p-1 hover:bg-blue-700 dark:hover:bg-blue-800 rounded-lg">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold flex-1">Products</h1>
                <button onClick={() => setShowFilters(!showFilters)} className="p-2 hover:bg-blue-700 dark:hover:bg-blue-800 rounded-lg">
                    <Filter className="w-5 h-5" />
                </button>
                {canEdit && (
                    <button 
                        onClick={() => {
                            setEditingProduct(null);
                            setFormData({
                                gtin: '',
                                product_name: '',
                                manufacturer: '',
                                strength: '',
                                dosage_form: '',
                                pack_size: '',
                                prescription_required: false
                            });
                            setShowModal(true);
                        }}
                        className="bg-white dark:bg-gray-100 text-blue-600 dark:text-blue-700 p-2 rounded-full"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="p-4">
                {/* Search Bar */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, GTIN, or manufacturer..."
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    )}
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 shadow-md border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
                            <button onClick={clearFilters} className="text-sm text-blue-600 dark:text-blue-400">Clear All</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label text-xs">Prescription Required</label>
                                <select className="input text-sm" value={filterPrescription} onChange={(e) => setFilterPrescription(e.target.value)}>
                                    <option value="all">All</option>
                                    <option value="required">Required</option>
                                    <option value="not_required">Not Required</option>
                                </select>
                            </div>
                            <div>
                                <label className="label text-xs">Manufacturer</label>
                                <select className="input text-sm" value={filterManufacturer} onChange={(e) => setFilterManufacturer(e.target.value)}>
                                    <option value="all">All Manufacturers</option>
                                    {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats Summary */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm">
                        <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{products.length}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm">
                        <p className="text-xl font-bold text-green-600 dark:text-green-400">{products.filter(p => p.is_active !== false).length}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm">
                        <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{filteredProducts.length}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Showing</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm">
                        <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{products.filter(p => p.prescription_required).length}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Rx Required</p>
                    </div>
                </div>

                {/* Products List */}
                {filteredProducts.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center shadow-sm">
                        <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">No products found</p>
                        {canEdit && (
                            <button onClick={() => setShowModal(true)} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg">
                                Add First Product
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredProducts.map((product) => (
                            <div key={product.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{product.product_name}</h3>
                                            {product.prescription_required && (
                                                <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs px-2 py-1 rounded-full">Rx Required</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">GTIN: {product.gtin}</p>
                                        {product.manufacturer && (
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{product.manufacturer}</p>
                                        )}
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {product.strength && (
                                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-full">{product.strength}</span>
                                            )}
                                            {product.dosage_form && (
                                                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs px-2 py-1 rounded-full">{product.dosage_form}</span>
                                            )}
                                            {product.pack_size && (
                                                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs px-2 py-1 rounded-full">Pack: {product.pack_size}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setViewingProduct(product); setShowViewModal(true); }} 
                                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="View Details">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => generateSampleBarcode(product)} 
                                            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition" title="Generate Barcode">
                                            <QrCode className="w-4 h-4" />
                                        </button>
                                        {canEdit && (
                                            <>
                                                <button onClick={() => { setEditingProduct(product); setFormData({...product, pack_size: product.pack_size || ''}); setShowModal(true); }} 
                                                    className="p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition" title="Edit">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => { setDeletingProduct(product); setShowDeleteModal(true); }} 
                                                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Product Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 max-h-screen overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingProduct ? 'Edit Product' : 'Add New Product'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 dark:text-gray-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label">GTIN (14 digits) *</label>
                                <input type="text" className="input" 
                                    placeholder="06130000010001" maxLength="14" pattern="\d{14}"
                                    value={formData.gtin} onChange={(e) => setFormData({...formData, gtin: e.target.value})} required disabled={!!editingProduct} />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Unique 14-digit Global Trade Item Number</p>
                            </div>
                            <div>
                                <label className="label">Product Name *</label>
                                <input type="text" className="input" 
                                    placeholder="Paracetamol 500mg"
                                    value={formData.product_name} onChange={(e) => setFormData({...formData, product_name: e.target.value})} required />
                            </div>
                            <div>
                                <label className="label">Manufacturer</label>
                                <input type="text" className="input" 
                                    placeholder="Ethio Pharma PLC"
                                    value={formData.manufacturer} onChange={(e) => setFormData({...formData, manufacturer: e.target.value})} />
                            </div>
                            <div>
                                <label className="label">Strength</label>
                                <input type="text" className="input" 
                                    placeholder="500mg"
                                    value={formData.strength} onChange={(e) => setFormData({...formData, strength: e.target.value})} />
                            </div>
                            <div>
                                <label className="label">Dosage Form</label>
                                <select className="input" 
                                    value={formData.dosage_form} onChange={(e) => setFormData({...formData, dosage_form: e.target.value})}>
                                    <option value="">Select dosage form</option>
                                    <option value="Tablet">Tablet</option>
                                    <option value="Capsule">Capsule</option>
                                    <option value="Syrup">Syrup</option>
                                    <option value="Injection">Injection</option>
                                    <option value="Cream">Cream</option>
                                    <option value="Ointment">Ointment</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Pack Size</label>
                                <input type="number" className="input" 
                                    placeholder="100" value={formData.pack_size} onChange={(e) => setFormData({...formData, pack_size: e.target.value})} />
                            </div>
                            <div>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" checked={formData.prescription_required} onChange={(e) => setFormData({...formData, prescription_required: e.target.checked})} className="w-4 h-4" />
                                    <span className="label mb-0">Prescription Required</span>
                                </label>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border rounded-xl py-2">Cancel</button>
                                <button type="submit" className="flex-1 bg-blue-600 text-white rounded-xl py-2">
                                    {editingProduct ? 'Update Product' : 'Add Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Product Modal */}
            {showViewModal && viewingProduct && (
                <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Product Details</h2>
                            <button onClick={() => setShowViewModal(false)} className="text-gray-500 dark:text-gray-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">GTIN</p>
                                <p className="font-mono text-lg text-gray-900 dark:text-white">{viewingProduct.gtin}</p>
                            </div>
                            <div className="border-b dark:border-gray-700 pb-2">
                                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Product Name</p>
                                <p className="text-base text-gray-900 dark:text-white">{viewingProduct.product_name}</p>
                            </div>
                            {viewingProduct.manufacturer && (
                                <div className="border-b dark:border-gray-700 pb-2">
                                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Manufacturer</p>
                                    <p className="text-base text-gray-900 dark:text-white">{viewingProduct.manufacturer}</p>
                                </div>
                            )}
                            {viewingProduct.strength && (
                                <div className="border-b dark:border-gray-700 pb-2">
                                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Strength</p>
                                    <p className="text-base text-gray-900 dark:text-white">{viewingProduct.strength}</p>
                                </div>
                            )}
                            {viewingProduct.dosage_form && (
                                <div className="border-b dark:border-gray-700 pb-2">
                                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Dosage Form</p>
                                    <p className="text-base text-gray-900 dark:text-white">{viewingProduct.dosage_form}</p>
                                </div>
                            )}
                            {viewingProduct.pack_size && (
                                <div className="border-b dark:border-gray-700 pb-2">
                                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Pack Size</p>
                                    <p className="text-base text-gray-900 dark:text-white">{viewingProduct.pack_size}</p>
                                </div>
                            )}
                            <div className="border-b dark:border-gray-700 pb-2">
                                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Prescription Required</p>
                                <p className="text-base text-gray-900 dark:text-white">{viewingProduct.prescription_required ? 'Yes' : 'No'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Created At</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(viewingProduct.created_at).toLocaleString()}</p>
                            </div>
                        </div>
                        <button onClick={() => setShowViewModal(false)} className="bg-blue-600 text-white rounded-xl py-2 w-full mt-6">Close</button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && deletingProduct && (
                <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-6 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Delete Product</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Are you sure you want to delete "{deletingProduct.product_name}"?
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteModal(false)} className="flex-1 border rounded-xl py-2">Cancel</button>
                            <button onClick={handleDelete} className="flex-1 bg-red-600 text-white rounded-xl py-2">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Barcode Generation Modal */}
            {showBarcodeModal && barcodeProduct && (
                <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">GS1 Barcode</h2>
                            <button onClick={() => { setShowBarcodeModal(false); setQrCodeUrl(null); setBarcodeProduct(null); }} className="text-gray-500 dark:text-gray-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="text-center">
                            <div className="mb-4">
                                <label className="label">Barcode Size</label>
                                <div className="flex gap-2 justify-center">
                                    {[200, 300, 400, 500].map(size => (
                                        <button key={size} onClick={() => setBarcodeSize(size)} 
                                            className={`px-3 py-1 rounded-lg text-sm ${barcodeSize === size ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                                            {size}px
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {barcodeLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                </div>
                            ) : qrCodeUrl ? (
                                <>
                                    <img src={qrCodeUrl} alt="GS1 Barcode" className="mx-auto my-4 border rounded-lg shadow-lg" style={{ width: barcodeSize, height: barcodeSize }} />
                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <button onClick={downloadBarcode} className="bg-blue-600 text-white py-2 rounded-xl flex items-center justify-center gap-2">
                                            <Download className="w-4 h-4" /> Download
                                        </button>
                                        <button onClick={printBarcode} className="border border-blue-600 text-blue-600 dark:text-blue-400 py-2 rounded-xl flex items-center justify-center gap-2">
                                            <Printer className="w-4 h-4" /> Print
                                        </button>
                                    </div>
                                    <div className="mt-4">
                                        <button onClick={copyToClipboard} className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
                                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                            {copied ? 'Copied!' : 'Copy GS1 Data'}
                                        </button>
                                    </div>
                                    <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Sample GS1 Format (Example Data)</p>
                                        <p className="text-xs font-mono break-all text-gray-700 dark:text-gray-300">
                                            (01){barcodeProduct.gtin}(21){barcodeProduct.gtin.slice(-6)}SAMPLE001
                                        </p>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Products;