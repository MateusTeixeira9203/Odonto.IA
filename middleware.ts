// Next.js requer que o middleware esteja na raiz do projeto (ao lado de /src).
// A lógica real está em src/proxy.ts — o config precisa ser declarado inline
// pois o Next.js o parseia estaticamente (não aceita re-export de outro arquivo).
export { proxy as middleware } from './src/proxy';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|api/|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)',
  ],
};
