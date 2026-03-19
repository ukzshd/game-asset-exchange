import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FloatingButtons from '@/components/FloatingButtons';
import { getAppUrl } from '@/lib/env';

export const metadata = {
  metadataBase: new URL(getAppUrl()),
  title: 'IGGM - Buy Game Currency, Items & Boosting | Fast Delivery',
  description: 'IGGM is the best place to buy game currency, items, and boosting services. We offer fast delivery, 24/7 live support, and secure transactions for all popular games.',
  keywords: 'game currency, game items, buy gold, game boosting, ARC Raiders, Diablo 4, POE 2, IGGM',
  openGraph: {
    title: 'IGGM - Buy Game Currency, Items & Boosting | Fast Delivery',
    description: 'Buy game currency, items, and boosting services with secure checkout and operations-backed delivery.',
    type: 'website',
    url: getAppUrl(),
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main style={{ minHeight: 'calc(100vh - 200px)' }}>
          {children}
        </main>
        <Footer />
        <FloatingButtons />
      </body>
    </html>
  );
}
