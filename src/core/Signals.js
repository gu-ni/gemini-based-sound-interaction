/**
 * Signals.js
 * Shared continuous signal state with smoothing and inertia.
 * Input is handled externally (Interaction.js).
 */

export class Signals {
    constructor() {
        /* =========================
         * Public parameters (smoothed)
         * ========================= */
        this.params = {
            energy: 0.08,
            focus: 0.06,
            depth: 0.5,
            resonance: 0.2,
            texture: 0.12,

            drag: 0,
            dragActive: 0,
            dragForce: 0,

            velocity: 0,
            sharpness: 0,

            position: { x: 0.5, y: 0.5 },
            drift: 0
        };

        /* =========================
         * Raw targets (written by Interaction)
         * ========================= */
        this.targets = {
            ...this.params,
            position: { x: 0.5, y: 0.5 }
        };

        /* =========================
         * Smoothing factors
         * ========================= */
        this.smoothing = {
            energy: 0.02,
            focus: 0.05,
            depth: 0.01,
            resonance: 0.03,
            texture: 0.02,

            drag: 0.05,
            dragActive: 0.2,
            dragForce: 0.07,

            velocity: 0.08,
            sharpness: 0.08,

            position: 0.08,
            drift: 0.005
        };

        this.lastTime = performance.now();
    }

    /* =========================
     * Frame update (called from main loop)
     * ========================= */
    update() {
        const now = performance.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        /* --- autonomous drift --- */
        this.targets.drift += dt * 0.1;

        const baseEnergy =
            0.06 + Math.sin(this.targets.drift * 0.6) * 0.02;
        const baseFocus =
            0.05 + Math.cos(this.targets.drift * 0.4) * 0.02;

        this.targets.energy = Math.max(this.targets.energy, baseEnergy);
        this.targets.focus = Math.max(this.targets.focus, baseFocus);

        /* --- idle decay (continuous signals only) --- */
        this.targets.energy *= 0.995;
        this.targets.focus *= 0.99;
        this.targets.drag *= 0.95;
        this.targets.velocity *= 0.88;
        this.targets.sharpness *= 0.85;
        this.targets.dragForce *= 0.86;
        // ❌ dragActive는 decay하지 않음

        /* --- smoothing / lerp --- */
        for (const key in this.params) {
            if (key === 'position') {
                this.params.position.x +=
                    (this.targets.position.x - this.params.position.x) *
                    this.smoothing.position;
                this.params.position.y +=
                    (this.targets.position.y - this.params.position.y) *
                    this.smoothing.position;

            } else if (key === 'dragActive') {
                // 🔥 binary state: 그대로 전달
                this.params.dragActive = this.targets.dragActive;

            } else if (typeof this.params[key] === 'number') {
                this.params[key] +=
                    (this.targets[key] - this.params[key]) *
                    this.smoothing[key];
            }
        }
    }

    /* =========================
     * APIs used by Interaction.js
     * ========================= */
    perturb(key, value, force = false) {
        if (!(key in this.targets)) return;

        if (force) {
            this.params[key] = value;
            this.targets[key] = value;
        } else {
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

/* =========================
 * Shared singleton
 * ========================= */
export const signals = new Signals();
