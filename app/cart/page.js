'use client';

import { useState } from 'react';
import Link from 'next/link';
import useCartStore from '@/store/cartStore';
import useCurrencyStore from '@/store/currencyStore';
import useHydrated from '@/lib/useHydrated';
import styles from './page.module.css';

export default function CartPage() {
    const { items, removeItem, updateQuantity, clearCart, getSubtotal } = useCartStore();
    const { formatPrice } = useCurrencyStore();
    const [couponCode, setCouponCode] = useState('');
    const [couponApplied, setCouponApplied] = useState(false);
    const mounted = useHydrated();

    const subtotal = getSubtotal();
    const discount = couponApplied ? subtotal * 0.08 : 0;
    const total = subtotal - discount;

    const handleApplyCoupon = () => {
        if (couponCode.toUpperCase() === 'ARC8') {
            setCouponApplied(true);
        }
    };

    if (!mounted) {
        return <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>Loading...</div>;
    }

    return (
        <div className={styles.cartPage}>
            <div className="container">
                <h1 className={styles.title}>Shopping Cart</h1>

                {items.length === 0 ? (
                    <div className={styles.emptyCart}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.emptyIcon}>
                            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                            <path d="M3 6h18" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                        <h2>Your cart is empty</h2>
                        <p>Browse our games and find something you like!</p>
                        <Link href="/" className="btn btn-primary">
                            ← Continue Shopping
                        </Link>
                    </div>
                ) : (
                    <div className={styles.cartLayout}>
                        {/* Cart Items */}
                        <div className={styles.cartItems}>
                            <div className={styles.cartHeader}>
                                <span>Product</span>
                                <span>Price</span>
                                <span>Quantity</span>
                                <span>Total</span>
                                <span></span>
                            </div>
                            {items.map((item) => (
                                <div key={item.id} className={styles.cartItem}>
                                    <div className={styles.itemProduct}>
                                        <div className={styles.itemImage}>📦</div>
                                        <div className={styles.itemDetails}>
                                            <h3>{item.name}</h3>
                                            <span className={styles.itemCategory}>{item.category}</span>
                                        </div>
                                    </div>
                                    <div className={styles.itemPrice}>
                                        {formatPrice(item.price)}
                                    </div>
                                    <div className={styles.itemQty}>
                                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button>
                                        <span>{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                                    </div>
                                    <div className={styles.itemTotal}>
                                        {formatPrice(item.price * item.quantity)}
                                    </div>
                                    <button className={styles.removeBtn} onClick={() => removeItem(item.id)}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                            <div className={styles.cartActions}>
                                <button className={styles.clearBtn} onClick={clearCart}>Clear All</button>
                                <Link href="/" className={styles.continueLink}>← Continue Shopping</Link>
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div className={styles.orderSummary}>
                            <h2 className={styles.summaryTitle}>Order Summary</h2>
                            <div className={styles.summaryRow}>
                                <span>Subtotal ({items.length} items)</span>
                                <span>{formatPrice(subtotal)}</span>
                            </div>
                            {couponApplied && (
                                <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                                    <span>Discount (ARC8 - 8%)</span>
                                    <span>-{formatPrice(discount)}</span>
                                </div>
                            )}
                            <div className={styles.couponRow}>
                                <input
                                    type="text"
                                    placeholder="Coupon Code"
                                    value={couponCode}
                                    onChange={(e) => setCouponCode(e.target.value)}
                                    className={styles.couponInput}
                                />
                                <button className={styles.couponBtn} onClick={handleApplyCoupon}>Apply</button>
                            </div>
                            <div className={styles.summaryDivider}></div>
                            <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                                <span>Total</span>
                                <span className={styles.totalPrice}>{formatPrice(total)}</span>
                            </div>
                            <Link href="/checkout" className="btn btn-primary btn-full btn-lg">
                                Proceed to Checkout
                            </Link>
                            <div className={styles.paymentIcons}>
                                <span>💳</span>
                                <span>🅿️</span>
                                <span>🔒</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
