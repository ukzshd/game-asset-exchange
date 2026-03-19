'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './SeoContent.module.css';

export default function SeoContent({ gameSlug, gameName, couponCode, couponDiscount }) {
    const [openFaq, setOpenFaq] = useState(null);
    const [articles, setArticles] = useState([]);

    const faqs = [
        {
            q: 'Is it safe to buy blueprints?',
            a: 'Yes, buying blueprints from IGGM is completely safe. We use a secure in-game trading method where our professional players meet you in a safe zone and drop the items for you to pick up. We have completed thousands of successful trades with a 99.9% satisfaction rate.'
        },
        {
            q: `Does IGGM have a complete selection of items?`,
            a: `Yes, IGGM offers a comprehensive selection of ${gameName} items including blueprints, materials, weapons, modded weapons, keys, and more. Our inventory is constantly updated with new items as they become available in the game.`
        },
        {
            q: 'How to deliver materials?',
            a: 'After your purchase, our team will contact you via the order chat. We will schedule a time to meet in-game, invite you to a group, and drop the purchased items for you. Please make sure to put them in your Safe Pocket Slots immediately.'
        },
        {
            q: 'Are weapons here cheaper than other stores?',
            a: 'IGGM offers some of the most competitive prices in the market. We constantly monitor competitor prices to ensure our customers get the best deals. Plus, you can use coupon codes for additional discounts!'
        },
        {
            q: 'Can I get a refund after buying items here?',
            a: 'Yes, we offer a full refund policy. If we cannot deliver your order for any reason, you will receive a 100% refund. Please review our Refund Policy page for complete details on our refund process.'
        },
    ];

    const reviews = [
        {
            text: "I highly recommend the website. I always buy items for Arc Raiders, and the delivery is always fast, and customer support always responds very quickly.",
            url: "https://www.trustpilot.com/reviews/6985b2e474261526245ad10a"
        },
        {
            text: "Yea their 100% legit went thru them several times I got 2 item from them at once they even had a guy come in armed to escort me to hatch exit! These guys are amazing.",
            url: "https://www.trustpilot.com/reviews/69843bad2da16c7efc8ad463"
        },
        {
            text: "Buying Weapons ARC Raiders! 10/10 really fast and safe, we go into the most easy map and then he drop the guns and just we have to run straight to the elevator.",
            url: "https://www.trustpilot.com/reviews/6981a78e13324a1854b85ef8"
        },
        {
            text: "This is the 2nd time for me and it won't be the last for sure. I have bought some items for arc raiders and they hand it over in a very professional way.",
            url: "https://www.trustpilot.com/reviews/6981235d0e8a135ffa839f93"
        }
    ];

    useEffect(() => {
        let cancelled = false;

        async function loadArticles() {
            try {
                const response = await fetch(`/api/articles?game=${encodeURIComponent(gameSlug)}&limit=2`);
                if (!response.ok) return;
                const payload = await response.json();
                if (!cancelled) {
                    setArticles(payload.articles?.slice(0, 2) || []);
                }
            } catch {
                if (!cancelled) setArticles([]);
            }
        }

        if (gameSlug) {
            loadArticles();
        }

        return () => {
            cancelled = true;
        };
    }, [gameSlug]);

    return (
        <div className={styles.seoContent}>
            {/* How to Buy */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>How to buy {gameName} items on IGGM?</h2>
                {couponCode && (
                    <div className={styles.couponBanner}>
                        Saving Your {couponDiscount} Money With Code: <strong>{couponCode}</strong>
                    </div>
                )}
                <ol className={styles.stepsList}>
                    <li>Add the items you need to your shopping cart. You can locate the item you need by choosing the item categories above or by directly using the search box.</li>
                    <li>Fill in your user and delivery information. Please double-check to avoid errors.</li>
                    <li>Choose your preferred payment method and then click &quot;Pay Now&quot;.</li>
                </ol>
            </section>

            {/* Safe Trading Notes */}
            <section className={styles.section}>
                <h3 className={styles.sectionSubTitle}>Item Safe Trading Notes:</h3>
                <ol className={styles.notesList}>
                    <li>Please offer us the right Embark ID.</li>
                    <li>We will invite you to a group. Remember to put the items we drop to you in your Safe Pocket Slots. We will not be responsible for item loss if you have not put them in a safe box.</li>
                    <li>Do not take any valuable items to the game.</li>
                </ol>
            </section>

            {/* How to Find Embark ID */}
            <section className={styles.section}>
                <h3 className={styles.sectionSubTitle}>How To Find My Embark ID?</h3>
                <ol className={styles.stepsList}>
                    <li>Launch ARC Raiders.</li>
                    <li>From the main menu, press the &quot;+&quot; icon to open the friend/party menu.</li>
                    <li>Select Manage Embark ID in the bottom left.</li>
                    <li>Your Embark display name and ID will be shown on your profile page.</li>
                    <li>Then you can click here and copy your Embark ID.</li>
                </ol>
            </section>

            {/* Reviews */}
            <section className={styles.section}>
                <h3 className={styles.sectionSubTitle}>Real Customers Reviews on Trustpilot</h3>
                <div className={styles.reviewsGrid}>
                    {reviews.map((review, i) => (
                        <a key={i} href={review.url} target="_blank" rel="noopener noreferrer" className={styles.reviewCard}>
                            <div className={styles.reviewStars}>★★★★★</div>
                            <p className={styles.reviewText}>&quot;{review.text}&quot;</p>
                        </a>
                    ))}
                </div>
                <a href="https://www.trustpilot.com/review/iggm.com" target="_blank" rel="noopener noreferrer" className={styles.trustpilotLink}>
                    Check more IGGM {gameName} Items reviews →
                </a>
            </section>

            {/* FAQ */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>FAQs about buying {gameName} items at IGGM</h2>
                <div className={styles.faqList}>
                    {faqs.map((faq, i) => (
                        <div key={i} className={`${styles.faqItem} ${openFaq === i ? styles.faqOpen : ''}`}>
                            <button className={styles.faqQuestion} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                                <span>Q: {faq.q}</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.faqChevron}>
                                    <path d="m6 9 6 6 6-6" />
                                </svg>
                            </button>
                            {openFaq === i && (
                                <div className={styles.faqAnswer}>
                                    <p>A: {faq.a}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Game Articles (SEO) */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{gameName} News</h2>
                <div className={styles.articlesGrid}>
                    {articles.length > 0 ? articles.map((article) => (
                        <Link key={article.id} href={`/news/${article.slug}`} className={styles.articleCard}>
                            <div className={styles.articleImage}>
                                <div className={styles.articleImagePlaceholder}>📰</div>
                            </div>
                            <div className={styles.articleContent}>
                                <h4>{article.title}</h4>
                                <p>{article.excerpt}</p>
                            </div>
                        </Link>
                    )) : (
                        <>
                            <div className={styles.articleCard}>
                                <div className={styles.articleImage}>
                                    <div className={styles.articleImagePlaceholder}>📰</div>
                                </div>
                                <div className={styles.articleContent}>
                                    <h4>ARC Raiders Season 3 Trials Guide | Loot Bird&apos;s Nests</h4>
                                    <p>Have you completed this week&apos;s trials? The recent trials haven&apos;t been too difficult; usually, a little extra time is enough to achieve three stars and win all the rewards...</p>
                                </div>
                            </div>
                            <div className={styles.articleCard}>
                                <div className={styles.articleImage}>
                                    <div className={styles.articleImagePlaceholder}>📰</div>
                                </div>
                                <div className={styles.articleContent}>
                                    <h4>ARC Raiders vs Marathon Mechanics and Combat</h4>
                                    <p>The long-awaited Marathon has finally been released, drawing reactions ranging from eager anticipation to outright dismissal...</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </section>
        </div>
    );
}
