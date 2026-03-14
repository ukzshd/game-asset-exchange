import { describe, it, expect } from 'vitest';
import { cleanText, cleanMultilineText, sanitizeOrderItems, normalizeEmail, isStrongEnoughPassword } from '@/lib/validation';
import { ORDER_STATUS, getAllowedTransitions } from '@/lib/orders';

describe('validation helpers', () => {
    it('normalizes and truncates plain text safely', () => {
        expect(cleanText('  hello\u0000world  ', 8)).toBe('hellowor');
        expect(cleanMultilineText('foo\r\nbar', 20)).toBe('foo\nbar');
        expect(normalizeEmail(' TEST@Example.COM ')).toBe('test@example.com');
        expect(isStrongEnoughPassword('12345678')).toBe(true);
        expect(isStrongEnoughPassword('1234567')).toBe(false);
    });

    it('sanitizes cart items into bounded numeric payloads', () => {
        expect(sanitizeOrderItems([
            { productId: '12', quantity: '200', name: '  Item  ' },
            { id: '9', quantity: '0', name: 'Fallback' },
            { id: 'bad', quantity: 2 },
        ])).toEqual([
            { productId: 12, quantity: 99, name: 'Item' },
            { productId: 9, quantity: 1, name: 'Fallback' },
        ]);
    });
});

describe('order transition rules', () => {
    const admin = { id: 1, role: 'admin' };
    const worker = { id: 3, role: 'worker' };

    it('returns all allowed transitions for admin', () => {
        const order = { id: 10, status: ORDER_STATUS.PAID, assigned_to: null };
        expect(getAllowedTransitions(admin, order)).toEqual([ORDER_STATUS.ASSIGNED, ORDER_STATUS.REFUNDED]);
    });

    it('limits workers to their assigned operational transitions', () => {
        const order = { id: 11, status: ORDER_STATUS.ASSIGNED, assigned_to: 3 };
        expect(getAllowedTransitions(worker, order)).toEqual([ORDER_STATUS.DELIVERING]);
    });

    it('blocks workers from orders not assigned to them', () => {
        const order = { id: 12, status: ORDER_STATUS.ASSIGNED, assigned_to: 999 };
        expect(getAllowedTransitions(worker, order)).toEqual([]);
    });
});
