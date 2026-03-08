import Link from 'next/link';
import gamesData from '@/data/games.json';
import styles from './page.module.css';

export default function Home() {
  const featuredGames = gamesData.filter(g => g.active).slice(0, 8);

  return (
    <div className={styles.home}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Your <span className={styles.heroHighlight}>Trusted</span> Game Trading Platform
            </h1>
            <p className={styles.heroSubtitle}>
              Buy game currency, items & boosting services with instant delivery. 24/7 live support. Secure payments.
            </p>
            <div className={styles.heroBadges}>
              <div className={styles.heroBadge}>
                <span className={styles.badgeIcon}>⚡</span>
                <span>Fast Delivery</span>
              </div>
              <div className={styles.heroBadge}>
                <span className={styles.badgeIcon}>🛡️</span>
                <span>Secure Payment</span>
              </div>
              <div className={styles.heroBadge}>
                <span className={styles.badgeIcon}>💬</span>
                <span>24/7 Support</span>
              </div>
              <div className={styles.heroBadge}>
                <span className={styles.badgeIcon}>⭐</span>
                <span>Trustpilot 4.9</span>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.heroGlow}></div>
      </section>

      {/* Popular Games */}
      <section className={styles.section}>
        <div className="container">
          <h2 className={styles.sectionTitle}>Popular Games</h2>
          <div className={styles.gamesGrid}>
            {featuredGames.map((game) => (
              <Link
                key={game.slug}
                href={`/${game.slug}/${game.categories[0]?.slug || 'items'}`}
                className={styles.gameCard}
              >
                <div className={styles.gameCardIcon}>{game.icon}</div>
                <div className={styles.gameCardInfo}>
                  <h3>{game.name}</h3>
                  <span className={styles.gameCardCategories}>
                    {game.categories.map(c => c.name).join(' • ')}
                  </span>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.gameCardArrow}>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
          <div className={styles.allGamesLink}>
            <Link href="/all-games" className="btn btn-secondary">
              View All Games →
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className={styles.trustSection}>
        <div className="container">
          <h2 className={styles.sectionTitle}>Why Choose IGGM?</h2>
          <div className={styles.trustGrid}>
            <div className={styles.trustCard}>
              <div className={styles.trustIcon}>🚀</div>
              <h3>Lightning Fast Delivery</h3>
              <p>Most orders completed within 5-15 minutes. Our professional team is available 24/7.</p>
            </div>
            <div className={styles.trustCard}>
              <div className={styles.trustIcon}>🔒</div>
              <h3>100% Secure</h3>
              <p>SSL encrypted payments via Stripe & PayPal. Your financial data is always protected.</p>
            </div>
            <div className={styles.trustCard}>
              <div className={styles.trustIcon}>💰</div>
              <h3>Best Prices</h3>
              <p>Competitive pricing across all games. Use coupon codes for extra savings.</p>
            </div>
            <div className={styles.trustCard}>
              <div className={styles.trustIcon}>⭐</div>
              <h3>4.9 Trustpilot Rating</h3>
              <p>Over 10,000+ verified reviews from satisfied customers worldwide.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
