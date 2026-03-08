import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={`container ${styles.content}`}>
                {/* Logo Column */}
                <div className={styles.logoCol}>
                    <div className={styles.logo}>
                        <span className={styles.logoI}>i</span>
                        <span className={styles.logoG}>G</span>
                        <span className={styles.logoG2}>G</span>
                        <span className={styles.logoM}>M</span>
                    </div>
                    <p className={styles.copyright}>
                        Copyright © 2017-2026, Hong Kong Game Bee Technology Co., Limited(Unit D, 16/F, One Capital Place, 18 Luard Road, Wan Chai, Hong Kong), All Rights Reserved.
                    </p>
                </div>

                {/* IGGM Links */}
                <div className={styles.column}>
                    <h4 className={styles.columnTitle}>IGGM</h4>
                    <nav className={styles.columnLinks}>
                        <Link href="/about-us">About Us</Link>
                        <Link href="/aup-policy">AUP Policy</Link>
                        <Link href="/terms">Terms & Conditions</Link>
                        <Link href="/privacy-policy">Privacy Policy</Link>
                        <Link href="/refund-policy">Refund Policy</Link>
                        <Link href="/aml-policy">AML Policy</Link>
                        <Link href="/coupon">Coupon Center</Link>
                    </nav>
                </div>

                {/* Products Column 1 */}
                <div className={styles.column}>
                    <h4 className={styles.columnTitle}>Our Products</h4>
                    <nav className={styles.columnLinks}>
                        <Link href="/poe-2-currency/currency">POE 2 Currency</Link>
                        <Link href="/diablo-4/gold">Diablo 4 Gold</Link>
                        <Link href="/arc-raiders/items">ARC Raiders Items</Link>
                        <Link href="/monopoly-go/partners">Monopoly Go Partners</Link>
                        <Link href="/monopoly-go/racers">Monopoly Go Racers</Link>
                        <Link href="/steal-a-brainrot/items">Steal a Brainrot Brainrots</Link>
                        <Link href="/fc-26-coins/coins">FC 26 Coins</Link>
                    </nav>
                </div>

                {/* Products Column 2 */}
                <div className={styles.column}>
                    <h4 className={styles.columnTitle}>&nbsp;</h4>
                    <nav className={styles.columnLinks}>
                        <Link href="/poe-currency/currency">POE Currency</Link>
                        <Link href="/diablo-4/items">Diablo 4 Items</Link>
                        <Link href="/arc-raiders/items">ARC Raiders BluePrints</Link>
                        <Link href="/monopoly-go/stickers">Monopoly Go Stickers</Link>
                        <Link href="/wow-classic/gold">WoW Midnight Gold</Link>
                        <Link href="/wow-classic/gold">WoW TBC Anniversary Gold</Link>
                        <Link href="/d2-resurrected-items/items">Diablo 2 Resurrected Items</Link>
                    </nav>
                </div>

                {/* Join Us */}
                <div className={styles.column}>
                    <h4 className={styles.columnTitle}>Join Us</h4>
                    <nav className={styles.socialLinks}>
                        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                            Facebook
                        </a>
                        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            Twitter
                        </a>
                        <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                            </svg>
                            Youtube
                        </a>
                        <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                            </svg>
                            Discord
                        </a>
                        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                            </svg>
                            Instagram
                        </a>
                        <a href="https://pinterest.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z" />
                            </svg>
                            Pinterest
                        </a>
                    </nav>
                </div>

                {/* Contact */}
                <div className={styles.column}>
                    <h4 className={styles.columnTitle}>Contact</h4>
                    <div className={styles.contactItems}>
                        <a href="mailto:support@iggm.com" className={styles.contactItem}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                            support@iggm.com
                        </a>
                        <a href="tel:+85295642524" className={styles.contactItem}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            WhatsApp +852 95642524
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
