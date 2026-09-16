import * as THREE from 'three';
import { asset } from '../content/world';

const loader = new THREE.TextureLoader();
const maps = new Map<string, THREE.Texture>();
function texture(name: string): THREE.Texture {
  if (!maps.has(name)) {
    const map = loader.load(asset(`assets/legacy/${name}.jpg`));
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    maps.set(name, map);
  }
  return maps.get(name)!;
}
export function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.12, 'rgba(255,255,255,.9)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,.14)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
export function planet(name: string, radius: number, color: string, star = false): THREE.Group {
  const group = new THREE.Group();
  const names: Record<string, string> = {
    地球: 'earth',
    火星: 'mars',
    木星: 'jupiter',
    土星: 'saturn',
    天王星: 'uranus',
    海王星: 'neptune',
  };
  const geometry = new THREE.SphereGeometry(radius, 64, 40);
  let material: THREE.Material;
  if (star) {
    material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(color) } },
      vertexShader:
        'varying vec3 pos; varying vec3 norm; void main(){pos=position; norm=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 pos; varying vec3 norm; uniform float time; uniform vec3 color;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){float n=noise(pos*7.+vec3(time*.08));n+=.5*noise(pos*19.-time*.03);float edge=pow(max(0.,norm.z),.4);gl_FragColor=vec4(color*(1.15+n*.5)*(.55+edge*.6),1.);}`,
    });
  } else {
    material = new THREE.MeshStandardMaterial({
      map: names[name] ? texture(names[name]) : null,
      color: names[name] ? '#ffffff' : color,
      roughness: 0.92,
      metalness: 0.04,
    });
  }
  const sphere = new THREE.Mesh(geometry, material);
  sphere.userData.spinning = true;
  group.add(sphere);
  if (star) {
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.scale.setScalar(radius * 9);
    group.add(halo);
  } else if (name !== '水星' && name !== '火星') {
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.07, 48, 32),
      new THREE.ShaderMaterial({
        uniforms: { glowColor: { value: new THREE.Color(name === '地球' ? '#5bb5fc' : color) } },
        vertexShader:
          'varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vPosition=mv.xyz;gl_Position=projectionMatrix*mv;}',
        fragmentShader:
          'uniform vec3 glowColor; varying vec3 vNormal; varying vec3 vPosition; void main(){float facing=dot(vNormal,normalize(-vPosition));float intensity=pow(1.-abs(facing),4.);gl_FragColor=vec4(glowColor,intensity*.65);}',
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    );
    group.add(atmosphere);
  }
  if (name === '土星') {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.35, radius * 2.05, 100, 6),
      new THREE.MeshStandardMaterial({
        color: '#c3b394',
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
        roughness: 1,
      }),
    );
    ring.rotation.x = -Math.PI / 2.25;
    group.add(ring);
    for (const r of [1.4, 1.5, 1.68, 1.8, 1.98]) {
      const gap = new THREE.Mesh(
        new THREE.RingGeometry(radius * r, radius * (r + 0.018), 100),
        new THREE.MeshBasicMaterial({
          color: '#111621',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55,
        }),
      );
      gap.rotation.copy(ring.rotation);
      group.add(gap);
    }
  }
  return group;
}
export function ship(color = '#80cbe8'): THREE.Group {
  const group = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({
    color: '#a4b3bf',
    metalness: 0.72,
    roughness: 0.34,
  });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.15, 4), hull);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.07, 0.4), hull);
  wing.position.z = 0.23;
  group.add(wing);
  const engine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.04, 0.5, 8),
    new THREE.MeshBasicMaterial({ color }),
  );
  engine.rotation.x = Math.PI / 2;
  engine.position.z = 0.8;
  group.add(engine);
  return group;
}
export function disposeGroup(group: THREE.Object3D): void {
  group.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Points
    ) {
      object.geometry.dispose();
      for (const mat of Array.isArray(object.material) ? object.material : [object.material])
        mat.dispose();
    } else if (object instanceof THREE.Sprite) {
      object.material.map?.dispose();
      object.material.dispose();
    }
  });
  group.clear();
}
