// Arma la textura completa (el mismo lienzo sirve como archivo de impresión).
import { TEX } from './geometry.js';
import { drawTemplate, mix } from './templates.js';

export const FONTS = [
  { id: 'orbitron', label: 'Orbitron', css: "'Orbitron', 'Arial Black', sans-serif", weight: 900, scale: 0.92, spacing: 0.06 },
  { id: 'audiowide', label: 'Audiowide', css: "'Audiowide', 'Arial Black', sans-serif", weight: 400, scale: 1, spacing: 0.04 },
  { id: 'press', label: 'Press Start 2P', css: "'Press Start 2P', 'Courier New', monospace", weight: 400, scale: 0.66, spacing: 0.02 },
  { id: 'teko', label: 'Teko', css: "'Teko', 'Arial Narrow', sans-serif", weight: 600, scale: 1.32, spacing: 0.03 },
];

// Cada pieza se dibuja en su propio lienzo (coordenadas locales de la pieza).
export const PANEL_SIZE = {
  front: [1024, 1000],
  back: [1024, 1000],
  sleeveR: [1024, 400], // manga del lado +x del modelo (izquierda del jugador)
  sleeveL: [1024, 400],
};

// Posiciones dentro de cada pieza
export const LAYOUT = {
  backName: { x: 512, y: 300, maxW: 500, size: 112 },
  backNumber: { x: 512, y: 585, maxW: 470, size: 330 },
  frontLogo: { x: 712, y: 318, box: 150 },
  frontMark: { x: 312, y: 318, size: 70 },
  sleeveTag: { x: 512, y: 110, size: 64 },
};

// Dónde va cada pieza dentro de la textura del modelo procedural (px, lienzo 2048)
export const DEFAULT_ATLAS = {
  size: TEX.size,
  front: { x: 0, y: 0, w: 1024, h: TEX.torsoH },
  back: { x: 1024, y: 0, w: 1024, h: TEX.torsoH },
  sleeveR: { x: 0, y: TEX.sleeveY0, w: 1024, h: TEX.sleeveY1 - TEX.sleeveY0 },
  sleeveL: { x: 1024, y: TEX.sleeveY0, w: 1024, h: TEX.sleeveY1 - TEX.sleeveY0 },
};

function setFont(ctx, f, size) {
  ctx.font = `${f.weight} ${Math.round(size)}px ${f.css}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * f.spacing)}px`;
}

function drawLabel(ctx, text, { x, y, maxW, size }, font, fillColor, strokeColor, strokeW) {
  if (!text) return;
  let s = size * font.scale;
  setFont(ctx, font, s);
  let w = ctx.measureText(text).width;
  if (w > maxW) {
    s *= maxW / w;
    setFont(ctx, font, s);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (strokeW > 0) {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeW * (s / size) * 2;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function drawMark(ctx, x, y, size, color) {
  // marca SC1 en el pecho derecho del jugador
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px 'Chakra Petch', 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
  ctx.fillText('SC1', x, y);
  ctx.fillRect(x - size * 0.9, y + size * 0.56, size * 1.8, Math.max(3, size * 0.06));
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
}

function drawLogo(ctx, img, { x, y, box }) {
  const r = Math.min(box / img.width, box / img.height);
  const w = img.width * r;
  const h = img.height * r;
  ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
}

const panelCanvases = {};
function panelCanvas(key) {
  if (!panelCanvases[key]) {
    const c = document.createElement('canvas');
    [c.width, c.height] = PANEL_SIZE[key];
    panelCanvases[key] = c;
  }
  return panelCanvases[key];
}

// Dibuja las 4 piezas planas (esto es también el archivo de impresión)
export function composePanels(st, logoImg) {
  const C = st.colors;
  const font = FONTS.find((f) => f.id === st.font) || FONTS[0];
  const outline = st.outline ? (st.textColor.toLowerCase() === C.a.toLowerCase() ? C.b : C.a) : null;
  const name = (st.name || '').toUpperCase();
  const seeds = { front: 11, back: 23, sleeveR: 37, sleeveL: 37 };
  const out = {};
  for (const key of Object.keys(PANEL_SIZE)) {
    const c = panelCanvas(key);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.a;
    ctx.fillRect(0, 0, c.width, c.height);
    const part = key.startsWith('sleeve') ? 'sleeve' : key;
    drawTemplate(ctx, st.template, c.width, c.height, C, part, seeds[key]);

    if (key === 'back') {
      drawLabel(ctx, name, LAYOUT.backName, font, st.textColor, outline, st.outline ? 10 : 0);
      if (st.number !== '' && st.number != null) drawLabel(ctx, String(st.number), LAYOUT.backNumber, font, st.textColor, outline, st.outline ? 16 : 0);
    }
    if (key === 'front') {
      drawMark(ctx, LAYOUT.frontMark.x, LAYOUT.frontMark.y, LAYOUT.frontMark.size, st.textColor);
      if (logoImg) drawLogo(ctx, logoImg, LAYOUT.frontLogo);
      else {
        const { x, y, box } = LAYOUT.frontLogo;
        ctx.save();
        ctx.fillStyle = mix(C.a, C.b, 0.6);
        ctx.strokeStyle = st.textColor;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x - box * 0.36, y - box * 0.42);
        ctx.lineTo(x + box * 0.36, y - box * 0.42);
        ctx.lineTo(x + box * 0.36, y + box * 0.08);
        ctx.lineTo(x, y + box * 0.46);
        ctx.lineTo(x - box * 0.36, y + box * 0.08);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        drawLabel(ctx, name[0] || 'S', { x, y: y - box * 0.02, maxW: box * 0.5, size: box * 0.46 }, font, st.textColor, null, 0);
      }
    }
    if (key === 'sleeveR' && st.sleeveTag) {
      drawLabel(ctx, st.sleeveTag.toUpperCase(), { ...LAYOUT.sleeveTag, maxW: 260 }, font, st.textColor, outline, st.outline ? 6 : 0);
    }
    out[key] = c;
  }
  return out;
}

// Coloca las piezas en la textura según el "atlas" del modelo (procedural o .glb)
// Cada entrada: { x, y, w, h, rot (0|90|180|270), flipX, flipY } en píxeles del lienzo (y hacia abajo)
export function composeAtlas(canvas, panels, atlas, base) {
  const S = atlas.size;
  if (canvas.width !== S) {
    canvas.width = S;
    canvas.height = S;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  for (const key of Object.keys(PANEL_SIZE)) {
    const r = atlas[key];
    if (!r) continue;
    const src = panels[key];
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.rotate(((r.rot || 0) * Math.PI) / 180);
    const swap = r.rot === 90 || r.rot === 270;
    const w = swap ? r.h : r.w;
    const h = swap ? r.w : r.h;
    ctx.scale(r.flipX ? -1 : 1, r.flipY ? -1 : 1);
    const bleed = 6; // margen para que no se vean costuras
    ctx.drawImage(src, -w / 2 - bleed, -h / 2 - bleed, w + bleed * 2, h + bleed * 2);
    ctx.restore();
  }
  return canvas;
}

export function composeTexture(canvas, st, logoImg, atlas = DEFAULT_ATLAS) {
  const panels = composePanels(st, logoImg);
  return composeAtlas(canvas, panels, atlas, st.colors.a);
}

export function trimColors(st) {
  const C = st.colors;
  const map = { a: C.a, b: C.b, c: C.c, blanco: '#f4f5f8', negro: '#0b0d12' };
  const rib = map[st.collar] || C.c;
  return { collar: rib, cuff: rib, hem: mix(C.a, '#000000', 0.25), inner: mix(C.a, '#20242e', 0.6) };
}
