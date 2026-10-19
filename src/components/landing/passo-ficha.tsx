'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useEmCena } from '@/hooks/use-em-cena';
import { OdontogramaDemo } from './odontograma-demo';

/**
 * Passo 2 — a mesma fala virou ficha. O odontograma acende quando o passo entra em
 * cena: cada dente com estado recebe a cor na frente do leitor.
 */
export function PassoFicha() {
  const raiz = useRef<HTMLDivElement>(null);
  const [, visivel] = useEmCena<HTMLDivElement>({ threshold: 0.05, rootMargin: '0px 0px -12% 0px' }, raiz);
  const [, aceso] = useEmCena<HTMLDivElement>({ threshold: 0.35, redeMs: 6000 }, raiz);

  return (
    <div ref={raiz} id="passo2" className={cn('passo revelar', visivel && 'visivel')}>
      <div className="texto">
        <div className="ord">Depois</div>
        <h3>A ficha se monta</h3>
        <p>Dente, face, procedimento e conduta saem estruturados — você revisa e assina.</p>
      </div>
      <div className="demo">
        <div className="demo-cab">
          <span className="nome">Maria S.</span>
          <span className="meta">Ficha de 14/08</span>
        </div>
        <div className="demo-corpo odontograma">
          <OdontogramaDemo aceso={aceso} />
        </div>
        <div className="legenda">
          <span>
            <i style={{ background: 'var(--teal)' }} />
            Realizado por você
          </span>
          <span>
            <i style={{ background: 'var(--coral)' }} />A fazer
          </span>
          <span>
            <i style={{ background: 'var(--slate)' }} />
            Pré-existente
          </span>
        </div>
        <p className="demo-secao">Nesta sessão</p>
        <div className="demo-corpo">
          <div className="rcard encena">
            <div className="txt">
              <p className="tit">Restauração — dente 16, oclusal</p>
              <p className="sub">
                Realizado em 14/08 · Você <span className="assin">· Assinatura coletada ✓</span>
              </p>
            </div>
            <span className="pill pill-teal">
              <span className="dot" />
              Realizado
            </span>
          </div>
          <div className="rcard encena">
            <div className="txt">
              <p className="tit">Restauração — dente 46</p>
              <p className="sub">Você</p>
            </div>
            <span className="pill pill-warn">
              <span className="dot" />
              Próxima sessão
            </span>
            <span className="pill pill-coral">
              <span className="dot" />
              Planejado
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
