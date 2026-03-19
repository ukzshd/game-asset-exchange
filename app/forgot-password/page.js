import { Suspense } from 'react';
import ForgotPasswordClient from './ForgotPasswordClient';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
    return (
        <Suspense fallback={null}>
            <ForgotPasswordClient />
        </Suspense>
    );
}
