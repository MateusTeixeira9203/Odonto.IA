/**
 * Ponto de entrada do middleware Next.js.
 * A lógica de proteção de rotas e refresh de sessão vive em src/proxy.ts.
 * Next.js exige que o middleware seja exportado como `middleware` (ou default)
 * a partir de `src/middleware.ts` — por isso esse arquivo existe separado.
 */
export { proxy as middleware, config } from "./proxy";
