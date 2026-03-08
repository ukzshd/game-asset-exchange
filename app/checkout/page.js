'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useCartStore from '@/store/cartStore';
import useCurrencyStore from '@/store/currencyStore';
import useAuthStore from '@/store/authStore';
import styles from './page.module.css';

export default function CheckoutPage() {
    const { items, getSubtotal, clearCart } = useCartStore();
    const { formatPrice } = useCurrencyStore();
    const { user, token } = useAuthStore();
    const [step, setStep] = useState(1);
    const [mounted, setMounted] = useState(false);
    const [orderNo, setOrderNo] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [deliveryInfo, setDeliveryInfo] = useState({
        embarkId: '',
        characterName: '',
        email: '',
        notes: '',
    });
    const [paymentMethod, setPaymentMethod] = useState('stripe');
    const [agreeTerms, setAgreeTerms] = useState(false);

    useEffect(() => { setMounted(true); }, []);

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
        try {
            // Create order
            const orderRes = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    items: items.map(i => ({ id: i.id, productId: i.id, name: i.name, quantity: i.quantity })),
                    embarkId: deliveryInfo.embarkId,
                    characterName: deliveryInfo.characterName,
                    paymentMethod,
                    notes: deliveryInfo.notes,
                }),
            });
            const orderData = await orderRes.json();
            if (!orderRes.ok) throw new Error(orderData.error);

            // Simulate payment
            const payRes = await fetch('/api/payments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ orderId: orderData.order.id, paymentMethod }),
            });
            const payData = await payRes.json();

            // Confirm payment
            await fetch('/api/payments/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ orderId: orderData.order.id, paymentId: payData.paymentId }),
            });

            setOrderNo(orderData.order.order_no);
            setStep(3);
            clearCart();
        } catch (err) {
            alert(err.message || 'Failed to create order');
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

                {/* Progress Steps */}
                <div className={styles.steps}>
                    {['Delivery Info', 'Payment', 'Complete'].map((label, i) => (
                        <div key={i} className={`${styles.step} ${step >= i + 1 ? styles.stepActive : ''} ${step > i + 1 ? styles.stepDone : ''}`}>
                            <div className={styles.stepNumber}>{step > i + 1 ? '✓' : i + 1}</div>
                            <span>{label}</span>
                        </div>
                    ))}
                </div>

                {step === 3 ? (
                    <div className={styles.completePage}>
                        <div className={styles.completeIcon}>✅</div>
                        <h2>Order Placed Successfully!</h2>
                        {orderNo && <p className={styles.completeNote}>Order No: {orderNo}</p>}
                        <p>Thank you for your purchase. Our team will contact you shortly to arrange delivery.</p>
                        <p className={styles.completeNote}>Please keep your game running and check your in-game messages.</p>
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
                                                <p>Pay securely with Stripe</p>
                                            </div>
                                        </label>
                                        <label className={`${styles.paymentOption} ${paymentMethod === 'paypal' ? styles.paymentActive : ''}`}>
                                            <input type="radio" name="payment" value="paypal" checked={paymentMethod === 'paypal'} onChange={() => setPaymentMethod('paypal')} />
                                            <div className={styles.paymentIcon}>🅿️</div>
                                            <div>
                                                <h4>PayPal</h4>
                                                <p>Pay with your PayPal account</p>
                                            </div>
                                        </label>
                                    </div>

                                    {paymentMethod === 'stripe' && (
                                        <div className={styles.stripeForm}>
                                            <div className={styles.field}>
                                                <label>Card Number</label>
                                                <input type="text" placeholder="4242 4242 4242 4242" className={styles.input} maxLength={19} />
                                            </div>
                                            <div className={styles.stripeRow}>
                                                <div className={styles.field}>
                                                    <label>Expiry</label>
                                                    <input type="text" placeholder="MM/YY" className={styles.input} maxLength={5} />
                                                </div>
                                                <div className={styles.field}>
                                                    <label>CVC</label>
                                                    <input type="text" placeholder="123" className={styles.input} maxLength={4} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {paymentMethod === 'paypal' && (
                                        <div className={styles.paypalSection}>
                                            <p>You will be redirected to PayPal to complete your payment.</p>
                                        </div>
                                    )}

                                    <div className={styles.termsRow}>
                                        <label className={styles.checkbox}>
                                            <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
                                            <span>I agree to the <a href="/terms">Terms and Conditions</a> and <a href="/privacy-policy">Privacy Policy</a></span>
                                        </label>
                                    </div>

                                    <div className={styles.formActions}>
                                        <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
                                        <button className="btn btn-primary btn-lg" onClick={handlePlaceOrder} disabled={submitting}>
                                            {submitting ? 'Processing...' : 'Pay Now'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Order Summary Sidebar */}
                        <div className={styles.orderSummary}>
                            <h3>Order Summary</h3>
                            <div className={styles.summaryItems}>
                                {items.map(item => (
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
