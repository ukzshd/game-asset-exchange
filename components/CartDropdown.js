'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import useCartStore from '@/store/cartStore';
import useCurrencyStore from '@/store/currencyStore';
import styles from './CartDropdown.module.css';

export default function CartDropdown({ onClose }) {
    const { items, removeItem, updateQuantity, clearCart, getSubtotal } = useCartStore();
    const { formatPrice } = useCurrencyStore();

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <>
            <div className={styles.overlay} onClick={onClose} />
            <div className={styles.dropdown}>
                <div className={styles.header}>
                    <h3>Shopping Cart ({items.length})</h3>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                {items.length === 0 ? (
                    <div className={styles.empty}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.emptyIcon}>
                            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                            <path d="M3 6h18" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                        <p>Your Shopping Cart Is Empty</p>
                    </div>
                ) : (
                    <>
                        <div className={styles.items}>
                            {items.map((item) => (
                                <div key={item.id} className={styles.item}>
                                    <div className={styles.itemImage}>
                                        <div className={styles.itemImagePlaceholder}>
                                            {item.category?.[0] || '📦'}
                                        </div>
                                    </div>
                                    <div className={styles.itemInfo}>
                                        <span className={styles.itemName}>{item.name}</span>
                                        <div className={styles.itemControls}>
                                            <div className={styles.qtyControl}>
                                                <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button>
                                                <span>{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                                            </div>
                                            <span className={styles.itemPrice}>
                                                {formatPrice(item.price * item.quantity)}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        className={styles.removeBtn}
                                        onClick={() => removeItem(item.id)}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className={styles.footer}>
                            <div className={styles.subtotal}>
                                <span>Total {items.length} items</span>
                                <span className={styles.subtotalPrice}>
                                    Subtotal: {formatPrice(getSubtotal())}
                                </span>
                            </div>
                            <div className={styles.actions}>
                                <button className={styles.clearBtn} onClick={clearCart}>
                                    Clear All
                                </button>
                                <Link href="/cart" className="btn btn-primary btn-full" onClick={onClose}>
                                    Checkout
                                </Link>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
