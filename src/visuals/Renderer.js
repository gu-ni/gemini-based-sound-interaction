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
        this.mesh = [];
        this.meshCols = 72;
        this.meshRows = 42;
        this.time = 0;
        this.lastTime = performance.now();
        this.meshFrame = null;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.initMesh();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * window.devicePixelRatio;
        this.canvas.height = this.height * window.devicePixelRatio;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    initMesh() {
        this.mesh = [];
        for (let v = 0; v <= this.meshRows; v++) {
            for (let u = 0; u <= this.meshCols; u++) {
                const uu = u / this.meshCols;
                const vv = v / this.meshRows;
                this.mesh.push({
                    u: uu,
                    v: vv,
                    theta: uu * Math.PI * 2,
                    phi: (vv - 0.5) * Math.PI,
                    stretchMask: Math.random(),
                    stretch: 0
                });
            }
        }
    }

    draw() {
        const now = performance.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        this.time += dt;

        const { energy, focus, position, drift } = signals.params;
        const ctx = this.ctx;

        // 1. Clear with deep fade (Trails effect)
        ctx.fillStyle = `rgba(5, 5, 8, ${0.14 + (1 - focus) * 0.1})`;
        ctx.fillRect(0, 0, this.width, this.height);

        // 2. Draw Lighting Field (3D Simulation)
        this.drawLightingField(ctx, position, energy, focus);

        // 3. Draw Central Mesh (TouchDesigner-inspired wireform)
        this.drawMesh(ctx, energy, focus, drift);

        // 4. Draw Aura Layer (Plasma skin)
        this.drawAura(ctx, energy, focus, drift);

        // 5. Post-process (Vignette/Noise)
        this.drawVignette(ctx);
    }

    drawLightingField(ctx, pos, energy, focus) {
        const centerX = (0.5 + (pos.x - 0.5) * 0.15) * this.width;
        const centerY = (0.5 + (pos.y - 0.5) * 0.15) * this.height;
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

        ctx.globalCompositeOperation = 'source-over';
    }

    drawMesh(ctx, energy, focus, drift) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const baseRadius = Math.min(this.width, this.height) * 0.2;
        const swell = 0.25 + energy * 0.8;
        const ripple = 0.1 + focus * 0.5;
        const rotation = drift * 0.5 + this.time * 0.25;
        const cursorX = (signals.params.position.x - 0.5) * 2;
        const cursorY = (signals.params.position.y - 0.5) * 2;
        const tilt = Math.sin(this.time * 0.3) * 0.45 + cursorY * 0.7;
        const yaw = rotation + cursorX * 0.9;
        const roll = Math.sin(this.time * 0.2) * 0.25 + cursorX * 0.2;
        const focal = 700;
        const velocity = signals.params.velocity;
        const stretchEnergy = Math.max(0, velocity - 0.05);
        const dirMag = Math.hypot(cursorX, -cursorY, 0.4);
        const dir = {
            x: dirMag > 0 ? cursorX / dirMag : 0,
            y: dirMag > 0 ? -cursorY / dirMag : 0,
            z: dirMag > 0 ? 0.4 / dirMag : 0.4
        };

        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = `rgba(185, 195, 255, ${0.25 + energy * 0.35})`;
        ctx.lineWidth = 1;

        const projected = new Array(this.mesh.length);
        const offsets = new Array(this.mesh.length);
        const dragForce = signals.params.dragForce;
        for (let i = 0; i < this.mesh.length; i++) {
            const vert = this.mesh[i];
            const wobble = Math.sin(vert.theta * 4 + this.time * 1.1) * Math.cos(vert.phi * 3 - this.time * 0.7);
            const pulse = Math.sin(this.time * 0.7 + vert.u * 8) * Math.sin(this.time * 0.5 + vert.v * 7);
            const torsion = Math.sin(vert.theta * 6 + this.time * 0.8) * Math.sin(vert.phi * 4 - this.time * 0.4);
            const cursorField = Math.cos(vert.theta - cursorX) * Math.cos(vert.phi - cursorY) * 0.15;
            const radius = baseRadius * (1 + wobble * ripple + pulse * swell * 0.25 + torsion * 0.15 + cursorField * (0.2 + energy * 0.3));

            const x = Math.cos(vert.theta) * Math.cos(vert.phi) * radius;
            const y = Math.sin(vert.phi) * radius;
            const z = Math.sin(vert.theta) * Math.cos(vert.phi) * radius;
            const normMag = Math.hypot(x, y, z) || 1;
            const normal = { x: x / normMag, y: y / normMag, z: z / normMag };
            const vib = Math.sin(this.time * 14 + vert.theta * 2 - vert.phi * 3) * dragForce;
            const vib2 = Math.cos(this.time * 11 + vert.u * 10 + vert.v * 6) * dragForce;
            const vibAmp = baseRadius * 0.02 * (vib + vib2);
            const vx = x + normal.x * vibAmp;
            const vy = y + normal.y * vibAmp;
            const vz = z + normal.z * vibAmp;
            const alignment = Math.max(0, normal.x * dir.x + normal.y * dir.y + normal.z * dir.z);
            const mask = vert.stretchMask > 0.94 ? 1 : 0;
            const stretchTarget = stretchEnergy * mask * alignment * alignment * 3.5;
            vert.stretch += (stretchTarget - vert.stretch) * 0.08;
            const stretchDirMag = Math.hypot(
                normal.x * 0.6 + dir.x * 0.4,
                normal.y * 0.6 + dir.y * 0.4,
                normal.z * 0.6 + dir.z * 0.4
            ) || 1;
            const stretchDir = {
                x: (normal.x * 0.6 + dir.x * 0.4) / stretchDirMag,
                y: (normal.y * 0.6 + dir.y * 0.4) / stretchDirMag,
                z: (normal.z * 0.6 + dir.z * 0.4) / stretchDirMag
            };
            const stretchDistance = baseRadius * vert.stretch * (1.5 + velocity * 3);
            const sx = vx + stretchDir.x * stretchDistance;
            const sy = vy + stretchDir.y * stretchDistance;
            const sz = vz + stretchDir.z * stretchDistance;

            let rx = sx;
            let ry = sy * Math.cos(tilt) - sz * Math.sin(tilt);
            let rz = sy * Math.sin(tilt) + sz * Math.cos(tilt);

            let rx2 = rx * Math.cos(yaw) + rz * Math.sin(yaw);
            let rz2 = -rx * Math.sin(yaw) + rz * Math.cos(yaw);

            let rx3 = rx2 * Math.cos(roll) - ry * Math.sin(roll);
            let ry3 = rx2 * Math.sin(roll) + ry * Math.cos(roll);

            const perspective = focal / (focal + rz2 + baseRadius * 2);
            projected[i] = {
                x: centerX + rx3 * perspective,
                y: centerY + ry3 * perspective,
                z: rz2
            };
            offsets[i] = { normal, stretch: vert.stretch };
        }

        this.meshFrame = { projected, centerX, centerY, offsets };

        for (let v = 0; v <= this.meshRows; v++) {
            for (let u = 0; u <= this.meshCols; u++) {
                const idx = v * (this.meshCols + 1) + u;
                const p = projected[idx];
                if (!p) continue;

                if (u < this.meshCols) {
                    const p2 = projected[idx + 1];
                    const alpha = 0.25 + energy * 0.5;
                    ctx.strokeStyle = `rgba(185, 195, 255, ${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
                if (v < this.meshRows) {
                    const p3 = projected[idx + (this.meshCols + 1)];
                    const alpha = 0.2 + focus * 0.5;
                    ctx.strokeStyle = `rgba(140, 160, 255, ${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p3.x, p3.y);
                    ctx.stroke();
                }
            }
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    drawAura(ctx, energy, focus, drift) {
        if (!this.meshFrame) return;
        const { projected, centerX, centerY, offsets } = this.meshFrame;
        const layers = 3;
        const flow = this.time * 0.6 + drift * 0.5;
        const velocity = signals.params.velocity;
        const glowBase = 0.08 + energy * 0.2 + focus * 0.15;

        ctx.globalCompositeOperation = 'screen';
        for (let layer = 0; layer < layers; layer++) {
            const phase = layer / layers;
            const thickness = 3 + phase * 3 + velocity * 6;
            const alpha = glowBase * (1 - phase * 0.5);
            ctx.lineWidth = 0.7 + phase * 0.4;

            for (let v = 0; v <= this.meshRows; v += 2) {
                ctx.beginPath();
                for (let u = 0; u <= this.meshCols; u++) {
                    const idx = v * (this.meshCols + 1) + u;
                    const p = projected[idx];
                    if (!p) continue;

                    const dx = p.x - centerX;
                    const dy = p.y - centerY;
                    const mag = Math.hypot(dx, dy) || 1;
                    const flare = Math.sin(flow + u * 0.12 + v * 0.08) * (0.6 + focus * 0.6);
                    const stretchBias = offsets[idx]?.stretch || 0;
                    const offsetScale = thickness * (1 + flare * 0.4 + stretchBias * 1.2) * (0.7 + phase * 0.6);
                    const ox = dx / mag;
                    const oy = dy / mag;
                    const x = p.x + ox * offsetScale;
                    const y = p.y + oy * offsetScale;
                    if (u === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.strokeStyle = `rgba(120, 165, 255, ${alpha})`;
                ctx.stroke();
            }
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    drawVignette(ctx) {
        const gradient = ctx.createRadialGradient(this.width/2, this.height/2, this.width/4, this.width/2, this.height/2, this.width);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);
    }
}
