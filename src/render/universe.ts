import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { GameState, Settings } from '../game/types';
import { disposeGroup, glowTexture, planet, ship } from './planets';

export class Universe {
  private renderer?: THREE.WebGLRenderer;
  private composer?: EffectComposer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(43, 1, 0.1, 1200);
  private controls?: OrbitControls;
  private worlds = new THREE.Group();
  private fleets = new THREE.Group();
  private halo = new THREE.Group();
  private starfield = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private labels: { element: HTMLButtonElement; object: THREE.Object3D; id: number }[] = [];
  private mode: 'menu' | 'map' | 'battle' = 'menu';
  private sector = -1;
  private signature = '';
  private settings: Settings;
  private time = 0;
  private last = 0;
  private frame = 0;
  private targetCamera: THREE.Vector3 | null = null;
  private targetLook = new THREE.Vector3();
  private shots: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
  private fallback = false;
  private resizeObserver: ResizeObserver;
  private down = { x: 0, y: 0 };
  constructor(
    private container: HTMLElement,
    private labelContainer: HTMLElement,
    settings: Settings,
    private onSelect: (id: number) => void,
  ) {
    this.settings = settings;
    this.labelContainer.removeAttribute('aria-hidden');
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      this.renderer.setClearColor('#030711');
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
      this.container.append(this.renderer.domElement);
      this.renderer.domElement.setAttribute(
        'aria-label',
        '三维星图：拖动旋转，滚轮缩放；也可使用星球目录选择目标',
      );
      this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.enableFallback();
      });
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.minDistance = 8;
      this.controls.maxDistance = 110;
      this.controls.maxPolarAngle = Math.PI * 0.82;
      this.controls.addEventListener('start', () => {
        this.targetCamera = null;
      });
      this.renderer.domElement.addEventListener('pointerdown', (e) => {
        this.down = { x: e.clientX, y: e.clientY };
      });
      this.renderer.domElement.addEventListener('pointerup', (e) => this.pick(e));
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.5, 1.05));
      this.composer.addPass(new OutputPass());
    } catch {
      this.enableFallback();
    }
    this.scene.add(new THREE.AmbientLight('#799bc3', 1.3));
    const sunlight = new THREE.DirectionalLight('#fff0d9', 3.6);
    sunlight.position.set(-20, 12, 20);
    this.scene.add(sunlight);
    const rim = new THREE.DirectionalLight('#599cec', 1.1);
    rim.position.set(12, -2, -20);
    this.scene.add(rim);
    this.scene.add(this.worlds, this.fleets, this.halo, this.starfield);
    this.makeStars();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.applySettings(settings);
    this.menu();
    this.frame = requestAnimationFrame((t) => this.animate(t));
  }
  private enableFallback(): void {
    this.fallback = true;
    this.container.classList.add('fallback');
    this.container.setAttribute('data-renderer', '2d');
    this.labelContainer.classList.add('fallback-labels');
    if (this.renderer) this.renderer.domElement.hidden = true;
    for (const { element } of this.labels) element.hidden = false;
  }
  private makeStars(): void {
    const positions: number[] = [],
      colors: number[] = [];
    let seed = 81357;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 4500; i++) {
      const theta = rand() * Math.PI * 2,
        z = rand() * 2 - 1,
        radius = 190 + rand() * 160;
      positions.push(
        Math.sqrt(1 - z * z) * Math.cos(theta) * radius,
        z * radius,
        Math.sqrt(1 - z * z) * Math.sin(theta) * radius,
      );
      const light = 0.3 + rand() * 0.7;
      colors.push(light * 0.83, light * 0.9, light);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.starfield.add(
      new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          size: 0.65,
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          sizeAttenuation: true,
        }),
      ),
    );
    for (let i = 0; i < 6; i++) {
      const nebula = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture(),
          color: i % 2 ? '#183b67' : '#345962',
          transparent: true,
          opacity: 0.13,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      nebula.position.set(-100 + i * 43, -40 + i * 9, -150);
      nebula.scale.set(180, 90, 1);
      this.starfield.add(nebula);
    }
  }
  applySettings(settings: Settings): void {
    this.settings = settings;
    this.renderer?.setPixelRatio(Math.min(devicePixelRatio, settings.quality === 'low' ? 1 : 1.7));
    document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
    this.resize();
  }
  private resize(): void {
    const width = this.container.clientWidth || innerWidth,
      height = this.container.clientHeight || innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(width, height);
    this.composer?.setSize(width, height);
    if (this.mode === 'menu') {
      this.camera.position.set(0, 2, width < 700 ? 31 : 24);
      this.camera.lookAt(0, 0, 0);
    }
  }
  menu(): void {
    this.mode = 'menu';
    this.signature = '';
    this.sector = -1;
    disposeGroup(this.worlds);
    disposeGroup(this.fleets);
    disposeGroup(this.halo);
    this.clearLabels();
    const earth = planet('地球', 6.4, '#61b7ed');
    earth.position.set(5.8, -0.8, 0);
    earth.rotation.z = -0.17;
    earth.rotation.y = 2.45;
    this.worlds.add(earth);
    const orbit = this.orbit(8.7, '#83adc5', 0.24);
    orbit.position.copy(earth.position);
    orbit.rotation.z = -0.3;
    this.worlds.add(orbit);
    const craft = ship();
    craft.scale.setScalar(0.5);
    craft.position.set(1, -1, 8);
    craft.rotation.set(0.2, -0.7, 0.1);
    this.fleets.add(craft);
    if (this.controls) {
      this.controls.enabled = false;
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
    this.targetCamera = null;
    this.resize();
  }
  private orbit(radius: number, color: string, opacity: number): THREE.LineLoop {
    const points = Array.from(
      { length: 160 },
      (_, i) =>
        new THREE.Vector3(
          Math.cos((i / 160) * Math.PI * 2) * radius,
          0,
          Math.sin((i / 160) * Math.PI * 2) * radius,
        ),
    );
    return new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
  }
  sync(state: GameState, sector: number, selected: number): void {
    const mode = state.battle ? 'battle' : 'map';
    const stars = state.stars.filter((s) => s.sector === sector && s.exists);
    const signature =
      mode === 'battle'
        ? `battle-${state.battle!.myStar}-${state.battle!.enemyStar}-${state.battle!.round}`
        : `${sector}:${stars.map((s) => `${s.id}/${s.discovered}/${s.owner}`).join(',')}`;
    if (signature !== this.signature || this.mode !== mode) {
      const changed = this.mode !== mode || this.sector !== sector;
      this.signature = signature;
      this.mode = mode;
      this.sector = sector;
      disposeGroup(this.worlds);
      disposeGroup(this.fleets);
      this.clearLabels();
      if (this.controls) this.controls.enabled = true;
      if (mode === 'battle') {
        const backdrop = planet('地球', 6, '#7cb3da');
        backdrop.position.set(0, -8, -14);
        this.worlds.add(backdrop);
        for (const [side, units] of [state.battle!.mine, state.battle!.enemy].entries()) {
          units
            .filter((u) => u.hp > 0)
            .forEach((unit, i) => {
              const craft = ship(side ? '#ee8575' : '#8de7ff');
              craft.position.set(
                (side ? 1 : -1) * (4 + (i % 3) * 1.2),
                Math.floor(i / 3) * 0.8,
                ((i % 3) - 1) * 2.2,
              );
              craft.rotation.y = side ? Math.PI / 2 : -Math.PI / 2;
              craft.scale.setScalar(unit.def ? 1.3 : 0.85);
              this.fleets.add(craft);
            });
        }
        if (changed) this.moveCamera(new THREE.Vector3(0, 10, 22), new THREE.Vector3(0, 0, 0));
      } else {
        for (const star of stars) {
          const visible = star.discovered || sector === 0;
          const world = planet(
            visible ? star.name : '',
            sector ? 0.3 + star.radius * 0.22 : star.radius,
            visible ? star.color : '#536577',
            visible && !star.planet,
          );
          world.position.fromArray(star.position);
          world.userData.starId = star.id;
          this.worlds.add(world);
          if (sector === 0 && star.id > 1) {
            const orbit = this.orbit(
              Math.hypot(star.position[0], star.position[2]),
              '#638398',
              0.15,
            );
            this.worlds.add(orbit);
          }
          const label = document.createElement('button');
          label.type = 'button';
          label.className = `star-label ${star.owner === 'earth' ? 'friendly' : ''}`;
          label.textContent = visible ? star.name : `未知信号 ${String(star.id).padStart(3, '0')}`;
          label.setAttribute('aria-label', `选择${label.textContent}`);
          label.onclick = () => this.onSelect(star.id);
          this.labelContainer.append(label);
          this.labels.push({ element: label, object: world, id: star.id });
        }
        if (changed) this.resetCamera();
      }
    }
    disposeGroup(this.halo);
    if (mode === 'map') {
      const star = state.stars[selected];
      if (star?.sector === sector && star.exists) {
        const ring = this.orbit((sector ? 0.6 : star.radius) + 0.5, '#9ddcf5', 0.85);
        ring.position.fromArray(star.position);
        this.halo.add(ring);
      }
    }
    for (const label of this.labels) {
      label.element.classList.toggle('selected', label.id === selected);
      label.element.setAttribute('aria-pressed', String(label.id === selected));
    }
  }
  resetCamera(): void {
    this.moveCamera(
      new THREE.Vector3(0, this.sector === 0 ? 28 : 40, this.sector === 0 ? 35 : 47),
      new THREE.Vector3(),
    );
  }
  focus(id: number): void {
    const world = this.worlds.children.find((o) => o.userData.starId === id);
    if (!world) return;
    this.moveCamera(world.position.clone().add(new THREE.Vector3(0, 5, 12)), world.position);
  }
  private moveCamera(position: THREE.Vector3, look: THREE.Vector3): void {
    this.targetCamera = position.clone();
    this.targetLook.copy(look);
    if (this.settings.reducedMotion) {
      this.camera.position.copy(position);
      this.controls?.target.copy(look);
      this.targetCamera = null;
    }
  }
  private pick(event: PointerEvent): void {
    if (
      this.mode !== 'map' ||
      Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) > 6 ||
      !this.renderer
    )
      return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    for (const hit of this.raycaster.intersectObjects(this.worlds.children, true)) {
      let object: THREE.Object3D | null = hit.object;
      while (object && object.userData.starId === undefined) object = object.parent;
      if (object) {
        this.onSelect(object.userData.starId);
        return;
      }
    }
  }
  fire(): void {
    if (this.settings.reducedMotion || this.fallback) return;
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.025, 0.025),
        new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffad79' : '#a1efff' }),
      );
      mesh.position.set(i % 2 ? 6 : -6, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 5);
      this.scene.add(mesh);
      this.shots.push({
        mesh,
        velocity: new THREE.Vector3(i % 2 ? -18 : 18, 0, 0),
        life: 0.65 + Math.random() * 0.2,
      });
    }
  }
  private clearLabels(): void {
    this.labelContainer.replaceChildren();
    this.labels = [];
  }
  private animate(now: number): void {
    this.frame = requestAnimationFrame((t) => this.animate(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (document.hidden) return;
    this.time += dt;
    if (this.targetCamera && this.controls) {
      this.camera.position.lerp(this.targetCamera, 0.065);
      this.controls.target.lerp(this.targetLook, 0.065);
      if (this.camera.position.distanceTo(this.targetCamera) < 0.03) this.targetCamera = null;
    }
    if (!this.settings.reducedMotion)
      this.worlds.traverse((o) => {
        if (o.userData.spinning) {
          o.rotation.y += dt * 0.025;
          if (
            o instanceof THREE.Mesh &&
            o.material instanceof THREE.ShaderMaterial &&
            o.material.uniforms.time
          )
            o.material.uniforms.time.value = this.time;
        }
      });
    for (const shot of [...this.shots]) {
      shot.life -= dt;
      shot.mesh.position.addScaledVector(shot.velocity, dt);
      if (shot.life <= 0) {
        this.scene.remove(shot.mesh);
        shot.mesh.geometry.dispose();
        (shot.mesh.material as THREE.Material).dispose();
        this.shots.splice(this.shots.indexOf(shot), 1);
      }
    }
    this.controls?.update();
    if (!this.fallback && this.renderer) {
      if (this.settings.quality === 'high') this.composer?.render();
      else this.renderer.render(this.scene, this.camera);
      const width = this.container.clientWidth,
        height = this.container.clientHeight;
      for (const { object, element } of this.labels) {
        const projected = object.position.clone().project(this.camera);
        const x = (projected.x * 0.5 + 0.5) * width,
          y = (-projected.y * 0.5 + 0.5) * height;
        element.style.transform = `translate(${x}px,${y + 19}px) translateX(-50%)`;
        element.hidden = projected.z > 1 || x < 0 || x > width || y < 55 || y > height - 85;
      }
    }
  }
  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls?.dispose();
    disposeGroup(this.scene);
    this.composer?.dispose();
    this.renderer?.dispose();
    this.clearLabels();
  }
}
