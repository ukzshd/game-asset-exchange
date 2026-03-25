import { Suspense } from 'react';
import AuthCallbackClient from './AuthCallbackClient';

export const dynamic = 'force-dynamic';

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={null}>
            <AuthCallbackClient />
        </Suspense>
    );
}
