// Next.js requer que o middleware esteja na raiz do projeto (ao lado de /src).
// A lógica real está em src/proxy.ts — re-export nomeado não gera o .nft.json
// corretamente no Vercel, por isso usamos wrapper explícito.
import { proxy } from './src/proxy';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|api/|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)',
  ],
};
