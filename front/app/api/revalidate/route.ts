import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

const SECRET = process.env.REVALIDATE_SECRET || 'meudiva_revalidate_xK9mP2qL';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (body.secret !== SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }
    
    const { slug, type } = body;
    
    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }
    
    // Mapeia o slug para a rota correspondente
    let path = slug === 'home' ? '/' : `/${slug}`;
    revalidatePath(path);
    
    // Se for um post do blog, revalida também a lista
    if (type === 'post') {
      revalidatePath('/blog');
    }
    
    return NextResponse.json({ 
      revalidated: true, 
      path,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}