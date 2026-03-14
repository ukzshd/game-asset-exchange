import { Suspense } from 'react';
import CheckoutClient from './CheckoutClient';

export default function CheckoutPage() {
    return (
        <Suspense fallback={<div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>Loading checkout...</div>}>
            <CheckoutClient />
        </Suspense>
    );
}
