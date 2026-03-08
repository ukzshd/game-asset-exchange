'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import useCartStore from '@/store/cartStore';
import useCurrencyStore from '@/store/currencyStore';
import useLanguageStore from '@/store/languageStore';
import useAuthStore from '@/store/authStore';
import MegaMenu from './MegaMenu';
import CartDropdown from './CartDropdown';
import AuthModal from './AuthModal';
import styles from './Header.module.css';

export default function Header() {
    const [searchQuery, setSearchQuery] = useState('');
    const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
    const [showMegaMenu, setShowMegaMenu] = useState(false);
    const [showCart, setShowCart] = useState(false);
    const [showAuth, setShowAuth] = useState(false);
    const [authTab, setAuthTab] = useState('login');
    const [isScrolled, setIsScrolled] = useState(false);
    const [mounted, setMounted] = useState(false);

    const currencyRef = useRef(null);
    const languageRef = useRef(null);

    const { currency, currencies, setCurrency, getCurrentCurrency } = useCurrencyStore();
    const { language, languages, setLanguage, t, initTranslations, isLoaded } = useLanguageStore();
    const getItemCount = useCartStore(state => state.getItemCount);
    const { user, init: initAuth, logout } = useAuthStore();

    useEffect(() => {
        setMounted(true);
        initTranslations();
        initAuth();
    }, [initTranslations, initAuth]);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (currencyRef.current && !currencyRef.current.contains(e.target)) {
                setShowCurrencyDropdown(false);
            }
            if (languageRef.current && !languageRef.current.contains(e.target)) {
                setShowLanguageDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentCurrency = getCurrentCurrency();
    const currentLang = languages.find(l => l.code === language) || languages[0];

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            // Search functionality
            console.log('Search:', searchQuery);
        }
    };

    return (
        <>
            <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
                <div className={styles.topBar}>
                    <div className={`container ${styles.topBarContent}`}>
                        {/* Logo */}
                        <Link href="/" className={styles.logo}>
                            <div className={styles.logoIcon}>
                                <span className={styles.logoI}>i</span>
                                <span className={styles.logoG}>G</span>
                                <span className={styles.logoG2}>G</span>
                                <span className={styles.logoM}>M</span>
                            </div>
                            <span className={styles.logoSubtext}>I'm Game Gold Master</span>
                        </Link>

                        {/* Search */}
                        <form className={styles.searchBar} onSubmit={handleSearch}>
                            <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder={isLoaded ? t('nav.searchPlaceholder') : 'Search your game...'}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </form>

                        {/* Right Actions */}
                        <div className={styles.actions}>
                            {/* Currency Selector */}
                            <div className={styles.dropdown} ref={currencyRef}>
                                <button
                                    className={styles.dropdownTrigger}
                                    onClick={() => {
                                        setShowCurrencyDropdown(!showCurrencyDropdown);
                                        setShowLanguageDropdown(false);
                                    }}
                                >
                                    <span className={styles.flagIcon}>🇺🇸</span>
                                    <span>{mounted ? currency : 'USD'}</span>
                                    <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="m6 9 6 6 6-6" />
                                    </svg>
                                </button>
                                {showCurrencyDropdown && (
                                    <div className={styles.dropdownMenu}>
                                        {/* Language Section */}
                                        <div className={styles.dropdownSection}>
                                            <div className={styles.dropdownSectionTitle}>{currentLang.name}</div>
                                            <div className={styles.dropdownGrid}>
                                                {languages.map((lang) => (
                                                    <button
                                                        key={lang.code}
                                                        className={`${styles.dropdownItem} ${language === lang.code ? styles.active : ''}`}
                                                        onClick={() => {
                                                            setLanguage(lang.code);
                                                        }}
                                                    >
                                                        {lang.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Currency Section */}
                                        <div className={styles.dropdownSection}>
                                            <div className={styles.dropdownSectionTitle}>{mounted ? currency : 'USD'}</div>
                                            <div className={styles.dropdownGrid}>
                                                {currencies.map((cur) => (
                                                    <button
                                                        key={cur.code}
                                                        className={`${styles.dropdownItem} ${currency === cur.code ? styles.active : ''}`}
                                                        onClick={() => {
                                                            setCurrency(cur.code);
                                                            setShowCurrencyDropdown(false);
                                                        }}
                                                    >
                                                        <span className={styles.currSymbol}>{cur.symbol}</span>
                                                        <span>{cur.code}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Auth Buttons */}
                            <div className={styles.authButtons}>
                                {mounted && user ? (
                                    <>
                                        <Link href="/dashboard" className={styles.loginBtn}>
                                            👤 {user.username}
                                        </Link>
                                        <button
                                            className={styles.loginBtn}
                                            onClick={logout}
                                        >
                                            Logout
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            className={styles.loginBtn}
                                            onClick={() => { setShowAuth(true); setAuthTab('login'); }}
                                        >
                                            {isLoaded ? t('nav.logIn') : 'Log In'}
                                        </button>
                                        <button
                                            className={`${styles.signupBtn} btn btn-primary btn-sm`}
                                            onClick={() => { setShowAuth(true); setAuthTab('register'); }}
                                        >
                                            {isLoaded ? t('nav.signUp') : 'Sign Up'}
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* Cart */}
                            <button
                                className={styles.cartBtn}
                                onClick={() => setShowCart(!showCart)}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.cartIcon}>
                                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                                    <path d="M3 6h18" />
                                    <path d="M16 10a4 4 0 0 1-8 0" />
                                </svg>
                                <span>{isLoaded ? t('nav.cart') : 'Cart'}</span>
                                <span className={styles.cartBadge}>{mounted ? getItemCount() : 0}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Secondary Navigation */}
                <nav className={styles.secondaryNav}>
                    <div className={`container ${styles.secondaryNavContent}`}>
                        <button
                            className={styles.megaMenuBtn}
                            onClick={() => setShowMegaMenu(!showMegaMenu)}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                <path d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            <span>{isLoaded ? t('nav.chooseGame') : 'CHOOSE YOUR GAME'}</span>
                        </button>
                        <div className={styles.navLinks}>
                            <Link href="/help-center" className={styles.navLink}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                    <path d="M12 17h.01" />
                                </svg>
                                {isLoaded ? t('nav.helpCenter') : 'Help Center'}
                            </Link>
                            <Link href="/affiliate" className={styles.navLink}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                                {isLoaded ? t('nav.affiliate') : 'Affiliate'}
                            </Link>
                            <Link href="/vip" className={styles.navLink}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                                {isLoaded ? t('nav.memberDiscount') : 'Member Discount'}
                            </Link>
                            <Link href="/sell-to-us" className={styles.navLink}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                </svg>
                                {isLoaded ? t('nav.sellToUs') : 'Sell To Us'}
                            </Link>
                            <Link href="/contact-us" className={styles.navLink}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                                {isLoaded ? t('nav.contactUs') : 'Contact Us'}
                            </Link>
                        </div>
                    </div>
                </nav>
            </header>

            {/* Mega Menu Overlay */}
            {showMegaMenu && (
                <MegaMenu onClose={() => setShowMegaMenu(false)} />
            )}

            {/* Cart Dropdown */}
            {showCart && (
                <CartDropdown onClose={() => setShowCart(false)} />
            )}

            {/* Auth Modal */}
            {showAuth && (
                <AuthModal
                    initialTab={authTab}
                    onClose={() => setShowAuth(false)}
                />
            )}
        </>
    );
}
