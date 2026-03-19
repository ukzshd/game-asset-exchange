'use client';

import { useState } from 'react';
import Link from 'next/link';
import useCurrencyStore from '@/store/currencyStore';
import useCartStore from '@/store/cartStore';
import { getProductIcon, getProductPath } from '@/lib/catalog-shared';
import styles from './ProductCard.module.css';

export default function ProductCard({ product, gameSlug }) {
    const [quantity, setQuantity] = useState(1);
    const [showDesc, setShowDesc] = useState(false);
    const { formatPrice } = useCurrencyStore();
    const { addItem } = useCartStore();
    const productPath = gameSlug ? getProductPath(gameSlug, product) : null;
    const originalPrice = product.originalPrice || product.original_price || 0;
    const isBundle = product.isBundle || product.is_bundle;

    const handleQtyChange = (delta) => {
        setQuantity(prev => Math.max(1, prev + delta));
    };

    const handleBuyNow = () => {
        addItem(product, quantity);
        // In a real app, redirect to checkout
        window.location.href = '/cart';
    };

    const handleAddToCart = () => {
        addItem(product, quantity);
    };

    return (
        <div className={styles.card}>
            {/* Discount Badge */}
            {product.discount && (
                <div className={styles.discountBadge}>-{product.discount}%</div>
            )}

            {/* Image */}
            {productPath ? (
                <Link href={productPath} className={styles.imageWrap}>
                    <div className={styles.imagePlaceholder}>
                        <div className={styles.imageIcon}>{getProductIcon(product.category)}</div>
                        {isBundle && (
                            <span className={styles.bundleTag}>BUNDLE</span>
                        )}
                    </div>
                </Link>
            ) : (
                <div className={styles.imageWrap} onClick={() => setShowDesc(!showDesc)}>
                    <div className={styles.imagePlaceholder}>
                        <div className={styles.imageIcon}>{getProductIcon(product.category)}</div>
                        {isBundle && (
                            <span className={styles.bundleTag}>BUNDLE</span>
                        )}
                    </div>
                </div>
            )}

            {/* Description Tooltip */}
            {showDesc && product.items && (
                <div className={styles.descPopup}>
                    <div className={styles.descTitle}>Product Description</div>
                    <div className={styles.descItems}>
                        {product.items.map((item, i) => (
                            <span key={i} className={styles.descItem}>{item}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Name */}
            {productPath ? (
                <Link href={productPath} className={styles.nameLink}>
                    <h3 className={styles.name} title={product.name}>
                        {product.name}
                    </h3>
                </Link>
            ) : (
                <h3 className={styles.name} title={product.name}>
                    {product.name}
                </h3>
            )}

            {/* Quantity */}
            <div className={styles.qtyRow}>
                <button className={styles.qtyBtn} onClick={() => handleQtyChange(-1)}>−</button>
                <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className={styles.qtyInput}
                    min="1"
                />
                <button className={styles.qtyBtn} onClick={() => handleQtyChange(1)}>+</button>
            </div>

            {/* Price */}
            <div className={styles.priceRow}>
                <span className={styles.price}>{formatPrice(product.price)}</span>
                {originalPrice > 0 && originalPrice !== product.price && (
                    <span className={styles.originalPrice}>{formatPrice(originalPrice)}</span>
                )}
            </div>

            {/* Actions */}
            <div className={styles.actions}>
                <button className={styles.buyBtn} onClick={handleBuyNow}>
                    Buy Now
                </button>
                <button className={styles.addBtn} onClick={handleAddToCart}>
                    Add To Cart
                </button>
            </div>
        </div>
    );
}
