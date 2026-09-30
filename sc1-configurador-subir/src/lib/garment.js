// Prendas: modelo procedural (respaldo) o modelo .glb profesional.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildJersey, CUTS } from './geometry.js';
import { DEFAULT_ATLAS } from './compose.js';
import { toThree } from './texture.js';
import { analyzeGarment } from './collar.js';

const TARGET_H = 0.665; // alto normalizado de la prenda (m)

export function proceduralGarment(cut) {
  const j = buildJersey(cut);
  const fabric = [j.torso, ...j.sleeves].map((m) => toThree(m));
  const parts = [...fabric.map((g) => ({ geometry: g, role: 'fabric' })), { geometry: toThree(j.hem), role: 'hem' }];
  const halfW = CUTS[cut].body.at(-1)[1];
  // normales continuas en las costuras UV del modelo (los vértices duplicados comparten normal)
  for (const it of fabric) {
    const P = it.geometry.attributes.position;
    const N = it.geometry.attributes.normal;
    if (!N) continue;
    const acc = new Map();
    const k = (i) => `${Math.round(P.getX(i) * 2e3)},${Math.round(P.getY(i) * 2e3)},${Math.round(P.getZ(i) * 2e3)}`;
    for (let i = 0; i < P.count; i++) {
      const key = k(i);
      const a = acc.get(key) || [0, 0, 0];
      a[0] += N.getX(i); a[1] += N.getY(i); a[2] += N.getZ(i);
      acc.set(key, a);
    }
    for (let i = 0; i < P.count; i++) {
      const a = acc.get(k(i));
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      // solo si las normales son parecidas (no juntar el frente con el reverso de la tela)
      if ((N.getX(i) * a[0] + N.getY(i) * a[1] + N.getZ(i) * a[2]) / l > 0.5) N.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
    }
    N.needsUpdate = true;
  }

  // la manga es pegada (costura en el hombro): se borra la costura raglán horneada del modelo
  try {
    const segs = raglanSegments(fabric.map((i) => i.geometry), halfW, TARGET_H);
    if (segs.length) {
      eraseSegments(detail.normalMap, segs, '#8080ff');
      if (detail.aoMap) eraseSegments(detail.aoMap, segs, null);
      if (detail.roughnessMap && detail.roughnessMap !== detail.aoMap) eraseSegments(detail.roughnessMap, segs, null);
      if (detail.shadeMap) {
        eraseSegments(detail.shadeMap, segs, null);
        detail.shadeAvg = imageLuma(detail.shadeMap.image);
      }
    }
    detail.raglanSegs = segs.length;
  } catch (e) {
    console.warn('raglán', e);
  }

  let analysis = null;
  try {
    analysis = analyzeGarment(fabric, CUTS[cut].neckY, halfW);
  } catch (e) {
    console.warn('cuello', e);
  }
  return { source: 'procedural', parts, atlas: DEFAULT_ATLAS, height: CUTS[cut].neckY, halfW, flipY: true, analysis };
}

const ROLE_RX = [
  ['collar', /(collar|cuello|neck|rib_?neck)/i],
  ['cuff', /(cuff|puno|puño|sleeve_?rib|hem_?sleeve)/i],
];

function roleOf(name) {
  for (const [role, rx] of ROLE_RX) if (rx.test(name)) return role;
  return 'fabric';
}

// Promedio de luminancia de una imagen (para usar sus sombras horneadas como detalle)
function imageLuma(img) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 64, 64);
    const d = ctx.getImageData(0, 0, 64, 64).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    return Math.max(0.05, s / (d.length / 4));
  } catch (e) {
    return 0.5;
  }
}

// Detecta en el mapa UV dónde está cada pieza y con qué orientación.
// 1) separa las islas UV (piezas del patrón) 2) decide si cada isla es frente, espalda o manga
// 3) calcula el rectángulo de cada pieza y hacia dónde apunta
function autoAtlas(fabricGeos, halfW, H, zc, flipY, size = 2048) {
  const cls = { front: [], back: [], sleeveR: [], sleeveL: [] };
  for (const g of fabricGeos) {
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    if (!uv) continue;
    const idx = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i);
    // islas: componentes conectados por índice de vértice
    const parent = new Int32Array(pos.count).map((_, i) => i);
    const find = (x) => {
      while (parent[x] !== x) x = parent[x] = parent[parent[x]];
      return x;
    };
    for (let i = 0; i < idx.length; i += 3) {
      const a = find(idx[i]);
      const b = find(idx[i + 1]);
      const c = find(idx[i + 2]);
      parent[b] = a;
      parent[find(c)] = a;
    }
    const votes = new Map();
    for (let i = 0; i < idx.length; i += 3) {
      const r = find(idx[i]);
      const cx = (pos.getX(idx[i]) + pos.getX(idx[i + 1]) + pos.getX(idx[i + 2])) / 3;
      const cy = (pos.getY(idx[i]) + pos.getY(idx[i + 1]) + pos.getY(idx[i + 2])) / 3;
      const cz = (pos.getZ(idx[i]) + pos.getZ(idx[i + 1]) + pos.getZ(idx[i + 2])) / 3;
      let key;
      if (Math.abs(cx) > halfW * 1.08 && cy > H * 0.4) key = cx > 0 ? 'sleeveR' : 'sleeveL';
      else key = cz >= zc ? 'front' : 'back';
      if (!votes.has(r)) votes.set(r, { front: 0, back: 0, sleeveR: 0, sleeveL: 0, tris: [], y0: Infinity, y1: -Infinity });
      const v = votes.get(r);
      v.y0 = Math.min(v.y0, cy);
      v.y1 = Math.max(v.y1, cy);
      v[key]++;
      v.tris.push(i);
    }
    for (const v of votes.values()) {
      if (v.tris.length < 20) continue; // islas diminutas (etiquetas, costuras)
      if (v.y1 - v.y0 < H * 0.1) continue; // tiras delgadas (cuello, bastillas): se quedan con el color base
      // las mangas ganan si al menos un 35% de la isla está fuera del torso
      const sl = v.sleeveR + v.sleeveL;
      let key;
      if (sl > v.tris.length * 0.35) key = v.sleeveR >= v.sleeveL ? 'sleeveR' : 'sleeveL';
      else key = v.front >= v.back ? 'front' : 'back';
      for (const i of v.tris) for (const k of [idx[i], idx[i + 1], idx[i + 2]]) cls[key].push(uv.getX(k), uv.getY(k), pos.getX(k), pos.getY(k), pos.getZ(k));
    }
  }
  const atlas = { size };
  for (const [key, arr] of Object.entries(cls)) {
    const cnt = arr.length / 5;
    if (cnt < 30) continue;
    // ejes de la pieza en 3D: X a la derecha según se ve la pieza, Y hacia abajo
    const axX = (x, y, z) => (key === 'front' ? x : key === 'back' ? -x : key === 'sleeveR' ? z : -z);
    const axY = (x, y) => (key.startsWith('sleeve') ? Math.abs(x) - y * 0.5 : -y);
    let mu = 0, mv = 0, mX = 0, mY = 0;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (let i = 0; i < arr.length; i += 5) {
      const u = arr[i];
      const v = flipY ? 1 - arr[i + 1] : arr[i + 1]; // v en coordenadas del lienzo (hacia abajo)
      mu += u; mv += v;
      mX += axX(arr[i + 2], arr[i + 3], arr[i + 4]);
      mY += axY(arr[i + 2], arr[i + 3], arr[i + 4]);
      minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    mu /= cnt; mv /= cnt; mX /= cnt; mY /= cnt;
    let cuX = 0, cuY = 0, cvX = 0, cvY = 0;
    for (let i = 0; i < arr.length; i += 5) {
      const u = arr[i] - mu;
      const v = (flipY ? 1 - arr[i + 1] : arr[i + 1]) - mv;
      const X = axX(arr[i + 2], arr[i + 3], arr[i + 4]) - mX;
      const Y = axY(arr[i + 2], arr[i + 3], arr[i + 4]) - mY;
      cuX += u * X; cuY += u * Y; cvX += v * X; cvY += v * Y;
    }
    const clamp = (t) => Math.max(0, Math.min(1, t));
    const rect = { x: clamp(minU) * size, y: clamp(minV) * size, w: (clamp(maxU) - clamp(minU)) * size, h: (clamp(maxV) - clamp(minV)) * size };
    if (Math.abs(cuX) + Math.abs(cvY) >= Math.abs(cuY) + Math.abs(cvX)) {
      Object.assign(rect, { rot: 0, flipX: cuX < 0, flipY: cvY < 0 });
    } else {
      // pieza girada 90° en el mapa UV
      Object.assign(rect, { rot: 90, flipX: cvX < 0, flipY: cuY > 0 });
    }
    atlas[key] = rect;
  }
  return atlas;
}

// Costura raglán: aristas donde se tocan una isla de manga y una de torso.
// Devuelve los segmentos en UV (ambos lados de la costura) para borrarlos de los mapas horneados.
function raglanSegments(fabricGeos, halfW, H) {
  const segs = [];
  const key = (P, i) => `${Math.round(P.getX(i) * 2e3)},${Math.round(P.getY(i) * 2e3)},${Math.round(P.getZ(i) * 2e3)}`;
  const edges = new Map();
  for (const g of fabricGeos) {
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    if (!uv) continue;
    const idx = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i);
    const parent = new Int32Array(pos.count).map((_, i) => i);
    const find = (x) => {
      while (parent[x] !== x) x = parent[x] = parent[parent[x]];
      return x;
    };
    for (let i = 0; i < idx.length; i += 3) {
      const a = find(idx[i]);
      parent[find(idx[i + 1])] = a;
      parent[find(idx[i + 2])] = a;
    }
    const vote = new Map();
    for (let i = 0; i < idx.length; i += 3) {
      const r = find(idx[i]);
      const cx = (pos.getX(idx[i]) + pos.getX(idx[i + 1]) + pos.getX(idx[i + 2])) / 3;
      const cy = (pos.getY(idx[i]) + pos.getY(idx[i + 1]) + pos.getY(idx[i + 2])) / 3;
      const v = vote.get(r) || { s: 0, n: 0 };
      v.n++;
      if (Math.abs(cx) > halfW * 1.08 && cy > H * 0.4) v.s++;
      vote.set(r, v);
    }
    const isSleeve = (r) => {
      const v = vote.get(r);
      return v.n > 20 && v.s > v.n * 0.35;
    };
    for (let i = 0; i < idx.length; i += 3)
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const ia = idx[i + a];
        const ib = idx[i + b];
        const ka = key(pos, ia);
        const kb = key(pos, ib);
        const k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        const r = find(ia);
        const e = edges.get(k) || [];
        e.push({ sl: isSleeve(r), r, g, u0: uv.getX(ia), v0: uv.getY(ia), u1: uv.getX(ib), v1: uv.getY(ib), y: (pos.getY(ia) + pos.getY(ib)) / 2 });
        edges.set(k, e);
      }
  }
  for (const e of edges.values()) {
    if (e.length !== 2) continue;
    if (e[0].sl === e[1].sl || (e[0].r === e[1].r && e[0].g === e[1].g)) continue;
    if (e[0].y < H * 0.45) continue; // solo la parte alta (bajo el brazo la costura se queda)
    segs.push(e[0], e[1]);
  }
  return segs;
}

// Borra (difumina) la costura raglán de un mapa horneado
const cleanedImgs = new Map();
function eraseSegments(tex, segs, neutral) {
  if (!tex || !tex.image || !segs.length) return;
  const img = tex.image;
  if (cleanedImgs.has(img)) {
    tex.image = cleanedImgs.get(img);
    tex.needsUpdate = true;
    return;
  }
  const W = img.width;
  const Hh = img.height;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = Hh;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const blur = document.createElement('canvas');
  blur.width = W;
  blur.height = Hh;
  const bx = blur.getContext('2d');
  if (neutral) {
    bx.fillStyle = neutral;
    bx.fillRect(0, 0, W, Hh);
  }
  bx.filter = 'blur(10px)';
  bx.globalAlpha = neutral ? 0.35 : 1;
  bx.drawImage(img, 0, 0);
  ctx.save();
  ctx.beginPath();
  for (const s of segs) {
    ctx.moveTo(s.u0 * W, s.v0 * Hh);
    ctx.lineTo(s.u1 * W, s.v1 * Hh);
  }
  ctx.lineWidth = Math.max(24, W * 0.022);
  ctx.lineCap = 'round';
  ctx.strokeStyle = ctx.createPattern(blur, 'no-repeat');
  ctx.stroke();
  ctx.restore();
  cleanedImgs.set(img, c);
  tex.image = c;
  tex.needsUpdate = true;
}

// Reescribe el .glb para que sus imágenes internas vayan como data: URI
// (algunos entornos bloquean las URL blob: que usa GLTFLoader)
function inlineGlbImages(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) return buf; // no es GLB
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const binStart = 20 + jsonLen + 8;
  if (!json.images || !json.images.some((i) => i.bufferView !== undefined)) return buf;
  for (const im of json.images) {
    if (im.bufferView === undefined) continue;
    const bv = json.bufferViews[im.bufferView];
    const bytes = new Uint8Array(buf, binStart + (bv.byteOffset || 0), bv.byteLength);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    im.uri = `data:${im.mimeType || 'image/png'};base64,${btoa(bin)}`;
    delete im.bufferView;
    delete im.mimeType;
  }
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (jsonBytes.length % 4)) % 4;
  const padded = new Uint8Array(jsonBytes.length + pad).fill(0x20);
  padded.set(jsonBytes);
  const rest = new Uint8Array(buf, 20 + jsonLen);
  const out = new Uint8Array(20 + padded.length + rest.length);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, 0x46546c67, true);
  odv.setUint32(4, 2, true);
  odv.setUint32(8, out.length, true);
  odv.setUint32(12, padded.length, true);
  odv.setUint32(16, 0x4e4f534a, true);
  out.set(padded, 20);
  out.set(rest, 20 + padded.length);
  return out.buffer;
}

export async function loadGlbGarment(url) {
  let buf;
  if (url.endsWith('.b64.txt')) {
    const txt = await (await fetch(url)).text();
    buf = Uint8Array.from(atob(txt.trim()), (c) => c.charCodeAt(0)).buffer;
  } else {
    buf = await (await fetch(url)).arrayBuffer();
  }
  const gltf = await new GLTFLoader().parseAsync(inlineGlbImages(buf), '');
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const items = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const m = mats[0] || {};
    items.push({ geometry: g, role: roleOf(`${o.name} ${m.name || ''}`), src: m });
  });
  if (!items.length) throw new Error('El archivo no tiene mallas');

  // normalizar: centrado, pies en y=0, alto fijo
  const box = new THREE.Box3();
  items.forEach((it) => box.union(new THREE.Box3().setFromBufferAttribute(it.geometry.attributes.position)));
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = TARGET_H / size.y;
  const mtx = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));
  items.forEach((it) => it.geometry.applyMatrix4(mtx));

  // orientación automática: el ancho (con mangas) debe ir en X y el frente mirar a +Z
  const allPos = () => items.flatMap((it) => [it.geometry.attributes.position]);
  const rotY = (a) => {
    const m = new THREE.Matrix4().makeRotationY(a);
    items.forEach((it) => it.geometry.applyMatrix4(m));
  };
  if (size.z > size.x) rotY(Math.PI / 2);
  // el escote es más bajo al frente: comparar la altura del borde superior cerca del centro
  let topFront = -Infinity, topBack = -Infinity, maxAbsX = 0;
  for (const p of allPos()) for (let i = 0; i < p.count; i++) maxAbsX = Math.max(maxAbsX, Math.abs(p.getX(i)));
  for (const p of allPos()) {
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getX(i)) > maxAbsX * 0.06) continue;
      const y = p.getY(i);
      if (p.getZ(i) >= 0) topFront = Math.max(topFront, y);
      else topBack = Math.max(topBack, y);
    }
  }
  if (isFinite(topFront) && isFinite(topBack) && topFront > topBack + 0.004) rotY(Math.PI);
  items.forEach((it) => {
    it.geometry.computeBoundingSphere();
    it.geometry.computeBoundingBox();
  });
  // medidas del torso a la altura del abdomen (ahí no hay mangas)
  let fw = 0, fd = 0, maxX = 0;
  items.forEach((it) => {
    const p = it.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = Math.abs(p.getX(i));
      const y = p.getY(i);
      maxX = Math.max(maxX, x);
      if (y > TARGET_H * 0.25 && y < TARGET_H * 0.45) {
        fw = Math.max(fw, x);
        fd = Math.max(fd, Math.abs(p.getZ(i)));
      }
    }
  });
  const halfW = fw || maxX * 0.54;

  // Sisa de manga pegada (costura en el hombro, no raglán):
  //  - axila: primera altura (desde abajo) donde la silueta se abre por la manga
  //  - hombro: punto donde termina la caída del hombro (x = 1.15 · medio ancho)
  const slab = (y0) => {
    let m = 0;
    items.forEach((it) => {
      if (it.role !== 'fabric') return;
      const p = it.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - y0) < TARGET_H * 0.012) m = Math.max(m, Math.abs(p.getX(i)));
    });
    return m;
  };
  const xs = halfW * 1.15;
  let armY = TARGET_H * 0.53;
  for (let y = TARGET_H * 0.35; y < TARGET_H * 0.8; y += TARGET_H * 0.01) if (slab(y) > halfW * 1.25) { armY = y - TARGET_H * 0.01; break; }
  let ys = TARGET_H * 0.9;
  for (let y = TARGET_H * 0.99; y > armY; y -= TARGET_H * 0.005) if (slab(y) >= xs) { ys = y; break; }
  // eje de la manga (lado +x): recta que pasa por el centro de cada rebanada de la manga
  const sv = [];
  items.forEach((it) => {
    if (it.role !== 'fabric') return;
    const p = it.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      if (x > xs + TARGET_H * 0.01 && y > armY) sv.push(new THREE.Vector3(x, y, p.getZ(i)));
    }
  });
  let sleeveA, cuffC, sleeveRef;
  if (sv.length > 50) {
    const mean = sv.reduce((m, v) => m.add(v), new THREE.Vector3()).multiplyScalar(1 / sv.length);
    // dirección principal (iteración de potencia sobre la covarianza)
    const cov = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const v of sv) {
      const d = [v.x - mean.x, v.y - mean.y, v.z - mean.z];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cov[r * 3 + c] += d[r] * d[c];
    }
    let dir = new THREE.Vector3(1, -0.5, 0).normalize();
    for (let k = 0; k < 30; k++) {
      dir = new THREE.Vector3(cov[0] * dir.x + cov[1] * dir.y + cov[2] * dir.z, cov[3] * dir.x + cov[4] * dir.y + cov[5] * dir.z, cov[6] * dir.x + cov[7] * dir.y + cov[8] * dir.z).normalize();
    }
    if (dir.x < 0) dir.negate();
    // centros por rebanada a lo largo del eje y recta por mínimos cuadrados
    const ts = sv.map((v) => v.clone().sub(mean).dot(dir));
    const t0 = Math.min(...ts);
    const t1 = Math.max(...ts);
    const NB = 8;
    const bins = Array.from({ length: NB }, () => ({ c: new THREE.Vector3(), n: 0, t: 0 }));
    sv.forEach((v, i) => {
      const k = Math.min(NB - 1, Math.floor(((ts[i] - t0) / (t1 - t0 || 1)) * NB));
      bins[k].c.add(v);
      bins[k].t += ts[i];
      bins[k].n++;
    });
    const pts = bins.filter((q) => q.n > 5).map((q) => ({ c: q.c.multiplyScalar(1 / q.n), t: q.t / q.n }));
    // ajuste lineal c(t) = c0 + c1·t  (se ignora la primera rebanada: es la copa del hombro)
    const use = pts.length > 3 ? pts.slice(1) : pts;
    const mt = use.reduce((a2, q) => a2 + q.t, 0) / use.length;
    const mc = use.reduce((a2, q) => a2.add(q.c), new THREE.Vector3()).multiplyScalar(1 / use.length);
    const slope = new THREE.Vector3();
    let den = 0;
    for (const q of use) {
      slope.add(q.c.clone().sub(mc).multiplyScalar(q.t - mt));
      den += (q.t - mt) ** 2;
    }
    slope.multiplyScalar(1 / (den || 1));
    const at = (t) => mc.clone().add(slope.clone().multiplyScalar(t - mt));
    sleeveA = at(t0);
    cuffC = at(t1);
  } else {
    sleeveA = new THREE.Vector3((halfW + xs) / 2, (ys + armY) / 2, 0);
    cuffC = new THREE.Vector3(maxX, (ys + armY) / 2 - 0.03, 0);
  }
  {
    // cara de la manga que mira hacia afuera (lo que se ve de lado): ahí va el centro del logo
    const d = cuffC.clone().sub(sleeveA).normalize();
    const px = new THREE.Vector3(1, 0, 0).addScaledVector(d, -d.x);
    const py = new THREE.Vector3(0, 1, 0).addScaledVector(d, -d.y);
    sleeveRef = px.add(py.multiplyScalar(0.3)).normalize();
  }

  const fabric = items.filter((i) => i.role === 'fabric');
  let atlas = autoAtlas(
    fabric.map((i) => i.geometry),
    halfW,
    TARGET_H,
    0,
    false
  );

  // ¿el mapa UV separa las piezas? si no, proyectamos el diseño (sirve con cualquier modelo)
  const iou = (a, b) => {
    if (!a || !b) return 1;
    const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const inter = x * y;
    return inter / Math.min(a.w * a.h, b.w * b.h || 1);
  };
  const hasUv = fabric.every((i) => i.geometry.attributes.uv);
  // Se proyecta siempre: así el corte de la manga lo decide la sisa (manga pegada) y no el
  // mapa UV del modelo (que trae mangas raglán hasta el cuello).
  const mapping = 'projection';
  void hasUv; void iou;
  const detected = atlas;
  if (mapping === 'projection') atlas = DEFAULT_ATLAS;

  // conservar los mapas de detalle del modelo (relieve, oclusión, rugosidad) y sus sombras horneadas
  const detail = {};
  const src = fabric[0] ? fabric[0].src : {};
  if (src.normalMap) detail.normalMap = src.normalMap;
  if (src.normalScale) detail.normalScale = src.normalScale.clone();
  if (src.aoMap) detail.aoMap = src.aoMap;
  if (src.roughnessMap) detail.roughnessMap = src.roughnessMap;
  if (src.map && src.map.image) {
    detail.shadeMap = src.map;
    detail.shadeAvg = imageLuma(src.map.image);
  }

  // normales continuas en las costuras UV del modelo (los vértices duplicados comparten normal)
  for (const it of fabric) {
    const P = it.geometry.attributes.position;
    const N = it.geometry.attributes.normal;
    if (!N) continue;
    const acc = new Map();
    const k = (i) => `${Math.round(P.getX(i) * 2e3)},${Math.round(P.getY(i) * 2e3)},${Math.round(P.getZ(i) * 2e3)}`;
    for (let i = 0; i < P.count; i++) {
      const key = k(i);
      const a = acc.get(key) || [0, 0, 0];
      a[0] += N.getX(i); a[1] += N.getY(i); a[2] += N.getZ(i);
      acc.set(key, a);
    }
    for (let i = 0; i < P.count; i++) {
      const a = acc.get(k(i));
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      // solo si las normales son parecidas (no juntar el frente con el reverso de la tela)
      if ((N.getX(i) * a[0] + N.getY(i) * a[1] + N.getZ(i) * a[2]) / l > 0.5) N.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
    }
    N.needsUpdate = true;
  }

  // la manga es pegada (costura en el hombro): se borra la costura raglán horneada del modelo
  try {
    const segs = raglanSegments(fabric.map((i) => i.geometry), halfW, TARGET_H);
    if (segs.length) {
      eraseSegments(detail.normalMap, segs, '#8080ff');
      if (detail.aoMap) eraseSegments(detail.aoMap, segs, null);
      if (detail.roughnessMap && detail.roughnessMap !== detail.aoMap) eraseSegments(detail.roughnessMap, segs, null);
      if (detail.shadeMap) {
        eraseSegments(detail.shadeMap, segs, null);
        detail.shadeAvg = imageLuma(detail.shadeMap.image);
      }
    }
    detail.raglanSegs = segs.length;
  } catch (e) {
    console.warn('raglán', e);
  }

  let analysis = null;
  try {
    // escote a medida de jersey (algunos modelos traen escote de playera casual, muy ancho)
    analysis = analyzeGarment(fabric.map((i) => i.geometry), TARGET_H, halfW);
  } catch (e) {
    console.warn('cuello', e);
  }

  return {
    source: 'glb',
    analysis,
    parts: items.map(({ geometry, role }) => ({ geometry, role })),
    atlas,
    height: TARGET_H,
    halfW,
    flipY: mapping === 'projection',
    mapping,
    detected,
    proj: { fw: halfW * 1.04, fd: (fd || halfW * 0.5) * 1.1, sleeveLen: Math.max(0.05, maxX - xs), xs, ys, armY, sleeveA, sleeveC: cuffC, sleeveRef },
    detail,
  };
}
