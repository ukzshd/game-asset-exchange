import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FloatingButtons from '@/components/FloatingButtons';

export const metadata = {
  title: 'IGGM - Buy Game Currency, Items & Boosting | Fast Delivery',
  description: 'IGGM is the best place to buy game currency, items, and boosting services. We offer fast delivery, 24/7 live support, and secure transactions for all popular games.',
  keywords: 'game currency, game items, buy gold, game boosting, ARC Raiders, Diablo 4, POE 2, IGGM',
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
