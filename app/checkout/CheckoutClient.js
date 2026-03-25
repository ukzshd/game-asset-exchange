'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import useCartStore from '@/store/cartStore';
import useCurrencyStore from '@/store/currencyStore';
import useAuthStore from '@/store/authStore';
import useHydrated from '@/lib/useHydrated';
import styles from './page.module.css';

export default function CheckoutPage() {
    const searchParams = useSearchParams();
    const { items, getSubtotal, clearCart } = useCartStore();
    const { formatPrice, currency } = useCurrencyStore();
    const { token, init: initAuth } = useAuthStore();
    const mounted = useHydrated();

    const [step, setStep] = useState(1);
    const [orderNo, setOrderNo] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const [deliveryInfo, setDeliveryInfo] = useState({
        embarkId: '',
        characterName: '',
        email: '',
        notes: '',
    });
    const [paymentMethod, setPaymentMethod] = useState('stripe');
    const [agreeTerms, setAgreeTerms] = useState(false);

    useEffect(() => {
        initAuth();
    }, [initAuth]);

    useEffect(() => {
        const paymentStatus = searchParams.get('payment');
        const orderId = searchParams.get('orderId');
        const sessionId = searchParams.get('session_id');
        const provider = searchParams.get('provider') || 'stripe';
        const paypalToken = searchParams.get('token');
        const effectiveSessionId = sessionId || paypalToken;
        if (!mounted || !token || !orderId || paymentStatus !== 'success' || !effectiveSessionId) return;

        let cancelled = false;
        const confirmPayment = async () => {
            setStatusMessage('Confirming your payment...');
            try {
                const res = await fetch('/api/payments/confirm', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ orderId, sessionId: effectiveSessionId, paymentMethod: provider }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Payment confirmation failed');
                if (!cancelled) {
                    setOrderNo(data.order.order_no);
                    setStep(3);
                    setStatusMessage('Payment confirmed.');
                    clearCart();
                }
            } catch (error) {
                if (!cancelled) {
                    setStatusMessage(error.message || 'Payment confirmation failed');
                }
            }
        };

        confirmPayment();
        return () => {
            cancelled = true;
        };
    }, [mounted, token, searchParams, clearCart]);

    useEffect(() => {
        const paymentStatus = searchParams.get('payment');
        const provider = searchParams.get('provider') || 'payment';
        if (paymentStatus === 'cancelled') {
            setStatusMessage(`${provider === 'paypal' ? 'PayPal' : 'Stripe'} checkout was cancelled. You can retry payment below.`);
            setStep(2);
        }
    }, [searchParams]);

    const subtotal = getSubtotal();

    const handlePlaceOrder = async () => {
        if (!deliveryInfo.embarkId || !deliveryInfo.email || !agreeTerms) {
            alert('Please fill in all required fields and agree to the terms.');
            return;
        }
        if (!token) {
            alert('Please log in to place an order.');
            return;
        }
        setSubmitting(true);
        setStatusMessage('Creating your order...');
        try {
            const orderRes = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    items: items.map((item) => ({ id: item.id, productId: item.id, name: item.name, quantity: item.quantity })),
                    embarkId: deliveryInfo.embarkId,
                    characterName: deliveryInfo.characterName,
                    email: deliveryInfo.email,
                    paymentMethod,
                    notes: deliveryInfo.notes,
                    currency,
                }),
            });
            const orderData = await orderRes.json();
            if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order');

            setStatusMessage(`Redirecting to ${paymentMethod === 'paypal' ? 'PayPal' : 'Stripe'}...`);
            const payRes = await fetch('/api/payments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ orderId: orderData.order.id, paymentMethod }),
            });
            const payData = await payRes.json();
            if (!payRes.ok) throw new Error(payData.error || 'Failed to initialize payment');
            if (!payData.checkoutUrl) throw new Error('Missing payment checkout URL');

            window.location.href = payData.checkoutUrl;
        } catch (error) {
            alert(error.message || 'Failed to place order');
            setStatusMessage(error.message || 'Failed to place order');
        } finally {
            setSubmitting(false);
        }
    };

    if (!mounted) {
        return <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>Loading...</div>;
    }

    if (items.length === 0 && step !== 3) {
        return (
            <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
                <h1>Your cart is empty</h1>
                <Link href="/" className="btn btn-primary" style={{ marginTop: '24px', display: 'inline-flex' }}>
                    ← Continue Shopping
                </Link>
            </div>
        );
    }

    return (
        <div className={styles.checkoutPage}>
            <div className="container">
                <h1 className={styles.title}>Checkout</h1>
                {statusMessage && (
                    <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(24, 160, 251, 0.12)', color: 'var(--accent-cyan)' }}>
                        {statusMessage}
                    </div>
                )}

                <div className={styles.steps}>
                    {['Delivery Info', 'Payment', 'Complete'].map((label, i) => (
                        <div key={label} className={`${styles.step} ${step >= i + 1 ? styles.stepActive : ''} ${step > i + 1 ? styles.stepDone : ''}`}>
                            <div className={styles.stepNumber}>{step > i + 1 ? '✓' : i + 1}</div>
                            <span>{label}</span>
                        </div>
                    ))}
                </div>

                {step === 3 ? (
                    <div className={styles.completePage}>
                        <div className={styles.completeIcon}>✅</div>
                        <h2>Order Placed Successfully</h2>
                        {orderNo && <p className={styles.completeNote}>Order No: {orderNo}</p>}
                        <p>Your payment has been confirmed. Our operations team will assign the delivery and contact you with the in-game handoff details.</p>
                        <p className={styles.completeNote}>Please keep your game account available and monitor your email for delivery updates.</p>
                        <div className={styles.completeActions}>
                            <Link href="/dashboard" className="btn btn-primary">View My Orders</Link>
                            <Link href="/" className="btn btn-secondary">Continue Shopping</Link>
                        </div>
                    </div>
                ) : (
                    <div className={styles.checkoutLayout}>
                        <div className={styles.formSection}>
                            {step === 1 && (
                                <div className={styles.formCard}>
                                    <h2 className={styles.formTitle}>Delivery Information</h2>
                                    <div className={styles.formGrid}>
                                        <div className={styles.field}>
                                            <label>Embark ID *</label>
                                            <input
                                                type="text"
                                                placeholder="Enter your Embark ID"
                                                value={deliveryInfo.embarkId}
                                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, embarkId: e.target.value })}
                                                className={styles.input}
                                                required
                                            />
                                        </div>
                                        <div className={styles.field}>
                                            <label>Character Name</label>
                                            <input
                                                type="text"
                                                placeholder="Your in-game character name"
                                                value={deliveryInfo.characterName}
                                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, characterName: e.target.value })}
                                                className={styles.input}
                                            />
                                        </div>
                                        <div className={styles.field}>
                                            <label>Email Address *</label>
                                            <input
                                                type="email"
                                                placeholder="your@email.com"
                                                value={deliveryInfo.email}
                                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, email: e.target.value })}
                                                className={styles.input}
                                                required
                                            />
                                        </div>
                                        <div className={`${styles.field} ${styles.fullWidth}`}>
                                            <label>Order Notes</label>
                                            <textarea
                                                placeholder="Any special instructions..."
                                                value={deliveryInfo.notes}
                                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, notes: e.target.value })}
                                                className={styles.textarea}
                                                rows={3}
                                            />
                                        </div>
                                    </div>
                                    <button className="btn btn-primary btn-lg" onClick={() => setStep(2)}>
                                        Continue to Payment →
                                    </button>
                                </div>
                            )}

                            {step === 2 && (
                                <div className={styles.formCard}>
                                    <h2 className={styles.formTitle}>Payment Method</h2>
                                    <div className={styles.paymentOptions}>
                                        <label className={`${styles.paymentOption} ${paymentMethod === 'stripe' ? styles.paymentActive : ''}`}>
                                            <input type="radio" name="payment" value="stripe" checked={paymentMethod === 'stripe'} onChange={() => setPaymentMethod('stripe')} />
                                            <div className={styles.paymentIcon}>💳</div>
                                            <div>
                                                <h4>Credit / Debit Card</h4>
                                                <p>Secure hosted checkout via Stripe</p>
                                            </div>
                                        </label>
                                        <label className={`${styles.paymentOption} ${paymentMethod === 'paypal' ? styles.paymentActive : ''}`}>
                                            <input type="radio" name="payment" value="paypal" checked={paymentMethod === 'paypal'} onChange={() => setPaymentMethod('paypal')} />
                                            <div className={styles.paymentIcon}>🅿️</div>
                                            <div>
                                                <h4>PayPal</h4>
                                                <p>Redirect to PayPal approval and capture on return</p>
                                            </div>
                                        </label>
                                    </div>

                                    <div className={styles.paypalSection}>
                                        <p>Clicking <strong>Pay Now</strong> will redirect you to a secure Stripe-hosted payment page. Card details are not handled by this site directly.</p>
                                    </div>

                                    <div className={styles.termsRow}>
                                        <label className={styles.checkbox}>
                                            <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
                                            <span>I agree to the <Link href="/terms">Terms and Conditions</Link> and <Link href="/privacy-policy">Privacy Policy</Link></span>
                                        </label>
                                    </div>

                                    <div className={styles.formActions}>
                                        <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
                                        <button className="btn btn-primary btn-lg" onClick={handlePlaceOrder} disabled={submitting}>
                                            {submitting ? 'Redirecting...' : 'Pay Now'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={styles.orderSummary}>
                            <h3>Order Summary</h3>
                            <div className={styles.summaryItems}>
                                {items.map((item) => (
                                    <div key={item.id} className={styles.summaryItem}>
                                        <span className={styles.summaryItemName}>{item.name} ×{item.quantity}</span>
                                        <span>{formatPrice(item.price * item.quantity)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.summaryDivider}></div>
                            <div className={styles.summaryTotal}>
                                <span>Total</span>
                                <span className={styles.totalPrice}>{formatPrice(subtotal)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
