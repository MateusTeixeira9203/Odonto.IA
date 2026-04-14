'use client';

import React, { useEffect, useRef } from 'react';

export default function ParticleNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationFrameId: number;
    const mouse = { x: -1000, y: -1000 };

    const resize = () => {
      // Cancela o loop antes de redimensionar para evitar frames residuais
      cancelAnimationFrame(animationFrameId);
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
      animate();
    };

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseRadius: number;
      isPulsing: boolean;
      pulsePhase: number;
      pulseSpeed: number;

      constructor() {
        this.x = Math.random() * (canvas?.width ?? window.innerWidth);
        this.y = Math.random() * (canvas?.height ?? window.innerHeight);
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.baseRadius = Math.random() * 1.5 + 1.0;
        this.radius = this.baseRadius;
        this.isPulsing = Math.random() > 0.8;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.pulseSpeed = 0.02 + Math.random() * 0.03;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        const width = canvas?.width ?? window.innerWidth;
        const height = canvas?.height ?? window.innerHeight;

        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;

        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 150) {
          this.x -= dx * 0.02;
          this.y -= dy * 0.02;
        }

        if (this.isPulsing) {
          this.pulsePhase += this.pulseSpeed;
          // Math.max garante que o raio nunca fique negativo (baseRadius mín = 1.0, sin mín = -1.5)
          this.radius = Math.max(0, this.baseRadius + Math.sin(this.pulsePhase) * 1.5);
        }
      }

      draw() {
        if (!ctx) return;
        // Dupla proteção: garante raio >= 0 e descarta NaN antes de chamar arc()
        const safeRadius = Number.isFinite(this.radius) ? Math.max(0, this.radius) : 0;
        if (safeRadius === 0) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, safeRadius, 0, Math.PI * 2);

        if (this.isPulsing) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = 'rgba(47, 156, 133, 0.8)';
          ctx.fillStyle = `rgba(47, 156, 133, ${0.6 + Math.sin(this.pulsePhase) * 0.4})`;
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(58, 158, 144, 0.7)';
        }

        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    const initParticles = () => {
      particles = [];
      const numParticles = Math.floor((canvas.width * canvas.height) / 10000);
      for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle());
      }
    };

    const drawLines = () => {
      if (!ctx) return;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(93, 190, 176, ${0.4 * (1 - distance / 130)})`;
            ctx.lineWidth = 1.2;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.update(); p.draw(); });
      drawLines();
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const handleMouseLeave = () => { mouse.x = -1000; mouse.y = -1000; };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    resize();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[-1]"
    />
  );
}
