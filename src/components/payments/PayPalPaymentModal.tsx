import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/priceFormatter';

interface PayPalPaymentModalProps {
    open: boolean;
    amount: number;
    orderTitle: string;
    onClose: () => void;
    onSuccess: (response: any) => void;
    onError: (error: any) => void;
    initiatePayment: (elementId: string) => Promise<void>;
}

export default function PayPalPaymentModal({
    open,
    amount,
    orderTitle,
    onClose,
    onSuccess,
    onError,
    initiatePayment,
}: PayPalPaymentModalProps) {
    const { t, i18n } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const containerId = 'paypal-spb-container';
    const initializedRef = useRef(false);

    const formatCurrency = (value: number) =>
        formatPrice({ amountKRW: value, language: i18n.language }).formatted;

    useEffect(() => {
        if (open && !initializedRef.current) {
            const loadPayPalButtons = async () => {
                setLoading(true);
                setError(null);
                try {
                    await initiatePayment(containerId);
                    initializedRef.current = true;
                } catch (err) {
                    console.error('PayPal initialization failed:', err);
                    setError(err instanceof Error ? err.message : 'Failed to load PayPal buttons');
                    onError(err);
                } finally {
                    setLoading(false);
                }
            };

            loadPayPalButtons();
        }

        // Cleanup function to reset initialization state when modal closes
        if (!open) {
            initializedRef.current = false;
        }
    }, [open, initiatePayment, onError]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden">
                <div className="border-b border-gray-200 px-5 py-4 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">PayPal Payment</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <i className="ri-close-line text-xl"></i>
                    </button>
                </div>

                <div className="px-5 py-6">
                    <div className="mb-6 text-center">
                        <p className="text-sm text-gray-600 mb-1">{orderTitle}</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(amount)}</p>
                    </div>

                    {error ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center text-red-600 text-sm mb-4">
                            {error}
                            <button
                                onClick={onClose}
                                className="block w-full mt-3 px-4 py-2 bg-white border border-red-300 rounded text-red-700 hover:bg-red-50"
                            >
                                Close
                            </button>
                        </div>
                    ) : (
                        <div className="min-h-[150px] flex flex-col items-center justify-center">
                            {loading && (
                                <div className="absolute flex flex-col items-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                                    <p className="text-sm text-gray-500">Loading PayPal...</p>
                                </div>
                            )}
                            <div id={containerId} className="w-full" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
