// client/src/pages/Scanner.js
// Phase 12 P0-1 (Option B): placeholder page.
// Barcode scanning is not yet implemented. This page replaces a previous
// accidental copy of the Stock page. It does not perform scanning,
// verification, or lookup.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Scan, Boxes, AlertTriangle } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';

const Scanner = () => {
    const navigate = useNavigate();

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Scan className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    Barcode Scanner
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Verify pharmaceutical products by scanning GS1 DataMatrix codes.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Not Yet Available
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-gray-700 dark:text-gray-300">
                        Barcode scanning is not yet available in this build. This page is a
                        placeholder and does not perform any scan, verification, or lookup.
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                        When scanning is implemented, it will read a GS1 DataMatrix barcode
                        from the device camera and submit it to the verification endpoint to
                        confirm authenticity, expiry, and recall status.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Until then, product verification can be performed manually by
                        inspecting stock and trace records in the Stock section.
                    </p>
                    <div className="pt-2">
                        <Button
                            variant="primary"
                            icon={Boxes}
                            onClick={() => navigate('/stock')}
                        >
                            Go to Stock
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Scanner;