'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import gamesData from '@/data/games.json';
import styles from './MegaMenu.module.css';

export default function MegaMenu({ onClose }) {
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
            <div className={styles.megaMenu}>
                <div className={`container ${styles.content}`}>
                    <div className={styles.gameGrid}>
                        {gamesData.map((game) => (
                            <Link
                                key={game.slug}
                                href={`/${game.slug}/${game.categories[0]?.slug || 'items'}`}
                                className={styles.gameItem}
                                onClick={onClose}
                            >
                                <span className={styles.gameIcon}>{game.icon}</span>
                                <span className={styles.gameName}>{game.name}</span>
                                {game.slug === 'arc-raiders' && (
                                    <span className={styles.hotBadge}>HOT</span>
                                )}
                            </Link>
                        ))}
                    </div>
                    <Link href="/all-games" className={styles.allGamesLink} onClick={onClose}>
                        All Games &gt;&gt;
                    </Link>
                </div>
            </div>
        </>
    );
}
