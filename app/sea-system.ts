import * as THREE from 'three';

// Render the moving yacht separately, then refract and defocus its actual light
// across the water. The sea never becomes a uniformly lit colored plane.
// Shared by the mesh, floating lights, and their reflection patches.
// Gentle swells stay below the hull's lowest samples.
const surfaceWaves = `
float seaHeight(vec2 p, float time) {
  return -0.075
    + sin(dot(p, vec2(0.34, 0.18)) + time * 0.42) * 0.060
    + sin(dot(p, vec2(-0.21, 0.51)) - time * 0.36) * 0.031
    + sin(dot(p, vec2(0.90, -0.65)) + time * 0.57) * 0.011;
}
vec2 seaSlope(vec2 p, float time) {
  return cos(dot(p, vec2(0.34, 0.18)) + time * 0.42) * 0.060 * vec2(0.34, 0.18)
    + cos(dot(p, vec2(-0.21, 0.51)) - time * 0.36) * 0.031 * vec2(-0.21, 0.51)
    + cos(dot(p, vec2(0.90, -0.65)) + time * 0.57) * 0.011 * vec2(0.90, -0.65);
}
vec2 drift(vec2 p, float seed, float time) {
  return p + vec2(sin(time * 0.18 + seed * 6.28), cos(time * 0.15 + seed * 9.0)) * 0.055;
}
`;
const waterVertex = `
uniform float uTime;
varying vec3 vWorld;
${surfaceWaves}
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  world.y = seaHeight(world.xz, uTime);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const waterFragment = `
uniform sampler2D uReflection;
uniform vec2 uResolution;
uniform float uTime, uWaterline, uDpr;
varying vec3 vWorld;
${surfaceWaves}
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float below = max(0.0, uWaterline - uv.y);
  float nearWater = smoothstep(0.015, 0.34, below);
  // Multiple ripple scales keep the reflected columns broken and irregular.
  float wave = sin(vWorld.z * 8.5 + sin(vWorld.x * 0.55) + uTime * 0.85);
  float wave2 = sin(vWorld.z * 19.0 - uTime * 0.62 + sin(vWorld.x * 1.2));
  vec2 slope = seaSlope(vWorld.xz, uTime);
  vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 view = normalize(cameraPosition - vWorld);
  vec3 viewNormal = mat3(viewMatrix) * normal;
  vec2 sampleUv = uv;
  sampleUv += viewNormal.xy * (0.002 + nearWater * 0.007);
  sampleUv.x += (wave + wave2 * 0.35) * (0.00024 + below * 0.012);
  sampleUv.y += sin(vWorld.z * 11.0 + uTime * 0.52) * (0.0002 + below * 0.0016);
  // Optical falloff: crisp at the vessel, soft discs and streaks near the lens.
  vec2 blur = vec2(0.32 + nearWater * 4.8, 0.35 + nearWater * 8.0) * uDpr / uResolution;
  vec3 light = texture2D(uReflection, sampleUv).rgb * 0.22;
  light += texture2D(uReflection, sampleUv + vec2(blur.x, 0.0)).rgb * 0.12;
  light += texture2D(uReflection, sampleUv - vec2(blur.x, 0.0)).rgb * 0.12;
  light += texture2D(uReflection, sampleUv + vec2(0.0, blur.y)).rgb * 0.12;
  light += texture2D(uReflection, sampleUv - vec2(0.0, blur.y)).rgb * 0.12;
  light += texture2D(uReflection, sampleUv + blur).rgb * 0.075;
  light += texture2D(uReflection, sampleUv - blur).rgb * 0.075;
  light += texture2D(uReflection, sampleUv + vec2(blur.x, -blur.y)).rgb * 0.075;
  light += texture2D(uReflection, sampleUv + vec2(-blur.x, blur.y)).rgb * 0.075;
  float broken = 0.48 + 0.52 * smoothstep(-0.7, 0.6, wave * 0.65 + wave2 * 0.35);
  light *= broken * mix(1.12, 0.65, nearWater);
  // A few fine horizontal catches interrupt the vertical light paths.
  float ripple = pow(max(0.0, sin(vWorld.z * 25.0 + wave * 0.65 - uTime)), 16.0);
  float reflectionEnergy = dot(light, vec3(0.333));
  light += vec3(ripple * reflectionEnergy * 0.24);
  // A faint grazing sheen reveals the rolling surface between the lights.
  float fresnel = pow(1.0 - max(0.0, dot(normal, view)), 4.0);
  float swell = smoothstep(-0.018, 0.035, slope.x * 0.45 + slope.y);
  float distanceFade = exp(-length(vWorld.xz) * 0.017);
  vec3 sheen = vec3(0.70, 0.73, 0.71) * fresnel * swell * distanceFade * 0.0025;
  gl_FragColor = vec4(vec3(0.00012) + sheen + light, 1.0);
}`;
const particleVertex = `
attribute vec4 aData;
uniform float uTime, uDpr;
varying float vAlpha, vType, vSoft;
${surfaceWaves}
void main() {
  float seed = aData.x;
  vType = aData.z;
  vec3 p = position;
  p.xz = drift(p.xz, seed, uTime);
  p.y = seaHeight(p.xz, uTime) + 0.018;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = max(1.0, -mv.z);
  float focus = 1.0 - smoothstep(7.0, 27.0, depth);
  vSoft = focus;
  float phase = seed * 91.0 + dot(p.xz, vec2(0.37, 0.21));
  float breathe = 0.5 + 0.5 * sin(uTime * (0.27 + seed * 0.48) + phase);
  float glint = pow(0.5 + 0.5 * sin(uTime * (0.62 + seed * 0.39) + phase * 1.7), 10.0);
  float life = 0.68 + breathe * 0.56 + glint * 0.22;
  float size = (9.0 + pow(seed, 3.0) * 54.0) / depth;
  vAlpha = (0.12 + seed * 0.85) * (0.58 + breathe * 0.30 + glint * 0.40);
  if (vType > 0.5 && vType < 1.5) {
    size = (13.0 + pow(seed, 2.8) * 62.0) / depth;
    vAlpha *= 1.2;
  }
  if (vType > 1.5) {
    size = aData.y * (0.24 + focus * 1.2);
    vAlpha = (0.55 + seed * 0.65) * (0.65 + breathe * 0.25 + glint * 0.30);
  }
  size *= life;
  vSoft = clamp(focus * 0.8 + smoothstep(7.0, 25.0, size) * 0.2, 0.0, 1.0);
  vAlpha *= smoothstep(1.0, 4.0, depth);
  gl_PointSize = clamp(size * uDpr, 0.55 * uDpr, 32.0 * uDpr);
  gl_Position = projectionMatrix * mv;
  if (mv.z > -0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vAlpha = 0.0; }
}`;
const particleFragment = `
varying float vAlpha, vType, vSoft;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float radius = length(p);
  if (radius > 0.5) discard;
  float core = 1.0 - smoothstep(mix(0.12, 0.02, vSoft), 0.49, radius);
  if (vType < 1.5) core = pow(max(0.0, 1.0 - radius * 2.0), 1.3);
  float alpha = core * vAlpha;
  vec3 pearl = vec3(1.0, 0.99, 0.95);
  gl_FragColor = vec4(pearl * (vType > 1.5 ? 1.7 : 1.1), alpha);
}`;

// Small, view-aligned reflection patches lie on the same moving water mesh.
// They replace the old chain of floating screen-space ghost particles.
const glintReflectionVertex = `
attribute vec3 aAnchor;
attribute vec4 aData;
uniform float uTime;
varying vec2 vUv;
varying float vAlpha;
${surfaceWaves}
void main() {
  vUv = uv;
  vec2 center = drift(aAnchor.xz, aData.x, uTime);
  vec2 toEye = cameraPosition.xz - center;
  vec2 along = toEye / max(length(toEye), 0.001);
  vec2 across = vec2(-along.y, along.x);
  float foreground = step(1.5, aData.z);
  float width = mix(0.022 + aData.x * 0.026, 0.045 + aData.y * 0.009, foreground);
  float length = width * 5.0;
  vec2 p = center + across * position.x * width + along * (position.y + 0.5) * length;
  vec3 world = vec3(p.x, seaHeight(p, uTime) + 0.003, p.y);
  float phase = aData.x * 91.0 + dot(center, vec2(0.37, 0.21));
  float breathe = 0.5 + 0.5 * sin(uTime * (0.27 + aData.x * 0.48) + phase);
  vAlpha = mix(0.22, 0.42, foreground) * (0.65 + breathe * 0.35);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const glintReflectionFragment = `
varying vec2 vUv;
varying float vAlpha;
void main() {
  float crossFade = exp(-pow((vUv.x - 0.5) * 4.2, 2.0));
  float fade = exp(-vUv.y * 3.8) * (1.0 - smoothstep(0.72, 1.0, vUv.y));
  float broken = 0.62 + 0.38 * pow(0.5 + 0.5 * sin(vUv.y * 27.0), 2.0);
  gl_FragColor = vec4(0.95, 0.94, 0.90, crossFade * fade * broken * vAlpha);
}`;

export function createSea(scene: THREE.Scene, mobile: boolean, dpr: number) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, depthBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  const reflectionScene = new THREE.Scene();
  reflectionScene.background = new THREE.Color(0x000000);
  const resolution = new THREE.Vector2(1, 1);
  const waterMaterial = new THREE.ShaderMaterial({
    vertexShader: waterVertex, fragmentShader: waterFragment, depthWrite: false,
    uniforms: {
      uReflection: { value: target.texture }, uResolution: { value: resolution },
      uTime: { value: 0 }, uWaterline: { value: 0.4 }, uDpr: { value: dpr },
    },
  });
  const waterGeometry = new THREE.PlaneGeometry(300, 300, mobile ? 192 : 320, mobile ? 192 : 320);
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.075;
  water.renderOrder = -2;
  scene.add(water);

  let state = 74193;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const positions: number[] = [], data: number[] = [];
  function point(x: number, z: number, seed: number, size: number, kind: number) {
    positions.push(x, 0, z); data.push(seed, size, kind, 0);
  }
  // World-space samples surround the yacht, so every camera heading reveals
  // another part of the same sea rather than rotating the vessel on a backdrop.
  const horizonCount = mobile ? 1350 : 2200;
  for (let i = 0; i < horizonCount; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 3 + Math.pow(random(), 1.65) * 90;
    point(Math.cos(angle) * radius, Math.sin(angle) * radius, random(), 1, 1);
  }
  for (let i = 0; i < (mobile ? 200 : 350); i++) {
    const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * 125;
    point(Math.cos(angle) * radius, Math.sin(angle) * radius, random(), 1, 0);
  }
  for (let i = 0; i < (mobile ? 60 : 95); i++) {
    const angle = random() * Math.PI * 2, radius = 10 + Math.sqrt(random()) * 32;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const seed = random(), size = 3 + Math.pow(random(), 2.4) * 22;
    point(x, z, seed, size, 2);
  }
  const particlesGeometry = new THREE.BufferGeometry();
  particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  particlesGeometry.setAttribute('aData', new THREE.Float32BufferAttribute(data, 4));
  const particlesMaterial = new THREE.ShaderMaterial({
    vertexShader: particleVertex, fragmentShader: particleFragment,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDpr: { value: dpr }, uResolution: { value: resolution } },
  });
  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  particles.frustumCulled = false;
  scene.add(particles);
  const patchBase = new THREE.PlaneGeometry(1, 1, 1, 8);
  const patchGeometry = new THREE.InstancedBufferGeometry();
  patchGeometry.index = patchBase.index;
  patchGeometry.attributes.position = patchBase.attributes.position;
  patchGeometry.attributes.uv = patchBase.attributes.uv;
  patchGeometry.setAttribute('aAnchor', new THREE.InstancedBufferAttribute(new Float32Array(positions), 3));
  patchGeometry.setAttribute('aData', new THREE.InstancedBufferAttribute(new Float32Array(data), 4));
  patchGeometry.instanceCount = positions.length / 3;
  const patchMaterial = new THREE.ShaderMaterial({
    vertexShader: glintReflectionVertex, fragmentShader: glintReflectionFragment,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
  });
  const patches = new THREE.Mesh(patchGeometry, patchMaterial);
  patches.frustumCulled = false;
  patches.renderOrder = -1;
  scene.add(patches);
  const waterline = new THREE.Vector3();
  return {
    reflectionScene,
    resize(width: number, height: number) {
      resolution.set(Math.round(width * dpr), Math.round(height * dpr));
      // Half-resolution reflections provide optical softness and limit fill cost.
      target.setSize(Math.max(1, Math.round(width * dpr * 0.65)), Math.max(1, Math.round(height * dpr * 0.65)));
    },
    render(renderer: THREE.WebGLRenderer, camera: THREE.Camera, time: number) {
      waterMaterial.uniforms.uTime.value = time;
      particlesMaterial.uniforms.uTime.value = time;
      patchMaterial.uniforms.uTime.value = time;
      camera.updateMatrixWorld();
      waterline.set(0, 0, 0).project(camera);
      waterMaterial.uniforms.uWaterline.value = waterline.y * 0.5 + 0.5;
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(reflectionScene, camera);
      renderer.setRenderTarget(null);
    },
    dispose() {
      scene.remove(water, particles, patches);
      patchGeometry.dispose(); patchBase.dispose(); patchMaterial.dispose();
      waterGeometry.dispose(); waterMaterial.dispose(); particlesGeometry.dispose();
      particlesMaterial.dispose(); target.dispose();
    },
  };
}

// Repeated samples from bright yacht surfaces form narrow vertical light paths.
// All samples retain the five morph targets, so the reflection follows the yacht.
export function makeReflectionSamples(shapes: Float32Array[], mobile: boolean) {
  const columns = mobile ? 330 : 580, steps = 36, count = columns * steps;
  const seeds = new Float32Array(count * 3);
  let state = 1832;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  for (let column = 0; column < columns; column++) {
    const x = random(), y = random();
    for (let step = 0; step < steps; step++) {
      seeds.set([x, y, (step + random() * 0.7) / steps], (column * steps + step) * 3);
    }
  }
  const targets = shapes.map(shape => {
    const bright: number[] = [];
    for (let i = 0; i < shape.length; i += 4) if (shape[i + 3] > 0.95) bright.push(i);
    const target = new Float32Array(count * 4);
    for (let column = 0; column < columns; column++) {
      const source = bright[Math.floor(random() * bright.length)];
      const strength = 0.45 + random() * 0.45;
      for (let step = 0; step < steps; step++) {
        const offset = (column * steps + step) * 4;
        target[offset] = shape[source]; target[offset + 1] = shape[source + 1]; target[offset + 2] = shape[source + 2];
        target[offset + 3] = shape[source + 3] * strength * (random() > 0.16 ? 1 : 0.16);
      }
    }
    return target;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('aFrom', new THREE.BufferAttribute(targets[0], 4));
  geometry.setAttribute('aTo', new THREE.BufferAttribute(targets[1], 4));
  return { geometry, targets };
}
