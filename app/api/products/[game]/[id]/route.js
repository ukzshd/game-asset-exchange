import { NextResponse } from 'next/server';
import { getProductByGameAndIdentifier, getRelatedProducts } from '@/lib/catalog';

export async function GET(_request, { params }) {
    try {
        const { game, id } = await params;
        const product = await getProductByGameAndIdentifier(game, id);

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        const related = await getRelatedProducts(game, product.id, product.category, 6);

        return NextResponse.json({ product, related });
    } catch (error) {
        console.error('Product detail error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
