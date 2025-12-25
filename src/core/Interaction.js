/**
 * Interaction.js
 * Translates discrete DOM events into continuous signal perturbations.
 */

import { signals } from './Signals.js';

console.log('[Interaction] FILE LOADED');

export class Interaction {
    constructor() {
        this.isMouseDown = false;
        this.lastPosition = { x: 0.5, y: 0.5 };
        this.lastVector = { x: 0, y: 0 };
        this.lastTime = performance.now();
        
        this.init();
    }

    init() {
        console.log('[Interaction] INIT');
        window.addEventListener('pointerdown', (e) => {
            console.log('[RAW POINTERDOWN]', e.target);
            this.handleDown(e);
        });
        window.addEventListener('pointermove', (e) => this.handleMove(e));
        window.addEventListener('pointerdown', (e) => this.handleDown(e));
        window.addEventListener('pointerup', (e) => this.handleUp(e));
        window.addEventListener('pointercancel', (e) => this.handleUp(e));
        
        // Prevent default touch actions to avoid scrolling during interaction
        window.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    }

    handleMove(e) {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        
        signals.setCursor(x, y);

        // Movement increases energy and focus
        const dx = x - this.lastPosition.x;
        const dy = y - this.lastPosition.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const now = performance.now();
        const dt = Math.max(0.001, (now - this.lastTime) / 1000);
        const speed = dist / dt;
        const maxSpeed = 3;
        const velocity = Math.min(1, speed / maxSpeed);
        signals.perturb('velocity', velocity);

        const magPrev = Math.hypot(this.lastVector.x, this.lastVector.y);
        const magCurr = Math.hypot(dx, dy);
        let sharpness = 0;
        if (magPrev > 0.0001 && magCurr > 0.0001) {
            const dot = (this.lastVector.x * dx + this.lastVector.y * dy) / (magPrev * magCurr);
            const clamped = Math.max(-1, Math.min(1, dot));
            const angle = Math.acos(clamped);
            sharpness = Math.min(1, angle / Math.PI);
        }
        signals.perturb(
            'dragActive',
            this.isMouseDown ? 1 : 0,
            true // 🔥 force
        );
        signals.perturb('sharpness', sharpness);

        const dragForce = this.isMouseDown ? Math.min(1, 0.05 + velocity * 0.9 + dist * 10) : 0;
        signals.perturb('dragForce', dragForce);
        
        signals.perturb('energy', dist * 2);
        signals.perturb('focus', 0.2 + dist * 5);

        if (this.isMouseDown) {
            signals.perturb('drag', dist * 10);
        }
        
        this.lastPosition = { x, y };
        this.lastVector = { x: dx, y: dy };
        this.lastTime = now;
    }

    handleDown(e) {
        this.isMouseDown = true;
        // High-register activation hint
        signals.perturb('energy', 0.3);
        signals.perturb('focus', 0.8);
        signals.perturb('resonance', 0.6);
    }

    handleUp() {
        this.isMouseDown = false;
    }

    handleTouch(e) {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            this.handleMove({
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            if (e.type === 'touchstart') this.handleDown();
        }
        e.preventDefault();
    }
}
