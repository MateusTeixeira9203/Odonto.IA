'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) { return <section className="p-8 text-foreground"><p role="alert" className="mb-4">Não foi possível carregar esta área. Seus dados não foram alterados.</p><Button onClick={reset}>Tentar novamente</Button></section>; }
