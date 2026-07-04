'use client';

import { useEffect, useRef } from 'react';

// Squared distances — avoid Math.sqrt in the hot path
const CONNECT_DIST_SQ = 110 * 110;
const REPEL_DIST_SQ   = 140 * 140;
const MAX_PARTICLES   = 85;
// #9 — a tela "ganha vida" só na entrada; depois congela (sem rAF contínuo em idle).
const ANIMATE_MS = 2500;

export default function ParticleNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Capture non-null reference for use inside class methods
    const cvs = canvas;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let particles: Particle[] = [];
    let rafId = 0;
    let mouseRafId = 0;
    let mouseX = -2000;
    let mouseY = -2000;
    let elapsedMs = 0;
    let lastTs: number | null = null;
    let frozen = false;

    class Particle {
      x: number; y: number; vx: number; vy: number;
      radius: number; baseRadius: number;
      pulsing: boolean; phase: number; phaseSpeed: number;

      constructor() {
        this.x = Math.random() * cvs.width;
        this.y = Math.random() * cvs.height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.baseRadius = Math.random() * 1.2 + 0.7;
        this.radius = this.baseRadius;
        this.pulsing = Math.random() > 0.82;
        this.phase = Math.random() * Math.PI * 2;
        this.phaseSpeed = 0.016 + Math.random() * 0.02;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > cvs.width)  this.vx *= -1;
        if (this.y < 0 || this.y > cvs.height) this.vy *= -1;

        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        if (dx * dx + dy * dy < REPEL_DIST_SQ) {
          this.x -= dx * 0.018;
          this.y -= dy * 0.018;
        }

        if (this.pulsing) {
          this.phase += this.phaseSpeed;
          this.radius = Math.max(0.1, this.baseRadius + Math.sin(this.phase) * 0.7);
        }
      }

      draw() {
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        // Opacity-only variation — shadowBlur removed (very expensive)
        const alpha = this.pulsing ? 0.45 + Math.sin(this.phase) * 0.25 : 0.55;
        ctx!.fillStyle = `rgba(47,156,133,${alpha.toFixed(2)})`;
        ctx!.fill();
      }
    }

    const init = () => {
      particles = [];
      const count = Math.min(MAX_PARTICLES, Math.floor((cvs.width * cvs.height) / 14000));
      for (let i = 0; i < count; i++) particles.push(new Particle());
    };

    const drawLines = () => {
      const len = particles.length;
      for (let i = 0; i < len; i++) {
        for (let j = i + 1; j < len; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;
          if (distSq < CONNECT_DIST_SQ) {
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(93,190,176,${(0.32 * (1 - distSq / CONNECT_DIST_SQ)).toFixed(2)})`;
            ctx!.lineWidth = 0.8;
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }
    };

    // Anima ~2.5s (ganha vida) e congela — cancelAnimationFrame, o snapshot fica no canvas.
    // prefers-reduced-motion: desenha 1 frame estático, sem animar. document.hidden: pausa
    // (não conta o tempo oculto) e retoma ao voltar o foco, via visibilitychange abaixo.
    const loop = (ts: number) => {
      if (frozen) return;
      if (document.hidden) { lastTs = null; return; }
      if (lastTs !== null) elapsedMs += ts - lastTs;
      lastTs = ts;

      ctx.clearRect(0, 0, cvs.width, cvs.height);
      for (const p of particles) { p.update(); p.draw(); }
      drawLines();

      if (prefersReducedMotion || elapsedMs >= ANIMATE_MS) {
        frozen = true;
        return;
      }
      rafId = requestAnimationFrame(loop);
    };

    const resize = () => {
      cancelAnimationFrame(rafId);
      cvs.width  = window.innerWidth;
      cvs.height = window.innerHeight;
      init();
      frozen = false;
      elapsedMs = 0;
      lastTs = null;
      rafId = requestAnimationFrame(loop);
    };

    const onVisibilityChange = () => {
      if (!document.hidden && !frozen) {
        lastTs = null;
        rafId = requestAnimationFrame(loop);
      }
    };

    // Throttle mouse via RAF so it never runs more than once per frame
    const onMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(mouseRafId);
      mouseRafId = requestAnimationFrame(() => { mouseX = e.clientX; mouseY = e.clientY; });
    };
    const onMouseLeave = () => { mouseX = -2000; mouseY = -2000; };

    window.addEventListener('resize',     resize,      { passive: true });
    window.addEventListener('mousemove',  onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);

    resize();

    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(mouseRafId);
      window.removeEventListener('resize',     resize);
      window.removeEventListener('mousemove',  onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[-1]" />;
}
