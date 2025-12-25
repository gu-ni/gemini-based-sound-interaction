/**
 * Renderer.js
 * Three.js atmospheric industrial interior matching reference mood.
 */

import * as THREE from 'three';
import { signals } from '../core/Signals.js';

function createIrregularHeptagonPath(radius, irregularity = 0.12) {
    const path = new THREE.Path();
    const points = [];

    for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2;
        const variation = 1 + (Math.random() * 2 - 1) * irregularity;
        const r = radius * variation;

        points.push(new THREE.Vector2(
            Math.cos(angle) * r,
            Math.sin(angle) * r
        ));
    }

    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        path.lineTo(points[i].x, points[i].y);
    }
    path.closePath();

    return path;
}

function edgeWeightedInput(v, deadZone = 0.2, power = 2.5) {
    const a = Math.abs(v);
    if (a < deadZone) return 0;

    // dead zone 밖을 0~1로 정규화
    const t = (a - deadZone) / (1.0 - deadZone);

    // 가장자리에서 급격히 커지게
    const eased = Math.pow(t, power);

    return Math.sign(v) * eased;
}

export class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.25; // Brighter overall scene
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x0a0d12, 1);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0d12);
        this.scene.fog = new THREE.FogExp2(0x0c121a, 0.02);
        this.shellEnergy = 0.0;
        this.coreEnergy = 0.0;

        this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 160);
        this.camera.position.set(-10, 12, 35);
        this.camera.lookAt(0, 8, -15);

        this.clock = new THREE.Clock();
        this.lights = {};
        this.beams = [];
        this.hazePlanes = [];

        this.initEnvironment();
        this.initInteractiveObject();
        this.initLighting();
        this.initHaze();
        this.initPipes();
        // this.initCables();
        this.initParticles();

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }
    
    createSteppedFloor() {
        const group = new THREE.Group();

        const levels = 4;
        const baseRadius = 35;      // hole 최대 크기
        const stepHeight = 2;
        const plateThickness = 2;

        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x151c26,
            roughness: 0.75,
            metalness: 0.3
        });

        for (let i = 0; i < levels; i++) {
            // 1️⃣ 바깥 바닥 (충분히 큰 사각형)
            const shape = new THREE.Shape();
            const size = 120;
            shape.moveTo(-size, -size);
            shape.lineTo(size, -size);
            shape.lineTo(size, size);
            shape.lineTo(-size, size);
            shape.closePath();

            // 2️⃣ 안쪽 7각형 hole
            const holeRadius = baseRadius * (1 - i * 0.22);
            const hole = createIrregularHeptagonPath(holeRadius, 0.12);
            shape.holes.push(hole);

            // 3️⃣ 얇게 extrude
            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: plateThickness,
                bevelEnabled: false
            });

            geometry.rotateX(-Math.PI / 2);

            const mesh = new THREE.Mesh(geometry, floorMat);
            mesh.receiveShadow = true;

            // 4️⃣ 계단 위치
            mesh.position.y = -i * stepHeight;

            group.add(mesh);
        }
        
        // ===== Bottom solid plate (no hole) =====
        const bottomShape = new THREE.Shape();
        const size = 120;

        bottomShape.moveTo(-size, -size);
        bottomShape.lineTo(size, -size);
        bottomShape.lineTo(size, size);
        bottomShape.lineTo(-size, size);
        bottomShape.closePath();

        const bottomGeometry = new THREE.ExtrudeGeometry(bottomShape, {
            depth: plateThickness,
            bevelEnabled: false
        });

        bottomGeometry.rotateX(-Math.PI / 2);

        const bottomMesh = new THREE.Mesh(bottomGeometry, floorMat);
        bottomMesh.receiveShadow = true;

        // hole 판들보다 한 단계 더 아래
        bottomMesh.position.y = -levels * stepHeight;

        group.add(bottomMesh);

        this.scene.add(group);
    }

    initEnvironment() {
        this.createSteppedFloor();
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x202a3a, // Brighter base wall
            roughness: 0.6,
            metalness: 0.3
        });
        
        const addWallGroup = (w, h, d, x, y, z, rotY = 0) => {
            const group = new THREE.Group();
            const mainWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
            mainWall.receiveShadow = true;
            group.add(mainWall);
            
            for (let i = 0; i < 4; i++) {
                const panel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.12, d * 1.4), wallMat);
                panel.position.y = -h * 0.3 + i * h * 0.2;
                panel.position.z = d * 0.25;
                group.add(panel);
            }
            
            group.position.set(x, y, z);
            group.rotation.y = rotY;
            this.scene.add(group);
        };

        addWallGroup(140, 60, 2, 0, 30, -50); 
        addWallGroup(2, 60, 140, -50, 30, 0); 
        addWallGroup(2, 60, 140, 50, 30, 0); 

        const columnMat = new THREE.MeshStandardMaterial({
            color: 0x121822,
            roughness: 0.5,
            metalness: 0.5
        });
        for (let i = 0; i < 4; i++) {
            const x = (i % 2 === 0 ? -1 : 1) * 42;
            const z = -35 + Math.floor(i / 2) * 50;
            const col = new THREE.Mesh(new THREE.BoxGeometry(5, 60, 5), columnMat);
            col.position.set(x, 30, z);
            col.castShadow = true;
            col.receiveShadow = true;
            this.scene.add(col);
        }

        const windowMat = new THREE.MeshStandardMaterial({
            color: 0x2a364a,
            emissive: 0x9bbce0,
            emissiveIntensity: 1.8,
            transparent: true,
            opacity: 0.8
        });
        const windowGroup = new THREE.Group();
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 6; c++) {
                const pane = new THREE.Mesh(new THREE.PlaneGeometry(8, 12), windowMat);
                pane.position.set(-25 + c * 10, 35 + r * 15, -49.2);
                windowGroup.add(pane);
            }
        }
        this.scene.add(windowGroup);

        this.lightTargets = {
            main: new THREE.Object3D(),
            side: new THREE.Object3D()
        };
        this.lightTargets.main.position.set(0, 8, -15);
        this.lightTargets.side.position.set(-15, 4, -25);
        this.scene.add(this.lightTargets.main, this.lightTargets.side);
    }

    initLighting() {
        this.lights.ambient = new THREE.AmbientLight(0x2a364a, 0.5); // Brighter ambient
        this.scene.add(this.lights.ambient);

        this.lights.key = new THREE.DirectionalLight(0xb2c0d4, 2.0);
        this.lights.key.position.set(30, 60, -70);
        this.lights.key.castShadow = true;
        this.lights.key.shadow.mapSize.set(512, 512);
        this.scene.add(this.lights.key);

        this.lights.spotMain = new THREE.SpotLight(0xd2deec, 4.5, 180, Math.PI / 8, 0.4, 1.2);
        this.lights.spotMain.position.set(45, 60, 40);
        this.lights.spotMain.target = this.lightTargets.main;
        this.lights.spotMain.castShadow = true;
        this.lights.spotMain.shadow.mapSize.set(512, 512);

        this.scene.add(this.lights.spotMain);

        // Dynamic core light - linked to click/drag
        this.lights.accent = new THREE.PointLight(
            0xffa550,
            12.0,   // intensity 대폭 증가
            120,    // distance 확장
            1.0     // decay 완화 (중요!)
        );
        this.lights.accent.position.set(0, 8, -15);
        this.lights.accent.castShadow = false;
        this.scene.add(this.lights.accent);

        this.lights.redMarker = new THREE.PointLight(0xff4444, 1.2, 18);
        this.lights.redMarker.position.set(-20, 5, -35);
        this.scene.add(this.lights.redMarker);

        this.beams.push(this.createBeam(this.lights.spotMain, 120, 20, 0xa5b8cf, 0.3));
        this.beams.forEach((beam) => this.scene.add(beam));
        
        this.lights.coreGlow = new THREE.PointLight(
            0xffa550,
            20.0,
            60,
            1.0
        );
        this.lights.coreGlow.position.copy(this.coreGroup.position);
        this.lights.coreGlow.castShadow = false;
        this.scene.add(this.lights.coreGlow);

    }

    initPipes() {
        const pipeMat = new THREE.MeshStandardMaterial({
            color: 0x1a212b,
            roughness: 0.4,
            metalness: 0.6
        });
        for (let i = 0; i < 8; i++) {
            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 160, 8), pipeMat);
            pipe.rotation.z = Math.PI / 2;
            pipe.position.set(0, 15 + i * 6, -48);
            this.scene.add(pipe);
        }
    }

    initCables() {
        const cableMat = new THREE.LineBasicMaterial({ color: 0x080808, linewidth: 1 });
        for (let i = 0; i < 12; i++) {
            const points = [];
            for (let j = 0; j < 4; j++) {
                points.push(new THREE.Vector3(
                    -60 + Math.random() * 120,
                    60 - j * 15,
                    -60 + Math.random() * 120
                ));
            }
            const curve = new THREE.CatmullRomCurve3(points);
            const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(16));
            const cable = new THREE.Line(geometry, cableMat);
            this.scene.add(cable);
        }
    }

    initParticles() {
        const count = 0; // Optimized count
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const offsets = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = Math.random() * 140 - 70;
            positions[i * 3 + 1] = Math.random() * 60;
            positions[i * 3 + 2] = Math.random() * 140 - 70;
            offsets[i] = Math.random() * Math.PI * 2;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('offset', new THREE.BufferAttribute(offsets, 1));
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                energy: { value: 0 },
                color: { value: new THREE.Color(0xffffff) }
            },
            vertexShader: `
                uniform float time;
                uniform float energy;
                attribute float offset;
                void main() {
                    vec3 pos = position;
                    pos.y += sin(time * 0.4 + offset) * (1.0 + energy * 3.0);
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    float size = 2.0 * (120.0 / -mvPosition.z);
                    gl_PointSize = clamp(size, 1.0, 6.0);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                void main() {
                    if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
                    gl_FragColor = vec4(color, 0.35);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    initInteractiveObject() {
        this.coreGroup = new THREE.Group();
        this.coreGroup.position.set(0, 10, -15);

        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x4a5568,
            roughness: 0.25,
            metalness: 0.35
        });
        
        this.rings = [];
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(4 + i * 2.5, 0.25, 12, 64),
                ringMat
            );
            this.coreGroup.add(ring);
            this.rings.push(ring);
        }

        // ===== Core Inner (no fog, sharp energy) =====
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0x2a1a0a,
            emissive: 0xffa550,
            emissiveIntensity: 0.0,
            metalness: 0.0,
            roughness: 0.95,
            fog: false
        });

        this.coreInner = new THREE.Mesh(
            new THREE.SphereGeometry(1.8, 32, 32),
            coreMat
        );

        // ===== Core Haze Shell (fog enabled, soft glow) =====
        this.coreShells = [];

        const shellConfigs = [
            { scale: 1.20, opacity: 0.40, emissive: 0.4 },
            { scale: 1.40, opacity: 0.34, emissive: 0.25 },
            { scale: 1.55, opacity: 0.28, emissive: 0.12 }
        ];

        shellConfigs.forEach(cfg => {
            const mat = new THREE.MeshStandardMaterial({
                color: 0xffa550,
                emissive: 0xffa550,
                emissiveIntensity: cfg.emissive,
                transparent: true,
                opacity: cfg.opacity,
                roughness: 1.0,
                metalness: 0.0,
                fog: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });

            const shell = new THREE.Mesh(
                new THREE.SphereGeometry(1.8 * cfg.scale, 32, 32),
                mat
            );
            
            shell.scale.setScalar(1.0);
            shell.material.opacity = 0.0;

            this.coreGroup.add(shell);
            this.coreShells.push(shell);
        });

        // 렌더 순서 중요: 쉘 → 이너
        this.coreGroup.add(this.coreInner);

        this.scene.add(this.coreGroup);
    }

    initHaze() {
        const hazeMat = new THREE.MeshBasicMaterial({
            color: 0x2a344a,
            transparent: true,
            opacity: 0.025,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        for (let i = 0; i < 3; i++) {
            const haze = new THREE.Mesh(new THREE.PlaneGeometry(150, 60), hazeMat.clone());
            haze.position.set(0, 30, -35 + i * 25);
            this.hazePlanes.push(haze);
            this.scene.add(haze);
        }
    }

    createBeam(light, length, radius, color, opacity) {
        const geometry = new THREE.ConeGeometry(radius, length, 24, 1, true);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        const beam = new THREE.Mesh(geometry, material);
        beam.position.copy(light.position);
        beam.lookAt(light.target.position);
        beam.rotateX(Math.PI / 2);
        beam.translateY(-length / 2);
        return beam;
    }

    updateLighting(energy, focus) {
        const { dragForce, dragActive } = signals.params;
        const interactionBoost = dragActive * (0.8 + dragForce * 4.0);
        
        this.lights.key.intensity = 2.0 + energy * 1.5;
        this.lights.spotMain.intensity = 4.5 + focus * 3.5;
        
        // Massive core light emission spreading into space
        const coreIntensity = 4.0 + interactionBoost * 60.0 + energy * 10.0;
        this.lights.accent.intensity =
            THREE.MathUtils.clamp(coreIntensity, 0, 40);

        this.lights.accent.distance =
            120 + interactionBoost * 120;

        this.lights.accent.decay = 1.0;

        // Sync light position with moving core
        this.lights.accent.position.copy(this.coreGroup.position);
        
        // 목표 에너지 (클릭 중이면 1, 아니면 0)
        const targetCoreEnergy = dragActive ? 1.0 : 0.0;
        this.coreEnergy += (targetCoreEnergy - this.coreEnergy) * 0.08;
        
        this.coreInner.material.emissiveIntensity =
            THREE.MathUtils.lerp(0.8, 4.5, this.coreEnergy);

        this.beams[0].material.opacity = 0.25 + focus * 0.45;
        this.hazePlanes.forEach((haze, index) => {
            haze.material.opacity =
                0.025 + focus * 0.04 - index * 0.008;
        });
        
        this.lights.coreGlow.intensity =
            THREE.MathUtils.clamp(2.0 + interactionBoost * 12.0, 0, 16);

        this.lights.coreGlow.position.copy(this.coreGroup.position);
        
        this.coreShells.forEach((shell, i) => {
            const cfg = [1.20, 1.40, 1.55][i];

            // scale
            const targetScale = THREE.MathUtils.lerp(1.0, cfg, this.coreEnergy);
            shell.scale.setScalar(targetScale);

            // opacity
            shell.material.opacity =
                THREE.MathUtils.lerp(0.0, 0.35 - i * 0.06, this.coreEnergy);
        });
    }

    updateCamera(position) {
        const t = this.clock.elapsedTime;
        
        // 🔴 반드시 필요
        this._lookTarget ||= new THREE.Vector3();
        this._lookTargetCurrent ||= new THREE.Vector3(0, 10, -15);

        // === 마우스 [-0.5, 0.5] ===
        const positionRange = 2.0
        const mxRaw = (position.x - 0.5) * positionRange;
        const myRaw = (position.y - 0.5) * positionRange;
        
        // === dead zone + edge emphasis ===
        const mx = edgeWeightedInput(mxRaw, 0.25, 3.0);
        const my = edgeWeightedInput(myRaw, 0.25, 3.0);

        // === 카메라 위치 (거의 고정) ===
        const basePos = this._baseCamPos ||= new THREE.Vector3();
        basePos.set(
            -12 + Math.sin(t * 0.3) * 1.2,
            16  + Math.cos(t * 0.25) * 1.0,
            45
        );
        this.camera.position.lerp(basePos, 0.05);

        // === 목표 시선 ===
        const lookBase = this._lookBase ||= new THREE.Vector3(0, 10, -15);
        this._lookTarget.set(
            lookBase.x + mx * 4.0,
            lookBase.y + my * 4.0,
            lookBase.z
        );

        // === 🔑 핵심: 비대칭 반응 속도 ===
        const inputMagnitude = Math.max(Math.abs(mx), Math.abs(my));

        if (inputMagnitude > 0.01) {
            // ✅ 가장자리: 즉각 반응 (스냅)
            this._lookTargetCurrent.copy(this._lookTarget);
        } else {
            // ✅ 중앙 복귀: 천천히
            this._lookTargetCurrent.lerp(this._lookTarget, 0.04);
        }

        this.camera.lookAt(this._lookTargetCurrent);
    }


    updateCore(dragForce, energy) {
        const { dragActive } = signals.params;
        const t = this.clock.elapsedTime;
        this.rings.forEach((ring, i) => {
            ring.rotation.x += 0.012 * (i + 1) + dragForce * 0.12;
            ring.rotation.z += 0.018 * (i + 1) + dragForce * 0.18;
            ring.scale.setScalar(1 + Math.sin(t * 2.5 + i) * 0.06 * energy);
        });
        this.coreGroup.position.y = 10 + Math.sin(t * 1.8) * 1.2 + dragForce * 5.0;
    }

    draw() {
        const dt = this.clock.getDelta();
        if (dt > 0.1) return;

        const { energy, focus, position, dragForce } = signals.params;
        
        // Use GPU for particle updates
        if (this.particles) {
            this.particles.material.uniforms.time.value = this.clock.elapsedTime;
            this.particles.material.uniforms.energy.value = energy;
        }

        this.updateLighting(energy, focus);
        this.updateCamera(position);
        this.updateCore(dragForce, energy);

        this.beams.forEach((beam) => {
            beam.position.copy(this.lights.spotMain.position);
            beam.lookAt(this.lights.spotMain.target.position);
            beam.rotateX(Math.PI / 2);
            beam.translateY(-60);
        });

        this.renderer.render(this.scene, this.camera);
    }
}