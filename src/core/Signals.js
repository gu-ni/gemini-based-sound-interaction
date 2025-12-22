/**
 * Signals.js
 * Manages shared abstract parameters with smoothing and inertia.
 */

export class Signals {
    constructor() {
        this.params = {
            energy: 0.08,   // Global activity level (0-1)
            focus: 0.06,    // Interaction concentration (0-1)
            depth: 0.5,     // Spatial depth/fog level (0-1)
            resonance: 0.2, // Harmonic complexity (0-1)
            texture: 0.12,  // Particle/noise density (0-1)
            drag: 0,        // Intentional dragging movement (0-1)
            position: { x: 0.5, y: 0.5 }, // Smoothed cursor position
            drift: 0        // Autonomous system drift
        };

        this.targets = { ...this.params };
        this.targets.position = { x: 0.5, y: 0.5 };
        
        // Smoothing factors (lerp weights)
        this.smoothing = {
            energy: 0.02,
            focus: 0.05,
            depth: 0.01,
            resonance: 0.03,
            texture: 0.02,
            drag: 0.05,
            position: 0.08,
            drift: 0.005
        };

        this.lastTime = performance.now();
    }

    update() {
        const now = performance.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // Apply autonomous drift
        this.targets.drift += dt * 0.1;

        // Maintain a low, autonomous baseline so visuals/audio never go fully dark
        const baseEnergy = 0.06 + Math.sin(this.targets.drift * 0.6) * 0.02;
        const baseFocus = 0.05 + Math.cos(this.targets.drift * 0.4) * 0.02;
        this.targets.energy = Math.max(this.targets.energy, baseEnergy);
        this.targets.focus = Math.max(this.targets.focus, baseFocus);
        
        // Idle decay: energy and focus naturally trend towards 0 if no perturbation
        this.targets.energy *= 0.995;
        this.targets.focus *= 0.99;
        this.targets.drag *= 0.95;

        // Lerp params towards targets
        for (const key in this.params) {
            if (key === 'position') {
                this.params.position.x += (this.targets.position.x - this.params.position.x) * this.smoothing.position;
                this.params.position.y += (this.targets.position.y - this.params.position.y) * this.smoothing.position;
            } else if (typeof this.params[key] === 'number') {
                this.params[key] += (this.targets[key] - this.params[key]) * this.smoothing[key];
            }
        }
    }

    perturb(key, value, force = false) {
        if (force) {
            this.params[key] = value;
            this.targets[key] = value;
        } else {
            // Most perturbations are additive or multiplicative to feel like signals
            if (key === 'energy') {
                this.targets.energy = Math.min(1, this.targets.energy + value);
            } else {
                this.targets[key] = value;
            }
        }
    }

    setCursor(x, y) {
        this.targets.position.x = x;
        this.targets.position.y = y;
    }
}

export const signals = new Signals();
