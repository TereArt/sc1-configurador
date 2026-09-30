import * as THREE from 'three';
import { composePanels, composeAtlas, DEFAULT_ATLAS } from './compose.js';

// Lienzo único: se pinta con el diseño y se usa como textura del modelo y como archivo de impresión
export const texCanvas = document.createElement('canvas');
texCanvas.width = texCanvas.height = 2048;

export const jerseyTexture = new THREE.CanvasTexture(texCanvas);
jerseyTexture.colorSpace = THREE.SRGBColorSpace;
jerseyTexture.anisotropy = 8;

export let lastPanels = null;
let paintId = 0;

// Pinta el diseño en la textura según el mapa UV de la prenda activa (solo se aplica el último pedido)
export async function paint(state, garment) {
  const id = ++paintId;
  const atlas = (garment && garment.atlas) || DEFAULT_ATLAS;
  const panels = await composePanels(state, atlas);
  if (id !== paintId) return false;
  lastPanels = panels;
  composeAtlas(texCanvas, panels, atlas, state.colors.a);
  const flip = garment ? garment.flipY !== false : true;
  if (jerseyTexture.flipY !== flip) {
    jerseyTexture.flipY = flip;
    jerseyTexture.dispose();
  }
  jerseyTexture.needsUpdate = true;
  return true;
}

// Tipos de tejido: mapas de relieve (normal maps) generados por código
function heightToNormal(S, h, strength = 2) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const H = (x, y) => h(((x % S) + S) % S, ((y % S) + S) % S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 4;
      img.data[i] = (-dx / l) * 127.5 + 127.5;
      img.data[i + 1] = (-dy / l) * 127.5 + 127.5;
      img.data[i + 2] = (1 / l) * 127.5 + 127.5;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Malla "Tecno Dry" (bird-eye): perforaciones ovaladas en filas alternadas, como la tela de referencia
function birdEye(x, y) {
  // celda de 16 x 22 px; filas alternadas desplazadas medio paso
  const cw = 16, ch = 16;
  const row = Math.floor(y / ch);
  const ox = (row % 2) * (cw / 2);
  const u = (((x + ox) % cw) + cw) % cw - cw / 2;
  const v = (((y % ch) + ch) % ch) - ch / 2;
  const d = Math.hypot(u / 2.2, v / 4.4);
  const hole = 1 - Math.min(1, Math.max(0, (d - 0.75) / 0.45));
  // tejido fino entre perforaciones
  const knit = 0.12 * Math.sin((x / 64) * Math.PI * 2 * 16) * Math.sin((y / 64) * Math.PI * 2 * 11);
  return -hole + knit;
}

export const WEAVES = {
  tecnodry: { label: 'Tecno Dry (malla transpirable)', repeat: 70, strength: 1.1, S: 64, h: (x, y) => birdEye(x, y), cavity: 0.35 },
  liso: { label: 'Interlock liso', repeat: 220, strength: 0.35, h: (x, y) => Math.sin((x / 64) * Math.PI * 2 * 4) * 0.5 + Math.sin((y / 64) * Math.PI * 2 * 6 + Math.sin((x / 64) * Math.PI * 2 * 2)) * 0.5, S: 64 },
  panal: {
    label: 'Panal (honeycomb)',
    repeat: 70,
    strength: 0.9,
    S: 128,
    h: (x, y) => {
      // celdas hexagonales
      const s = 128 / 4;
      const r = s / Math.sqrt(3);
      let best = 1e9;
      for (let j = -1; j <= 5; j++)
        for (let i = -1; i <= 5; i++) {
          const cx = i * s + (j % 2 ? s / 2 : 0);
          const cy = j * r * 1.5;
          best = Math.min(best, Math.hypot(x - cx, y - cy));
        }
      return Math.min(1, best / (s * 0.5)) ** 2;
    },
  },
  malla: {
    label: 'Malla deportiva',
    repeat: 90,
    strength: 1.2,
    S: 64,
    h: (x, y) => {
      const u = (x % 16) - 8;
      const v = ((y + (Math.floor(x / 16) % 2) * 8) % 16) - 8;
      const d = Math.hypot(u, v * 1.3);
      return d < 4.2 ? -1 : 0.4;
    },
  },
  pique: { label: 'Piqué', repeat: 120, strength: 0.7, S: 64, h: (x, y) => Math.abs(Math.sin((x + y) / 64 * Math.PI * 8)) * Math.abs(Math.sin((x - y) / 64 * Math.PI * 8)) },
};
const weaveTex = {};
export function weaveTexture(id) {
  const w = WEAVES[id] || WEAVES.liso;
  if (!weaveTex[id]) weaveTex[id] = heightToNormal(w.S, w.h, 2.2);
  return weaveTex[id];
}

// Sombreado dentro de las perforaciones (se oscurece un poco el fondo de cada hoyito)
const cavTex = {};
export function weaveCavity(id) {
  const w = WEAVES[id] || WEAVES.liso;
  if (cavTex[id]) return cavTex[id];
  const S = w.S;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  let lo = Infinity, hi = -Infinity;
  const vals = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = w.h(x, y); vals.push(v); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  vals.forEach((v, i) => {
    const t = Math.round(((v - lo) / (hi - lo || 1)) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = t;
    img.data[i * 4 + 3] = 255;
  });
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cavTex[id] = t;
  return t;
}

// Mapa de normales del tejido interlock (procedural, sin archivos externos)
function makeKnitNormal() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const h = (x, y) => {
    const u = (x / S) * Math.PI * 2 * 8;
    const v = (y / S) * Math.PI * 2 * 12;
    return Math.sin(u) * 0.5 + Math.sin(v + Math.sin(u * 0.5) * 1.2) * 0.5;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const n = [-dx, -dy, 2];
      const l = Math.hypot(...n);
      const i = (y * S + x) * 4;
      img.data[i] = ((n[0] / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((n[1] / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((n[2] / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(110, 110);
  return t;
}
export const knitNormal = makeKnitNormal();

// Brillo del piso del escenario
export function makeFloorTexture(color = '#2f5bff') {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(47,91,255,0.28)');
  g.addColorStop(0.55, 'rgba(47,91,255,0.08)');
  g.addColorStop(0.78, 'rgba(47,91,255,0.0)');
  g.addColorStop(0.8, 'rgba(90,130,255,0.9)');
  g.addColorStop(0.83, 'rgba(47,91,255,0.25)');
  g.addColorStop(1, 'rgba(47,91,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function toThree(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
  g.setIndex(new THREE.BufferAttribute(m.idx, 1));
  g.computeBoundingSphere();
  return g;
}
