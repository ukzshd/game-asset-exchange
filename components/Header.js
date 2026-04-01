'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useCartStore from '@/store/cartStore';
import useCurrencyStore from '@/store/currencyStore';
import useLanguageStore from '@/store/languageStore';
import useAuthStore from '@/store/authStore';
import useHydrated from '@/lib/useHydrated';
import { getProductPath } from '@/lib/catalog-shared';
import MegaMenu from './MegaMenu';
import CartDropdown from './CartDropdown';
import AuthModal from './AuthModal';
import styles from './Header.module.css';

export default function Header() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState({ games: [], products: [] });
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
    const [showMegaMenu, setShowMegaMenu] = useState(false);
    const [showCart, setShowCart] = useState(false);
    const [showAuth, setShowAuth] = useState(false);
    const [authTab, setAuthTab] = useState('login');
    const [isScrolled, setIsScrolled] = useState(false);
    const mounted = useHydrated();

    const currencyRef = useRef(null);
    const searchRef = useRef(null);

    const { currency, currencies, setCurrency } = useCurrencyStore();
    const { language, languages, setLanguage, t, initTranslations, isLoaded } = useLanguageStore();
    const getItemCount = useCartStore(state => state.getItemCount);
    const { user, init: initAuth, logout } = useAuthStore();

    useEffect(() => {
        initTranslations();
        initAuth();
        useCurrencyStore.getState().syncRates();
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
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const query = searchQuery.trim();
        if (query.length < 2) {
            setSearchResults({ games: [], products: [] });
            setSearchLoading(false);
            return undefined;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                setSearchLoading(true);
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=6`);
                const payload = await response.json();
                if (!cancelled) {
                    setSearchResults({
                        games: payload.games || [],
                        products: payload.products || [],
                    });
                    setShowSearchResults(true);
                }
            } catch (error) {
                console.error('Header search error:', error);
                if (!cancelled) {
                    setSearchResults({ games: [], products: [] });
                }
            } finally {
                if (!cancelled) {
                    setSearchLoading(false);
                }
            }
        }, 200);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [searchQuery]);

    const currentLang = languages.find(l => l.code === language) || languages[0];

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            setShowSearchResults(false);
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
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
                            <span className={styles.logoSubtext}>I&apos;m Game Gold Master</span>
                        </Link>

                        {/* Search */}
                        <form className={styles.searchBar} onSubmit={handleSearch} ref={searchRef}>
                            <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder={isLoaded ? t('nav.searchPlaceholder') : 'Search your game...'}
                                value={searchQuery}
                                onFocus={() => {
                                    if (searchResults.games.length > 0 || searchResults.products.length > 0) {
                                        setShowSearchResults(true);
                                    }
                                }}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {(showSearchResults || searchLoading) && (
                                <div className={styles.searchResults}>
                                    {searchLoading ? (
                                        <div className={styles.searchStatus}>Searching...</div>
                                    ) : (
                                        <>
                                            {searchResults.games.length > 0 && (
                                                <div className={styles.searchSection}>
                                                    <div className={styles.searchSectionTitle}>Games</div>
                                                    {searchResults.games.map((game) => (
                                                        <Link
                                                            key={game.slug}
                                                            href={`/${game.slug}/${game.primaryCategory}`}
                                                            className={styles.searchResultLink}
                                                            onClick={() => setShowSearchResults(false)}
                                                        >
                                                            <span>{game.icon} {game.name}</span>
                                                            <span className={styles.searchResultMeta}>Game</span>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                            {searchResults.products.length > 0 && (
                                                <div className={styles.searchSection}>
                                                    <div className={styles.searchSectionTitle}>Products</div>
                                                    {searchResults.products.map((product) => (
                                                        <Link
                                                            key={`${product.game_slug}-${product.id}`}
                                                            href={getProductPath(product.game_slug, product)}
                                                            className={styles.searchResultLink}
                                                            onClick={() => setShowSearchResults(false)}
                                                        >
                                                            <span>{product.name}</span>
                                                            <span className={styles.searchResultMeta}>${Number(product.price).toFixed(2)}</span>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                            {searchResults.games.length === 0 && searchResults.products.length === 0 && (
                                                <div className={styles.searchStatus}>No matches found.</div>
                                            )}
                                            <Link
                                                href={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
                                                className={styles.searchAllLink}
                                                onClick={() => setShowSearchResults(false)}
                                            >
                                                View all search results
                                            </Link>
                                        </>
                                    )}
                                </div>
                            )}
                        </form>

                        {/* Right Actions */}
                        <div className={styles.actions}>
                            {/* Currency Selector */}
                            <div className={styles.dropdown} ref={currencyRef}>
                                <button
                                    className={styles.dropdownTrigger}
                                    onClick={() => {
                                        setShowCurrencyDropdown(!showCurrencyDropdown);
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
                            <Link href="/affiliate" className={styles.navLink}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                                {isLoaded ? t('nav.affiliate') : 'Affiliate'}
                            </Link>
                            <Link href="/news" className={styles.navLink}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" />
                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
                                    <path d="M8 7h8" />
                                    <path d="M8 11h8" />
                                    <path d="M8 15h5" />
                                </svg>
                                News
                            </Link>
                            <Link href="/dashboard" className={styles.navLink}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                    <path d="M3 13h8V3H3z" />
                                    <path d="M13 21h8v-6h-8z" />
                                    <path d="M13 3h8v6h-8z" />
                                    <path d="M3 21h8v-6H3z" />
                                </svg>
                                Dashboard
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
