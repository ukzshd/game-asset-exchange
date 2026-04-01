import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { sanitizeInventoryLotInput } from '@/lib/admin-inputs';
import { assertTrustedOrigin } from '@/lib/request-security';
import { recomputeInventoryAggregates } from '@/lib/inventory';

export async function PUT(request, { params }) {
    try {
        assertTrustedOrigin(request);
        await requireAdmin(request);
        const { id } = await params;
        const input = sanitizeInventoryLotInput(await request.json());
        const db = await getDb();

        const lot = await db.prepare(`
            SELECT il.*, p.id AS product_id, p.sku_id
            FROM inventory_lots il
            JOIN product_skus sku ON sku.id = il.sku_id
            JOIN products p ON p.sku_id = sku.id
            WHERE il.id = ?
        `).get(id);
        if (!lot) {
            return NextResponse.json({ error: 'Inventory lot not found' }, { status: 404 });
        }

        await db.prepare(`
            UPDATE inventory_lots
            SET available_quantity = ?, source_type = ?, source_ref = ?, note = ?, updated_at = NOW()
            WHERE id = ?
        `).run(input.availableQuantity, input.sourceType, input.sourceRef, input.note, id);

        await recomputeInventoryAggregates(db, lot.sku_id, lot.product_id);

        const updatedLot = await db.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(id);
        return NextResponse.json({ lot: updatedLot });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Inventory update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        assertTrustedOrigin(request);
        await requireAdmin(request);
        const { id } = await params;
        const db = await getDb();

        const lot = await db.prepare(`
            SELECT il.*, p.id AS product_id, p.sku_id
            FROM inventory_lots il
            JOIN product_skus sku ON sku.id = il.sku_id
            JOIN products p ON p.sku_id = sku.id
            WHERE il.id = ?
        `).get(id);
        if (!lot) {
            return NextResponse.json({ error: 'Inventory lot not found' }, { status: 404 });
        }

        const lotCount = (await db.prepare('SELECT COUNT(*)::int AS c FROM inventory_lots WHERE sku_id = ?').get(lot.sku_id)).c;
        if (lotCount <= 1) {
            return NextResponse.json({ error: 'Each SKU must keep at least one inventory lot' }, { status: 400 });
        }

        await db.prepare('DELETE FROM inventory_lots WHERE id = ?').run(id);
        await recomputeInventoryAggregates(db, lot.sku_id, lot.product_id);

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Inventory delete error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
