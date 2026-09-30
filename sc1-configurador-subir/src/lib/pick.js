// Del punto tocado en el jersey 3D a la pieza plana (frente, espalda, mangas) y su posición (0..1).
// Es la misma cuenta que hace el shader de la tela en modo proyección (Scene.jsx → projUV).
import * as THREE from 'three';
import { DEFAULT_ATLAS, layoutItems, panelDims } from './compose.js';

const V = THREE.Vector3;

export function pickPanel(p, garment) {
  if (!garment || garment.mapping !== 'projection' || !garment.proj) return null;
  const P = garment.proj;
  const H = garment.height;
  const fw = P.fw;
  const xs = P.xs || fw;
  const ys = P.ys || H * 0.9;
  const armY = P.armY || H * 0.53;
  const ax = Math.abs(p.x);
  const t = Math.min(1, Math.max(0, (p.y - armY) / Math.max(ys - armY, 1e-3)));
  const seamX = fw * 0.97 + (xs - fw * 0.97) * Math.sqrt(t);
  if (p.y > armY && ax > seamX && P.sleeveA && P.sleeveC) {
    const A = new V().copy(P.sleeveA);
    const C = new V().copy(P.sleeveC);
    const pm = new V(ax, p.y, p.z);
    const L = C.distanceTo(A);
    const d = C.clone().sub(A).normalize();
    const tt = pm.clone().sub(A).dot(d);
    const r = pm.clone().sub(A).addScaledVector(d, -tt);
    const ref = new V().copy(P.sleeveRef || new V(0.6, 0.8, 0));
    const up = ref.clone().addScaledVector(d, -ref.dot(d)).normalize();
    const side = new V().crossVectors(d, up);
    const ang = -Math.sign(p.x) * Math.atan2(r.dot(side), r.dot(up));
    const t0 = new V(xs, ys, A.z).sub(A).dot(d);
    const SL = L - t0;
    const asp = DEFAULT_ATLAS.sleeveR.w / DEFAULT_ATLAS.sleeveR.h;
    return { panel: p.x > 0 ? 'sleeveR' : 'sleeveL', x: 0.5 + (ang * r.length()) / (SL * asp), y: (tt - t0) / SL };
  }
  const v = (H - p.y) / H;
  if (p.z >= 0) return { panel: 'front', x: (p.x + fw) / (2 * fw), y: v };
  return { panel: 'back', x: (fw - p.x) / (2 * fw), y: v };
}

// Elemento (logo, bandera, texto, patrocinador) bajo el punto de la pieza
export function itemAt(st, hit) {
  if (!hit) return null;
  const atlas = (st.garment && st.garment.atlas) || DEFAULT_ATLAS;
  const dims = panelDims(atlas, st.garment);
  const [W, H] = dims[hit.panel];
  const pad = W * 0.02;
  let best = null;
  for (const it of layoutItems(st, dims)) {
    if (it.panel !== hit.panel) continue;
    const dx = Math.abs((hit.x - it.x) * W);
    const dy = Math.abs((hit.y - it.y) * H);
    if (dx <= it.bw / 2 + pad && dy <= it.bh / 2 + pad) {
      const area = it.bw * it.bh;
      if (!best || area < best.area) best = { ...it, area };
    }
  }
  return best;
}

// Inverso de pickPanel: de una posición de la pieza (fracción 0..1) al punto de la tela en 3D (coords. del jersey).
// cast(origin, dir) lanza un rayo en coordenadas locales y regresa { point, normal } o null.
export function panelToLocal(panel, fx, fy, garment, cast) {
  const P = garment.proj;
  const H = garment.height;
  const fw = P.fw;
  if (panel === 'front' || panel === 'back') {
    const front = panel === 'front';
    const x = front ? fw * (2 * fx - 1) : fw * (1 - 2 * fx);
    const y = H * (1 - fy);
    return cast(new V(x, y, front ? 1 : -1), new V(0, 0, front ? -1 : 1));
  }
  // mangas: se busca el punto sobre el eje y se lanza el rayo desde afuera hacia el eje
  const A = new V().copy(P.sleeveA);
  const C = new V().copy(P.sleeveC);
  const L = C.distanceTo(A);
  const d = C.clone().sub(A).normalize();
  const ref = new V().copy(P.sleeveRef || new V(0.6, 0.8, 0));
  const up = ref.clone().addScaledVector(d, -ref.dot(d)).normalize();
  const side = new V().crossVectors(d, up);
  const t0 = new V(P.xs || fw, P.ys || H * 0.9, A.z).sub(A).dot(d);
  const SL = L - t0;
  const asp = DEFAULT_ATLAS.sleeveR.w / DEFAULT_ATLAS.sleeveR.h;
  const t = t0 + fy * SL;
  const arc = (fx - 0.5) * SL * asp;
  const sgn = panel === 'sleeveR' ? 1 : -1; // lado +x o -x
  const axisP = A.clone().addScaledVector(d, t);
  // se ajusta el ángulo hasta que el punto encontrado caiga exactamente en fx (la superficie no es un cilindro)
  let r = 0.06;
  let geo = (sgn > 0 ? -1 : 1) * (arc / r);
  let hit = null;
  for (let k = 0; k < 7; k++) {
    const dir = up.clone().multiplyScalar(Math.cos(geo)).addScaledVector(side, Math.sin(geo)).normalize();
    const o = axisP.clone().addScaledVector(dir, 0.35);
    const h = cast(new V(o.x * sgn, o.y, o.z), new V(-dir.x * sgn, -dir.y, -dir.z));
    if (!h) break;
    hit = h;
    const pm = new V(Math.abs(h.point.x), h.point.y, h.point.z);
    const tt = pm.clone().sub(A).dot(d);
    r = Math.max(0.02, pm.clone().sub(A).addScaledVector(d, -tt).length());
    const back = pickPanel(h.point, garment);
    if (!back) break;
    const err = fx - back.x;
    if (Math.abs(err) < 0.002) break;
    geo += (sgn > 0 ? -1 : 1) * ((err * SL * asp) / r);
  }
  return hit;
}

// Índice de la tela por pieza: cada vértice con su posición en la pieza (para ubicar puntos sin raycast)
const indexCache = new WeakMap();
const G = 48;
export function panelIndex(garment) {
  if (indexCache.has(garment)) return indexCache.get(garment);
  const idx = {};
  const tmp = new V();
  for (const part of garment.parts) {
    if (part.role !== 'fabric') continue;
    const P = part.geometry.attributes.position;
    const N = part.geometry.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      tmp.fromBufferAttribute(P, i);
      const h = pickPanel(tmp, garment);
      if (!h || h.x < -0.2 || h.x > 1.2 || h.y < -0.2 || h.y > 1.2) continue;
      const pi = idx[h.panel] || (idx[h.panel] = { cells: new Map() });
      const cx = Math.floor(Math.min(1, Math.max(0, h.x)) * G);
      const cy = Math.floor(Math.min(1, Math.max(0, h.y)) * G);
      const key = cx * 100 + cy;
      let cell = pi.cells.get(key);
      if (!cell) pi.cells.set(key, (cell = []));
      cell.push({ x: h.x, y: h.y, p: tmp.clone(), n: N ? new V().fromBufferAttribute(N, i) : new V(0, 0, 1) });
    }
  }
  indexCache.set(garment, idx);
  return idx;
}

// punto de la tela más cercano a (fx, fy) de una pieza → { point, normal } en coordenadas del jersey
export function panelPoint(garment, panel, fx, fy, aspect = 1) {
  const pi = panelIndex(garment)[panel];
  if (!pi) return null;
  const cx = Math.floor(Math.min(1, Math.max(0, fx)) * G);
  const cy = Math.floor(Math.min(1, Math.max(0, fy)) * G);
  let best = null;
  for (let r = 0; r < 6 && !best; r++) {
    for (let i = cx - r; i <= cx + r; i++)
      for (let j = cy - r; j <= cy + r; j++) {
        const cell = pi.cells.get(i * 100 + j);
        if (!cell) continue;
        for (const v of cell) {
          const d = ((v.x - fx) * aspect) ** 2 + (v.y - fy) ** 2;
          if (!best || d < best.d) best = { d, v };
        }
      }
  }
  return best ? { point: best.v.p.clone(), normal: best.v.n.clone() } : null;
}
