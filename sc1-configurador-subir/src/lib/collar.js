// Cuellos en 3D: redondo, V y doble cuello (V de dos tonos), más puños.
// Funciona con cualquier modelo: detecta los bordes abiertos de la prenda (escote y mangas)
// y construye las piezas ajustadas a la superficie.
import * as THREE from 'three';

const V3 = THREE.Vector3;

// ---------- CUELLO PINTADO ----------
// El modelo .glb conserva su escote original. El cuello se PINTA sobre la tela, en una franja
// que sigue la orilla del escote (como en un jersey sublimado). En cuello V además se abre la tela
// en un triángulo al frente, y la franja sigue la V.
export const NECK_PTS = 96;
export const CUFF_PTS = 48;
export const collarUniforms = {
  uBandOn: { value: 0 },
  uNeck: { value: Array.from({ length: NECK_PTS }, () => new THREE.Vector3()) },
  uNeckN: { value: 0 },
  uW1: { value: 0.024 }, // franja pegada a la orilla
  uW2: { value: 0 }, // segunda franja (doble cuello)
  uC1: { value: new THREE.Color('#ffffff') },
  uC2: { value: new THREE.Color('#ffffff') },
  uNeckY: { value: 0.5 }, // solo se calcula por encima de esta altura
  uCuffA: { value: Array.from({ length: CUFF_PTS }, () => new THREE.Vector3()) },
  uCuffB: { value: Array.from({ length: CUFF_PTS }, () => new THREE.Vector3()) },
  uCuffN: { value: 0 },
  uCuffW: { value: 0.016 },
  uCuffX: { value: 0.2 },
  uVOn: { value: 0 },
  uVApex: { value: 0 },
  uVSX: { value: 0.05 },
  uVSY: { value: 0.6 },
  uVZ: { value: 0 },
  uVIns: { value: 0 }, // alto de la telita en el vértice (doble cuello)
  uCC: { value: new THREE.Color('#ffffff') }, // color de puños
  uC3: { value: new THREE.Color('#ffffff') }, // color de la telita
};

const PAINT_GLSL = `
uniform float uBandOn; uniform vec3 uNeck[${NECK_PTS}]; uniform int uNeckN; uniform float uW1; uniform float uW2;
uniform vec3 uC1; uniform vec3 uC2; uniform float uNeckY;
uniform vec3 uCuffA[${CUFF_PTS}]; uniform vec3 uCuffB[${CUFF_PTS}]; uniform int uCuffN; uniform float uCuffW; uniform float uCuffX;
uniform float uVOn; uniform float uVApex; uniform float uVSX; uniform float uVSY; uniform float uVZ; uniform float uVIns;
uniform vec3 uCC; uniform vec3 uC3;
varying vec3 vPaintP;
float segD(vec3 p, vec3 a, vec3 b) { vec3 ab = b - a; float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0); return length(p - a - ab * t); }
float loopD(vec3 p, int which) {
  float d = 1e9;
  if (which == 0) { for (int i = 0; i < ${NECK_PTS}; i++) { if (i >= uNeckN) break; int j = i + 1 >= uNeckN ? 0 : i + 1; d = min(d, segD(p, uNeck[i], uNeck[j])); } }
  else if (which == 1) { for (int i = 0; i < ${CUFF_PTS}; i++) { if (i >= uCuffN) break; int j = i + 1 >= uCuffN ? 0 : i + 1; d = min(d, segD(p, uCuffA[i], uCuffA[j])); } }
  else { for (int i = 0; i < ${CUFF_PTS}; i++) { if (i >= uCuffN) break; int j = i + 1 >= uCuffN ? 0 : i + 1; d = min(d, segD(p, uCuffB[i], uCuffB[j])); } }
  return d;
}
bool vInside(vec3 p) {
  if (uVOn < 0.5 || p.z < uVZ) return false;
  float ax = abs(p.x);
  return ax < uVSX && p.y > uVApex + (uVSY - uVApex) * ax / uVSX;
}
// borde superior de la telita (doble cuello): una V muy abierta
float insTop(vec3 p) { return uVApex + uVIns + abs(p.x) * 0.45; }
bool vDiscard(vec3 p) {
  if (!vInside(p)) return false;
  return uVIns <= 0.0 || p.y > insTop(p);
}`;

// Aplica recorte en V (todas las capas) y, si paint=true, pinta cuello y puños
export function injectCollar(material, paint = false) {
  if (material.userData.collar) return material;
  material.userData.collar = true;
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey ? material.customProgramCacheKey.bind(material) : () => '';
  material.onBeforeCompile = (shader, r) => {
    prev && prev(shader, r);
    Object.assign(shader.uniforms, collarUniforms);
    shader.vertexShader = 'varying vec3 vPaintP;\n' + shader.vertexShader.replace('void main() {', 'void main() {\n  vPaintP = position;');
    let fs = PAINT_GLSL + '\n' + shader.fragmentShader.replace('void main() {', 'void main() {\n  if (vDiscard(vPaintP)) discard;');
    if (paint) {
      fs = fs.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  if (uBandOn > 0.5) {
    if (vPaintP.y > uNeckY) {
      float dn = loopD(vPaintP, 0);
      float aa = 0.0012;
      bool ins = vInside(vPaintP);
      float m1 = ins ? 0.0 : 1.0 - smoothstep(uW1 - aa, uW1 + aa, dn);
      float m2 = (uW2 > 0.0 && !ins) ? (1.0 - smoothstep(uW1 + uW2 - aa, uW1 + uW2 + aa, dn)) * (1.0 - m1) : 0.0;
      diffuseColor.rgb = mix(diffuseColor.rgb, uC1, m1);
      diffuseColor.rgb = mix(diffuseColor.rgb, uC2, m2);
      // costura sutil en el borde de la franja
      float seam = uW2 > 0.0 ? uW1 + uW2 : uW1;
      if (!ins) diffuseColor.rgb *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.0016, abs(dn - seam)));
      if (ins) {
        // telita del doble cuello: pieza cosida por detrás del vértice de la V
        diffuseColor.rgb = uC3;
        float eTop = abs(vPaintP.y - insTop(vPaintP));
        float st = 1.0 - smoothstep(0.0, 0.0014, min(dn, eTop));
        diffuseColor.rgb *= 1.0 - 0.35 * st;
        // sombra del borde de la V sobre la telita
        diffuseColor.rgb *= 0.78 + 0.22 * smoothstep(0.0, 0.006, dn);
      }
    }
    if (uCuffN > 0 && abs(vPaintP.x) > uCuffX) {
      float dc = min(loopD(vPaintP, 1), loopD(vPaintP, 2));
      float mc = 1.0 - smoothstep(uCuffW - 0.001, uCuffW + 0.001, dc);
      diffuseColor.rgb = mix(diffuseColor.rgb, uCC, mc);
    }
  }`
      );
    }
    shader.fragmentShader = fs;
  };
  material.customProgramCacheKey = () => prevKey() + (paint ? '-collarP' : '-collarC');
  return material;
}

// ---------- bordes abiertos ----------
function boundaryLoops(geos) {
  const key = (x, y, z) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
  const pts = [];
  const nrm = [];
  const ids = new Map();
  const edges = new Map();
  for (const g of geos) {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const map = new Int32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const k = key(pos.getX(i), pos.getY(i), pos.getZ(i));
      let id = ids.get(k);
      if (id === undefined) {
        id = pts.length;
        ids.set(k, id);
        pts.push(new V3(pos.getX(i), pos.getY(i), pos.getZ(i)));
        nrm.push(new V3());
      }
      if (nor) nrm[id].add(new V3(nor.getX(i), nor.getY(i), nor.getZ(i)));
      map[i] = id;
    }
    const idx = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i);
    for (let t = 0; t < idx.length; t += 3)
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const u = map[idx[t + a]];
        const v = map[idx[t + b]];
        if (u === v) continue;
        const k = u < v ? `${u}_${v}` : `${v}_${u}`;
        edges.set(k, (edges.get(k) || 0) + 1);
      }
  }
  const adj = new Map();
  for (const [k, c] of edges) {
    if (c !== 1) continue;
    const [u, v] = k.split('_').map(Number);
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u).push(v);
    adj.get(v).push(u);
  }
  const seen = new Set();
  const loops = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = [start];
    seen.add(start);
    let prev = -1;
    let cur = start;
    for (let guard = 0; guard < 100000; guard++) {
      const nb = adj.get(cur).find((n) => n !== prev && !seen.has(n));
      if (nb === undefined) break;
      loop.push(nb);
      seen.add(nb);
      prev = cur;
      cur = nb;
    }
    if (loop.length >= 12) loops.push(loop.map((i) => ({ p: pts[i].clone(), n: nrm[i].clone().normalize() })));
  }
  return loops;
}

// Remuestrea un lazo cerrado por longitud y lo suaviza
function resample(loop, N, closed = true, smooth = 3) {
  const P = loop.map((e) => e.p);
  const Nn = loop.map((e) => e.n);
  const cum = [0];
  const M = closed ? P.length + 1 : P.length;
  for (let i = 1; i < M; i++) cum.push(cum[i - 1] + P[i % P.length].distanceTo(P[(i - 1) % P.length]));
  const total = cum[cum.length - 1];
  const out = [];
  let k = 0;
  const count = closed ? N : N + 1;
  for (let j = 0; j < count; j++) {
    const target = (total * j) / N;
    while (k < cum.length - 2 && cum[k + 1] < target) k++;
    const f = (target - cum[k]) / (cum[k + 1] - cum[k] || 1);
    const a = k % P.length;
    const b = (k + 1) % P.length;
    out.push({ p: P[a].clone().lerp(P[b], f), n: Nn[a].clone().lerp(Nn[b], f).normalize() });
  }
  for (let s = 0; s < smooth; s++) {
    const cp = out.map((e) => e.p.clone());
    for (let i = 0; i < out.length; i++) {
      if (!closed && (i === 0 || i === out.length - 1)) continue;
      const a = cp[(i - 1 + out.length) % out.length];
      const b = cp[(i + 1) % out.length];
      out[i].p.copy(cp[i]).multiplyScalar(0.5).addScaledVector(a, 0.25).addScaledVector(b, 0.25);
    }
  }
  return out;
}

// ---------- textura acanalada del ribete (rib knit) ----------
let ribTex = null;
export function ribNormal() {
  if (ribTex) return ribTex;
  const S = 64;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = 4;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, 4);
  for (let x = 0; x < S; x++) {
    const nx = Math.cos((x / S) * Math.PI * 2) * 0.55;
    const l = Math.hypot(nx, 1);
    for (let y = 0; y < 4; y++) {
      const i = (y * S + x) * 4;
      img.data[i] = (nx / l) * 127.5 + 127.5;
      img.data[i + 1] = 127.5;
      img.data[i + 2] = (1 / l) * 127.5 + 127.5;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ribTex = new THREE.CanvasTexture(c);
  ribTex.wrapS = ribTex.wrapT = THREE.RepeatWrapping;
  return ribTex;
}

// ---------- ribete a lo largo de un camino sobre la tela ----------
// cada punto: { p, n (normal de la tela), s (dirección hacia la tela, lejos del borde) }
// Perfil de un cuello acanalado real: la banda se dobla sobre el borde y continúa por dentro de la prenda.
function bandGeometry(path, width, thick, closed, offset = 0) {
  // banda plana (tela sublimada) con un doblez corto hacia adentro en el borde
  const prof = [
    [0.004, -0.0022],
    [0.0006, -0.0021],
    [-0.0009, -0.0011],
    [-0.0011, 0.0004],
    [-0.0005, thick],
    [width * 0.5, thick],
    [width - 0.0006, thick * 0.9],
    [width, thick * 0.3],
    [width + 0.0002, 0],
  ];
  const R = prof.length;
  const L = path.length;
  // factor de inglete en esquinas (vértice de la V)
  const miter = path.map((e, i) => {
    if (!closed && (i === 0 || i === L - 1)) return 1;
    const a = path[(i - 1 + L) % L].p;
    const b = path[(i + 1) % L].p;
    const t1 = e.p.clone().sub(a).normalize();
    const t2 = b.clone().sub(e.p).normalize();
    const t = t1.clone().add(t2).normalize();
    return Math.min(2.6, 1 / Math.max(0.38, t1.dot(t)));
  });
  const pos = [];
  const uv = [];
  let len = 0;
  for (let i = 0; i < L; i++) {
    const e = path[i];
    if (i > 0) len += e.p.distanceTo(path[i - 1].p);
    prof.forEach(([a, b], r) => {
      const v = e.p.clone().addScaledVector(e.s, (a + offset) * miter[i]).addScaledVector(e.n, b + 0.0008 + (e.lift || 0));
      pos.push(v.x, v.y, v.z);
      uv.push(len / 0.0036, r / (R - 1));
    });
  }
  const idx = [];
  const segs = closed ? L : L - 1;
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % L;
    for (let r = 0; r < R - 1; r++) {
      const a = i * R + r;
      const b = i * R + r + 1;
      const c = i2 * R + r;
      const d = i2 * R + r + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // orientar normales hacia afuera (según la normal de la tela, en la cara superior)
  const nrm = g.attributes.normal;
  let score = 0;
  for (let i = 0; i < L; i++) {
    const k = i * R + 5;
    score += nrm.getX(k) * path[i].n.x + nrm.getY(k) * path[i].n.y + nrm.getZ(k) * path[i].n.z;
  }
  if (score < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  g.computeBoundingSphere();
  return g;
}

// ---------- cuello: franja cosida en la orilla que sale hacia la abertura ----------
// u0..u1 = distancia desde la orilla (0) hacia la abertura. Atrás queda parada alrededor del cuello;
// en la V ocupa el borde del corte. Perfil cerrado con grosor (se ve la cara interior).
function stripGeometry(path, u0, u1, thick, closed) {
  const ov = u0 === 0 ? 0.003 : 0; // se monta un poco sobre la tela para ocultar la costura
  const prof = [
    [-ov, thick * 0.5],
    [u0, thick],
    [u1 - 0.0008, thick],
    [u1, 0],
    [u1 - 0.0008, -thick],
    [u0, -thick],
    [-ov, -thick * 0.5],
  ];
  const R = prof.length;
  const L = path.length;
  const miter = path.map((e, i) => {
    if (!closed && (i === 0 || i === L - 1)) return 1;
    const a = path[(i - 1 + L) % L].p;
    const b = path[(i + 1) % L].p;
    const t1 = e.p.clone().sub(a).normalize();
    const t2 = b.clone().sub(e.p).normalize();
    const t = t1.clone().add(t2).normalize();
    return Math.min(2.8, 1 / Math.max(0.36, t1.dot(t)));
  });
  const pos = [];
  const uv = [];
  let len = 0;
  for (let i = 0; i < L; i++) {
    const e = path[i];
    if (i > 0) len += e.p.distanceTo(path[i - 1].p);
    // dirección hacia la abertura, inclinada un poco hacia adentro para que abrace el cuello
    const d = e.s.clone().negate().addScaledVector(e.n, -0.22).normalize();
    const nn = new V3().crossVectors(d, new V3().crossVectors(e.n, d)).normalize();
    prof.forEach(([u, h], r) => {
      const v = e.p.clone().addScaledVector(d, u * miter[i]).addScaledVector(nn, h + (e.lift || 0) * 0.5);
      pos.push(v.x, v.y, v.z);
      uv.push(len / 0.004, r / (R - 1));
    });
  }
  const idx = [];
  const segs = closed ? L : L - 1;
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % L;
    for (let r = 0; r < R; r++) {
      const r2 = (r + 1) % R;
      const a = i * R + r;
      const b = i * R + r2;
      const c = i2 * R + r;
      const d = i2 * R + r2;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  let score = 0;
  for (let i = 0; i < L; i++) {
    const k = i * R + 2;
    score += nrm.getX(k) * path[i].n.x + nrm.getY(k) * path[i].n.y + nrm.getZ(k) * path[i].n.z;
  }
  if (score < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  g.computeBoundingSphere();
  return g;
}

function withDirs(path, closed, prefer) {
  const L = path.length;
  const out = path.map((e, i) => {
    const a = path[closed ? (i - 1 + L) % L : Math.max(0, i - 1)].p;
    const b = path[closed ? (i + 1) % L : Math.min(L - 1, i + 1)].p;
    const t = b.clone().sub(a).normalize();
    let s = new V3().crossVectors(e.n, t).normalize();
    if (s.dot(prefer(e)) < 0) s.negate();
    return { ...e, s, conf: Math.abs(s.dot(prefer(e).normalize())) };
  });
  // continuidad: la banda no debe voltearse entre puntos vecinos
  let start = 0;
  out.forEach((e, i) => { if (e.conf > out[start].conf) start = i; });
  for (let k = 1; k < L; k++) {
    const i = (start + k) % L;
    const prev = out[(start + k - 1) % L];
    if (out[i].s.dot(prev.s) < 0) out[i].s.negate();
  }
  return out;
}

// ---------- superficie frontal para proyectar el cuello V ----------
function frontSurface(geos, H) {
  const pos = [];
  for (const g of geos) {
    const p = g.attributes.position;
    const idx = g.index ? g.index.array : Array.from({ length: p.count }, (_, i) => i);
    for (let t = 0; t < idx.length; t += 3) {
      let cy = 0;
      let cz = 0;
      for (let k = 0; k < 3; k++) {
        cy += p.getY(idx[t + k]);
        cz += p.getZ(idx[t + k]);
      }
      if (cy / 3 < H * 0.5 || cz / 3 < -0.03) continue;
      for (let k = 0; k < 3; k++) pos.push(p.getX(idx[t + k]), p.getY(idx[t + k]), p.getZ(idx[t + k]));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const dir = new V3(0, 0, -1);
  return (x, y) => {
    ray.set(new V3(x, y, 1), dir);
    const hit = ray.intersectObject(mesh, false)[0];
    if (!hit) return null;
    const n = hit.face.normal.clone();
    if (n.z < 0) n.negate();
    return { p: hit.point.clone(), n };
  };
}

// ---------- escote ----------
function loopInfo(l) {
  const c = new V3();
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const e of l) {
    c.add(e.p);
    minX = Math.min(minX, e.p.x);
    maxX = Math.max(maxX, e.p.x);
    minZ = Math.min(minZ, e.p.z);
    maxZ = Math.max(maxZ, e.p.z);
  }
  c.multiplyScalar(1 / l.length);
  return { l, c, minX, maxX, minZ, maxZ };
}
function findNeck(info, H, halfW) {
  const necks = info.filter((i) => i.minX < 0 && i.maxX > 0 && i.minZ < i.c.z && i.maxZ > i.c.z && i.c.y > H * 0.6 && i.maxX - i.minX < halfW * 1.6);
  necks.sort((a, b) => b.c.y - a.c.y);
  return necks[0] || null;
}

// Angosta un escote demasiado ancho (p. ej. playera casual) a medida de jersey: ~15 cm entre hombros.
// Deforma suavemente los vértices cercanos al escote hacia el centro.
export function tightenNeck(geos, H, halfW, targetHalf = 0.074) {
  const nk = findNeck(boundaryLoops(geos).map(loopInfo), H, halfW);
  if (!nk) return 0;
  const loop = resample(nk.l, 120, true, 2);
  const xN = Math.max(...loop.map((e) => Math.abs(e.p.x)));
  const shrink = Math.min(0.045, xN - targetHalf);
  if (shrink < 0.004) return 0;
  const R = 0.1;
  for (const g of geos) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < nk.c.y - R * 1.5) continue;
      let bd = Infinity, bq = null;
      for (const e of loop) {
        const d = (e.p.x - x) ** 2 + (e.p.y - y) ** 2 + (e.p.z - z) ** 2;
        if (d < bd) { bd = d; bq = e.p; }
      }
      const d = Math.sqrt(bd);
      if (d > R) continue;
      const t = 1 - d / R;
      const w = t * t * (3 - 2 * t);
      const k = Math.pow(Math.min(1, Math.abs(bq.x) / xN), 1.3);
      p.setX(i, x - Math.sign(bq.x) * shrink * k * w);
    }
    p.needsUpdate = true;
    g.computeBoundingSphere();
    g.computeBoundingBox();
  }
  return shrink;
}

// ---------- análisis de la prenda (una vez por modelo) ----------
export function analyzeGarment(fabricGeos, H, halfW) {
  const loops = boundaryLoops(fabricGeos);
  const info = loops.map((l) => {
    const c = new V3();
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const e of l) {
      c.add(e.p);
      minX = Math.min(minX, e.p.x);
      maxX = Math.max(maxX, e.p.x);
      minZ = Math.min(minZ, e.p.z);
      maxZ = Math.max(maxZ, e.p.z);
    }
    c.multiplyScalar(1 / l.length);
    return { l, c, minX, maxX, minZ, maxZ };
  });
  // normales hacia afuera (algunos modelos las traen invertidas)
  const orient = (loop, center) => {
    for (const e of loop) {
      const radial = new V3(e.p.x - center.x, 0, e.p.z - center.z);
      if (e.n.lengthSq() < 0.5 || e.n.dot(radial) < 0) {
        if (e.n.lengthSq() < 0.5) e.n.copy(radial.normalize());
        else e.n.negate();
      }
    }
    return loop;
  };
  const nk = findNeck(info, H, halfW);
  let neck = nk ? orient(resample(nk.l, 180, true, 8), nk.c).map((e) => ({ ...e, lift: 0.0026 })) : null;
  // normales suaves a lo largo del escote (el borde de algunos modelos viene enrollado o dentado)
  if (neck) {
    for (let it = 0; it < 20; it++) {
      const cn = neck.map((e) => e.n.clone());
      const L = neck.length;
      neck = neck.map((e, i) => ({ ...e, n: cn[i].clone().multiplyScalar(0.4).addScaledVector(cn[(i - 1 + L) % L], 0.3).addScaledVector(cn[(i + 1) % L], 0.3).normalize() }));
    }
  }
  const cuffs = [];
  for (const side of [1, -1]) {
    const cands = info.filter((i) => Math.sign(i.c.x) === side && Math.abs(i.c.x) > halfW * 1.0 && i.c.y > H * 0.3 && !(i.minX < 0 && i.maxX > 0));
    cands.sort((a, b) => Math.abs(b.c.x) - Math.abs(a.c.x));
    if (cands[0]) {
      const loop = resample(cands[0].l, 90, true, 3);
      // puño: la normal apunta hacia afuera del eje de la manga
      const c0 = cands[0].c;
      for (const e of loop) {
        const r = e.p.clone().sub(c0);
        if (e.n.dot(r) < 0) e.n.negate();
      }
      cuffs.push({ side, loop, c: c0 });
    }
  }
  // malla completa de la tela para trazar el cuello nuevo
  const all = [];
  for (const g of fabricGeos) {
    const p = g.attributes.position;
    const idx = g.index ? g.index.array : Array.from({ length: p.count }, (_, i) => i);
    for (let t = 0; t < idx.length; t++) all.push(p.getX(idx[t]), p.getY(idx[t]), p.getZ(idx[t]));
  }
  const ag = new THREE.BufferGeometry();
  ag.setAttribute('position', new THREE.Float32BufferAttribute(all, 3));
  ag.computeBoundingSphere();
  const fabricMesh = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  let metrics = null;
  if (neck) {
    const zc = neck.reduce((a, e) => a + e.p.z, 0) / neck.length;
    const xN = Math.max(...neck.map((e) => Math.abs(e.p.x)));
    const near = (sel) => neck.filter(sel).reduce((a, e) => Math.max(a, e.p.y), -Infinity);
    metrics = {
      zc,
      xN,
      hps: near((e) => Math.abs(e.p.x) > xN * 0.8),
      front: Math.min(...neck.filter((e) => Math.abs(e.p.x) < xN * 0.15 && e.p.z > zc).map((e) => e.p.y)),
      back: Math.min(...neck.filter((e) => Math.abs(e.p.x) < xN * 0.15 && e.p.z < zc).map((e) => e.p.y)),
    };
  }
  return { neck, cuffs, surface: frontSurface(fabricGeos, H), H, fabricMesh, metrics };
}

// ---------- trazado del cuello pintado ----------
// type: 'redondo' | 'v' | 'doble'  → configuración para collarUniforms
const down = (arr, n) => Array.from({ length: n }, (_, i) => arr[Math.floor((i * arr.length) / n)].p.clone());
export function collarPaint(an, type) {
  if (!an || !an.neck) return null;
  const neck = an.neck;
  const CM = 1 / 108;
  const out = { neck: down(neck, NECK_PTS), v: null, cuffs: an.cuffs.map((c) => down(c.loop, CUFF_PTS)), neckY: an.H * 0.55, cuffX: 0 };
  const xs = an.cuffs.map((c) => Math.abs(c.c.x));
  out.cuffX = xs.length ? Math.min(...xs) * 0.75 : 1;
  if (type === 'redondo' || !an.surface) return out;

  // ---- V: puntos de hombro sobre el escote original y punta ~5 cm bajo el frente del escote ----
  const zc = neck.reduce((a, e) => a + e.p.z, 0) / neck.length;
  const xN = Math.max(...neck.map((e) => Math.abs(e.p.x)));
  const pick = (tx) => {
    let best = 0, bd = Infinity;
    neck.forEach((e, i) => {
      if (e.p.z < zc) return;
      const d = Math.abs(e.p.x - tx);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };
  const iL = pick(-xN * 0.85);
  const iR = pick(xN * 0.85);
  let iF = -1;
  neck.forEach((e, i) => { if (Math.abs(e.p.x) < xN * 0.2 && e.p.z > zc && (iF < 0 || e.p.y < neck[iF].p.y)) iF = i; });
  if (iF < 0) return out;
  const SL = neck[iL].p, SR = neck[iR].p;
  const sy = (SL.y + SR.y) / 2;
  const sx = (Math.abs(SL.x) + Math.abs(SR.x)) / 2;
  const apexY = neck[iF].p.y - 5 * CM;
  const apex = an.surface(0, apexY);
  if (!apex) return out;
  // tramo trasero del escote original: de SR a SL por detrás
  const N = neck.length;
  const back = [];
  const step = (i) => (i + 1) % N;
  // recorrer en la dirección que NO pasa por iF
  const walk = (from, to, dir) => { const r = []; for (let i = from, k = 0; k < N; k++) { r.push(i); if (i === to) break; i = (i + dir + N) % N; } return r; };
  let path = walk(iR, iL, 1);
  if (path.includes(iF)) path = walk(iR, iL, -1);
  for (const i of path) back.push(neck[i].p.clone());
  const arm = (S, rev) => {
    const r = [];
    for (let j = 1; j < 24; j++) {
      const t = j / 24;
      const h = an.surface(S.x * (1 - t), S.y + (apexY - S.y) * t);
      if (h) r.push(h.p);
    }
    return rev ? r.reverse() : r;
  };
  const full = [...back, ...arm(SL, false), apex.p.clone(), ...arm(SR, true)];
  out.neck = Array.from({ length: NECK_PTS }, (_, i) => full[Math.floor((i * full.length) / NECK_PTS)].clone());
  out.v = { apexY, sx, sy, zc };
  return out;
}
