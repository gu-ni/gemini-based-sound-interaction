/**
 * Renderer.js
 * Immersive audiovisual renderer simulating 3D lighting and technical geometry.
 */

import { signals } from '../core/Signals.js';

export class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.width = 0;
        this.height = 0;
        this.particles = [];
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.initParticles();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * window.devicePixelRatio;
        this.canvas.height = this.height * window.devicePixelRatio;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    initParticles() {
        for (let i = 0; i < 100; i++) {
            this.particles.push({
                x: Math.random(),
                y: Math.random(),
                z: Math.random(),
                size: Math.random() * 2,
                speed: 0.0001 + Math.random() * 0.0005
            });
        }
    }

    draw() {
        const { energy, focus, position, drift } = signals.params;
        const ctx = this.ctx;

        // 1. Clear with deep fade (Trails effect)
        ctx.fillStyle = `rgba(5, 5, 8, ${0.14 + (1 - focus) * 0.1})`;
        ctx.fillRect(0, 0, this.width, this.height);

        // 2. Draw Lighting Field (3D Simulation)
        this.drawLightingField(ctx, position, energy, focus);

        // 3. Draw Geometry (Grids/Lines)
        this.drawGeometry(ctx, energy, focus, drift);

        // 4. Draw Particles (Technical grain)
        this.drawParticles(ctx, energy, drift);

        // 5. Post-process (Vignette/Noise)
        this.drawVignette(ctx);
    }

    drawLightingField(ctx, pos, energy, focus) {
        const centerX = pos.x * this.width;
        const centerY = pos.y * this.height;
        const drag = signals.params.drag;
        
        // Primary Light Source (Cursor focus)
        const radius = (200 + energy * 400) * (0.5 + focus);
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        
        const alpha = 0.08 + energy * 0.2;
        gradient.addColorStop(0, `rgba(125, 102, 255, ${alpha})`); 
        gradient.addColorStop(0.5, `rgba(60, 40, 120, ${alpha * 0.3})`);
        gradient.addColorStop(1, 'rgba(5, 5, 10, 0)');
        
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillRect(0, 0, this.width, this.height);

        // Vertical Beam (Drag intensity)
        if (drag > 0.1) {
            const beamWidth = 2 + drag * 50;
            const beamAlpha = drag * 0.2;
            const beamGradient = ctx.createLinearGradient(centerX - beamWidth, 0, centerX + beamWidth, 0);
            beamGradient.addColorStop(0, 'rgba(125, 102, 255, 0)');
            beamGradient.addColorStop(0.5, `rgba(200, 200, 255, ${beamAlpha})`);
            beamGradient.addColorStop(1, 'rgba(125, 102, 255, 0)');
            
            ctx.fillStyle = beamGradient;
            ctx.fillRect(centerX - beamWidth, 0, beamWidth * 2, this.height);
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    drawGeometry(ctx, energy, focus, drift) {
        ctx.strokeStyle = `rgba(200, 200, 220, ${0.12 + energy * 0.12})`;
        ctx.lineWidth = 0.5;

        const cols = 20;
        const rows = 20;
        const spacingX = this.width / cols;
        const spacingY = this.height / rows;

        // Perspective-warped grid
        for (let i = 0; i <= cols; i++) {
            ctx.beginPath();
            const x = i * spacingX;
            ctx.moveTo(x, 0);
            
            // Warp line based on energy and drift
            for (let j = 0; j <= rows; j++) {
                const y = j * spacingY;
                const dist = Math.hypot(x - signals.params.position.x * this.width, y - signals.params.position.y * this.height);
                const warp = Math.sin(drift + i * 0.2) * 10 * energy * (1000 / (dist + 100));
                ctx.lineTo(x + warp, y);
            }
            ctx.stroke();
        }

        for (let i = 0; i <= rows; i++) {
            ctx.beginPath();
            const y = i * spacingY;
            ctx.moveTo(0, y);
            for (let j = 0; j <= cols; j++) {
                const x = j * spacingX;
                const dist = Math.hypot(x - signals.params.position.x * this.width, y - signals.params.position.y * this.height);
                const warp = Math.cos(drift + i * 0.2) * 10 * energy * (1000 / (dist + 100));
                ctx.lineTo(x, y + warp);
            }
            ctx.stroke();
        }
    }

    drawParticles(ctx, energy, drift) {
        ctx.fillStyle = `rgba(200, 200, 255, ${0.16 + energy * 0.45})`;
        this.particles.forEach(p => {
            p.y -= p.speed * (1 + energy * 5);
            if (p.y < 0) p.y = 1;
            
            const x = p.x * this.width + Math.sin(drift + p.z * 10) * 20;
            const y = p.y * this.height;
            
            ctx.beginPath();
            ctx.arc(x, y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawVignette(ctx) {
        const gradient = ctx.createRadialGradient(this.width/2, this.height/2, this.width/4, this.width/2, this.height/2, this.width);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);
    }
}
