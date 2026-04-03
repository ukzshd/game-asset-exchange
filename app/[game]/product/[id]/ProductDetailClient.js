'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useCartStore from '@/store/cartStore';
import useCurrencyStore from '@/store/currencyStore';
import styles from './page.module.css';

export default function ProductDetailClient({ product }) {
    const router = useRouter();
    const [quantity, setQuantity] = useState(1);
    const { addItem } = useCartStore();
    const { formatPrice } = useCurrencyStore();
    const isMarketplace = (product.catalogSource || product.catalog_source) === 'marketplace';

    const handleAddToCart = () => {
        const result = addItem(product, quantity);
        if (!result?.ok) {
            window.alert(result?.error || 'Unable to add this item to the cart.');
        }
    };

    const handleBuyNow = () => {
        const result = addItem(product, quantity);
        if (!result?.ok) {
            window.alert(result?.error || 'Unable to add this item to the cart.');
            return;
        }
        router.push('/cart');
    };

    return (
        <div className={styles.purchaseCard}>
            <div className={styles.priceRow}>
                <span className={styles.price}>{formatPrice(product.price)}</span>
                {product.original_price ? (
                    <span className={styles.originalPrice}>{formatPrice(product.original_price)}</span>
                ) : null}
            </div>

            <div className={styles.qtyRow}>
                <button className={styles.qtyBtn} onClick={() => setQuantity((current) => Math.max(1, current - 1))}>−</button>
                <input
                    type="number"
                    min="1"
                    value={quantity}
                    className={styles.qtyInput}
                    onChange={(event) => setQuantity(Math.max(1, Number.parseInt(event.target.value || '1', 10) || 1))}
                />
                <button className={styles.qtyBtn} onClick={() => setQuantity((current) => current + 1)}>+</button>
            </div>

            <div className={styles.actions}>
                <button className={styles.primaryAction} onClick={handleBuyNow} disabled={!product.in_stock}>
                    Buy Now
                </button>
                <button className={styles.secondaryAction} onClick={handleAddToCart} disabled={!product.in_stock}>
                    Add To Cart
                </button>
            </div>
            {isMarketplace ? (
                <p className={styles.purchaseNote}>
                    Marketplace orders stay with one seller per checkout and require buyer confirmation before settlement is released.
                </p>
            ) : null}
        </div>
    );
}
