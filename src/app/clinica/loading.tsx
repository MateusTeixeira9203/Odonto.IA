import { PageContainer } from '@/components/layout/page-container';
export default function Loading() { return <PageContainer variant="wide"><p role="status" className="text-muted-foreground">Carregando resultados da clínica…</p><div aria-hidden="true" className="mt-6 h-48 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" /></PageContainer>; }
