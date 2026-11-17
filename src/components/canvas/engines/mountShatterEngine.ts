import {
  createCanvasResizeObserver,
  createRectCache,
  expDamp,
  getBoundedPixelRatio,
} from '../../../lib/canvasOptics';

export interface ShatterParams {
  shards: number;
  tilt: number;
  lift: number;
}

const SHATTER_VERT = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const SHATTER_FRAG = /* glsl */ `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uActive;
uniform float uTile;
uniform float uShards;
uniform float uTilt;
uniform float uLift;
uniform float uPersp;
uniform float uTime;

const float TAU = 6.28318530718;
const vec2 LIGHT = vec2(-0.514, 0.857);

vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float shardD(vec2 q, vec2 cell, float k) {
  float jit = uTile * 0.78 * clamp(uShards, 0.0, 1.0);
  vec2 s0 = (hash22(cell) - 0.5) * jit;
  float d = uTile;
  for (int i = 0; i < 9; i++) {
    if (i == 4) continue;
    vec2 g = vec2(float(i % 3 - 1), float(i / 3 - 1));
    vec2 sn = g * uTile + (hash22(cell + g) - 0.5) * jit;
    vec2 diff = sn - s0;
    float e = -dot(q - s0 - diff * 0.5, normalize(diff));
    d = smin(d, e, k);
  }
  return d;
}

vec3 sampleOpticalBackdrop(vec2 uv) {
  float gx = smoothstep(0.952, 0.99, abs(sin(uv.x * 24.0)));
  float gy = smoothstep(0.952, 0.99, abs(sin(uv.y * 14.0)));
  float grid = max(gx, gy) * 0.35;

  float ring1 = smoothstep(0.018, 0.0, abs(length((uv - 0.5) * vec2(1.6, 1.0)) - 0.34));
  float ring2 = smoothstep(0.012, 0.0, abs(length((uv - 0.5) * vec2(1.6, 1.0)) - 0.22));

  vec3 base = mix(vec3(0.025, 0.038, 0.085), vec3(0.11, 0.34, 0.76), uv.y * 0.65);
  base = mix(base, vec3(0.45, 0.24, 0.78), uv.x * 0.45);
  base += vec3(0.5, 0.85, 1.0) * (grid + ring1 * 0.75 + ring2 * 0.45);
  return base;
}

float cellAct(vec2 cell, out vec2 sxy) {
  sxy = hash22(cell + 13.13);
  vec2 center = (cell + 0.5) * uTile;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 cuv = center / uResolution;
  vec2 dv = vec2((cuv.x - uPointer.x) * aspect, cuv.y - uPointer.y);
  float radius = 0.38 * uActive + 0.22;
  float inner = radius * 0.32;
  float lens = (1.0 - smoothstep(inner, radius, length(dv))) * (0.35 + 0.65 * uActive);
  float th = sxy.x * 0.45;
  return smoothstep(th, th + 0.35, lens);
}

void cellDyn(
  vec2 cell,
  vec2 sxy,
  float act,
  out mat3 R,
  out float lift,
  out vec2 anchor,
  out float k
) {
  vec2 center = (cell + 0.5) * uTile;
  vec4 seed = vec4(sxy, hash22(cell + 27.7));
  float wob = sin(uTime + seed.z * TAU);
  float maxT = 0.22 * uTilt * act;

  float rx = (seed.y - 0.5) * 2.0 * maxT * (0.75 + 0.25 * wob);
  float ry = (seed.z - 0.5) * 2.0 * maxT * (0.75 + 0.25 * cos(uTime * 0.7 + seed.w * TAU));
  float rz = (seed.w - 0.5) * 1.1 * maxT * (0.85 + 0.15 * wob);

  float cx = cos(rx); float sx = sin(rx);
  float cy = cos(ry); float sy = sin(ry);
  float cz = cos(rz); float sz = sin(rz);

  R = mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0)
    * mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy)
    * mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);

  lift = uLift * act * (0.72 + 0.35 * seed.y);
  vec2 shift = (seed.zw - 0.5) * 16.0 * act;
  anchor = center + shift;
  k = max(min(12.0 * act, uTile * 0.42), 0.01);
}

bool invMap(vec2 P, mat3 R, float lift, vec2 anchor, out vec2 q) {
  vec2 w = P - anchor;
  float m11 = uPersp * R[0][0] + w.x * R[0][2];
  float m12 = uPersp * R[1][0] + w.x * R[1][2];
  float m21 = uPersp * R[0][1] + w.y * R[0][2];
  float m22 = uPersp * R[1][1] + w.y * R[1][2];
  float det = m11 * m22 - m12 * m21;
  if (abs(det) < 1e-4) return false;
  vec2 b = w * (uPersp - lift);
  q = vec2(m22 * b.x - m12 * b.y, m11 * b.y - m21 * b.x) / det;
  return true;
}

void main() {
  vec2 P = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 baseCell = floor(P / uTile);

  vec3 col = vec3(0.015, 0.02, 0.045);
  float bestZ = -1e9;
  float shadow = 1.0;
  bool hit = false;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = baseCell + vec2(float(i), float(j));
      vec2 sxy;
      float act = cellAct(c, sxy);
      mat3 R;
      float lift;
      vec2 anchor;
      float k;
      cellDyn(c, sxy, act, R, lift, anchor, k);

      vec2 q;
      if (!invMap(P, R, lift, anchor, q)) continue;
      float d = shardD(q, c, k);

      if (d > 0.0 && act > 0.01) {
        // Soft drop shadow cast into gap beneath lifted shard
        vec2 pShadow = P - vec2(lift * 0.28, lift * 0.36);
        vec2 qs;
        if (invMap(pShadow, R, lift * 0.25, anchor, qs)) {
          float ds = shardD(qs, c, k);
          shadow = min(shadow, smoothstep(-10.0, 14.0, -ds) * 0.65 + 0.35);
        }
      }

      if (d > 0.0) {
        vec3 pw = R * vec3(q, 0.0);
        float z = lift + pw.z;
        if (z > bestZ) {
          bestZ = z;
          hit = true;

          vec2 srcPx = (c + 0.5) * uTile + q;
          vec2 srcUv = srcPx / uResolution;
          srcUv.y = 1.0 - srcUv.y;

          // Tilted facet refraction + RGB dispersion
          vec3 n = normalize(R * vec3(0.0, 0.0, 1.0));
          vec2 refr = n.xy * 0.055 * (0.4 + act);
          vec2 disp = n.xy * 0.014;

          float r = sampleOpticalBackdrop(srcUv + refr + disp).r;
          float g = sampleOpticalBackdrop(srcUv + refr).g;
          float b = sampleOpticalBackdrop(srcUv + refr - disp).b;
          vec3 shardCol = vec3(r, g, b);

          float rim = smoothstep(8.0, 0.0, d) * act;
          float facetLight = dot(n.xy, LIGHT) * 0.35 * act;
          shardCol += facetLight + vec3(0.65, 0.88, 1.0) * rim * 0.55;

          col = shardCol;
        }
      }
    }
  }

  if (!hit) {
    col *= shadow;
  }

  outColor = vec4(col, 1.0);
}`;

/**
 * Mounts an interactive Voronoi 3D Shatter Glass Lens engine (Shatter inspiration).
 */
export function mountShatterEngine(
  container: HTMLElement,
  paramsRef: React.MutableRefObject<ShatterParams>
): () => void {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl || gl.isContextLost()) {
    return () => {
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };

  const vs = compile(gl.VERTEX_SHADER, SHATTER_VERT);
  const fs = compile(gl.FRAGMENT_SHADER, SHATTER_FRAG);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);

  const uniforms: Record<string, WebGLUniformLocation> = {};
  const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(prog, i);
    if (info) {
      const loc = gl.getUniformLocation(prog, info.name);
      if (loc) uniforms[info.name] = loc;
    }
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const syncSize = () => {
    const dpr = getBoundedPixelRatio(container, gl);
    const w = Math.max(1, Math.round(container.clientWidth * dpr));
    const h = Math.max(1, Math.round(container.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };
  syncSize();

  const ro = createCanvasResizeObserver(syncSize);
  ro.observe(container);

  const rectCache = createRectCache(canvas);
  let targetX = 0.5;
  let targetY = 0.5;
  let ptrX = 0.5;
  let ptrY = 0.5;
  let activeTarget = 0.25;
  let active = 0.25;

  const onMove = (e: PointerEvent) => {
    const r = rectCache.current;
    targetX = (e.clientX - r.left) / Math.max(r.width, 1);
    targetY = (e.clientY - r.top) / Math.max(r.height, 1);
    activeTarget = 1.0;
  };
  const onLeave = () => {
    activeTarget = 0.25;
    targetX = 0.5;
    targetY = 0.5;
  };

  canvas.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerleave', onLeave, { passive: true });

  let elapsed = 0;
  let lastNow = performance.now();
  let raf = 0;

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;
    elapsed += dt;

    ptrX = expDamp(ptrX, targetX, 8.0, dt);
    ptrY = expDamp(ptrY, targetY, 8.0, dt);
    active = expDamp(active, activeTarget, 5.5, dt);

    const dpr = canvas.width / Math.max(container.clientWidth, 1);
    const p = paramsRef.current;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.uPointer, ptrX, ptrY);
    gl.uniform1f(uniforms.uActive, active);
    gl.uniform1f(uniforms.uTile, 96 * dpr);
    gl.uniform1f(uniforms.uShards, p.shards);
    gl.uniform1f(uniforms.uTilt, p.tilt);
    gl.uniform1f(uniforms.uLift, p.lift * dpr);
    gl.uniform1f(uniforms.uPersp, 1300 * dpr);
    gl.uniform1f(uniforms.uTime, elapsed * 1.4);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    rectCache.destroy();
    ro.disconnect();
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerleave', onLeave);
    if (quad) gl.deleteBuffer(quad);
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (canvas.parentNode === container) container.removeChild(canvas);
  };
}
