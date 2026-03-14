'use client';

import { useSyncExternalStore } from 'react';

function subscribe() {
    return () => {};
}

export default function useHydrated() {
    return useSyncExternalStore(subscribe, () => true, () => false);
}
