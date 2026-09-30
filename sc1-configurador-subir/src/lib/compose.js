// Arma cada pieza del jersey: diseño vectorial + gamertag + número + logos + patrocinador.
// Las piezas planas son a la vez la textura del modelo 3D y el archivo de impresión.
import { TEX } from './geometry.js';
import { patternImage, patternSVG, mix } from './patterns.js';

export { mix };

export const FONTS = [
  { id: 'orbitron', label: 'Orbitron', css: "'Orbitron', 'Arial Black', sans-serif", family: 'Orbitron', weight: 900, scale: 0.92, spacing: 0.06 },
  { id: 'audiowide', label: 'Audiowide', css: "'Audiowide', 'Arial Black', sans-serif", family: 'Audiowide', weight: 400, scale: 1, spacing: 0.04 },
  { id: 'press', label: 'Press Start 2P', css: "'Press Start 2P', 'Courier New', monospace", family: 'Press Start 2P', weight: 400, scale: 0.66, spacing: 0.02 },
  { id: 'teko', label: 'Teko', css: "'Teko', 'Arial Narrow', sans-serif", family: 'Teko', weight: 600, scale: 1.32, spacing: 0.03 },
];

export const PANELS = ['front', 'back', 'sleeveR', 'sleeveL'];

// Dónde va cada pieza dentro de la textura del modelo procedural (px, lienzo 2048)
export const DEFAULT_ATLAS = {
  size: TEX.size,
  front: { x: 0, y: 0, w: 1024, h: TEX.torsoH },
  back: { x: 1024, y: 0, w: 1024, h: TEX.torsoH },
  sleeveR: { x: 0, y: TEX.sleeveY0, w: 1024, h: TEX.sleeveY1 - TEX.sleeveY0 },
  sleeveL: { x: 1024, y: TEX.sleeveY0, w: 1024, h: TEX.sleeveY1 - TEX.sleeveY0 },
};

// Posiciones en fracciones de la pieza (x, y de 0 a 1; tamaños relativos al ancho)
export const LAYOUT = {
  gamertag: { x: 0.5, y: 0.23, maxW: 0.62, size: 0.15 }, // espalda alta
  number: { x: 0.5, y: 0.43, maxW: 0.5, size: 0.52 },
  chest: { y: 0.27, box: 0.2, x: { der: 0.3, centro: 0.5, izq: 0.7 } }, // der/izq = del jugador
  mark: { x: 0.18, y: 0.9, size: 0.045 },
  sleeve: { x: 0.5, y: 0.5, box: 0.17, text: 0.075 }, // centrado en la manga, ~7 cm de ancho
};

// Lugares para patrocinadores (puede haber varios). Medidas relativas al ancho de la pieza.
export const SPONSOR_POS = {
  pecho: { label: 'Frente · pecho', panel: 'front', x: 0.5, y: 0.44, boxW: 0.46, boxH: 0.15, size: 0.085, maxW: 0.56 },
  abdomen: { label: 'Frente · abajo', panel: 'front', x: 0.5, y: 0.78, boxW: 0.4, boxH: 0.13, size: 0.075, maxW: 0.5 },
  espalda: { label: 'Espalda · abajo', panel: 'back', x: 0.5, y: 0.8, boxW: 0.44, boxH: 0.14, size: 0.08, maxW: 0.54 },
  mangaIzq: { label: 'Manga izquierda', panel: 'sleeveR', x: 0.5, y: 0.79, boxW: 0.2, boxH: 0.07, size: 0.05, maxW: 0.24 },
  mangaDer: { label: 'Manga derecha', panel: 'sleeveL', x: 0.5, y: 0.79, boxW: 0.2, boxH: 0.07, size: 0.05, maxW: 0.24 },
};
export const MAX_SPONSORS = 5;

// Banderas simplificadas (vectores)
export const FLAGS = {
  mx: { name: 'México', svg: '<rect width="3" height="2" fill="#ce1126"/><rect width="2" height="2" fill="#fff"/><rect width="1" height="2" fill="#006847"/><circle cx="1.5" cy="1" r="0.28" fill="#8a5a2b"/><path d="M1.2 1.15 Q1.5 1.45 1.8 1.15" stroke="#006847" stroke-width="0.07" fill="none"/>' },
  ar: { name: 'Argentina', svg: '<rect width="3" height="2" fill="#74acdf"/><rect y="0.667" width="3" height="0.667" fill="#fff"/><circle cx="1.5" cy="1" r="0.2" fill="#f6b40e"/>' },
  co: { name: 'Colombia', svg: '<rect width="3" height="2" fill="#ce1126"/><rect width="3" height="1.5" fill="#003893"/><rect width="3" height="1" fill="#fcd116"/>' },
  cl: { name: 'Chile', svg: '<rect width="3" height="2" fill="#d52b1e"/><rect width="3" height="1" fill="#fff"/><rect width="1" height="1" fill="#0039a6"/><polygon points="0.5,0.25 0.57,0.45 0.78,0.45 0.61,0.57 0.67,0.77 0.5,0.65 0.33,0.77 0.39,0.57 0.22,0.45 0.43,0.45" fill="#fff"/>' },
  pe: { name: 'Perú', svg: '<rect width="3" height="2" fill="#d91023"/><rect x="1" width="1" height="2" fill="#fff"/>' },
  es: { name: 'España', svg: '<rect width="3" height="2" fill="#aa151b"/><rect y="0.5" width="3" height="1" fill="#f1bf00"/>' },
  us: { name: 'Estados Unidos', svg: '<rect width="3" height="2" fill="#fff"/>' + [0, 2, 4, 6, 8, 10, 12].map((i) => `<rect y="${((i * 2) / 13).toFixed(3)}" width="3" height="${(2 / 13).toFixed(3)}" fill="#b22234"/>`).join('') + '<rect width="1.2" height="1.077" fill="#3c3b6e"/>' },
};

const flagCache = new Map();
function flagImage(code) {
  if (!FLAGS[code]) return Promise.resolve(null);
  if (flagCache.has(code)) return flagCache.get(code);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 3 2">${FLAGS[code].svg}</svg>`;
  const p = new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  flagCache.set(code, p);
  return p;
}

// tamaño de cada pieza según el rectángulo que ocupa en la textura (así no se deforman logos ni letras)
// En modo proyección la pieza de frente/espalda cubre todo el alto del jersey y el ancho del torso:
// su lienzo toma esa misma proporción (≈ 1 : 1.9) para que letras y logos no se vean estirados.
export function panelDims(atlas, garment) {
  const dims = {};
  const proj = garment && garment.mapping === 'projection' && garment.proj;
  for (const k of PANELS) {
    if (proj && (k === 'front' || k === 'back')) {
      const asp = garment.height / (2 * garment.proj.fw);
      const h = 1600;
      dims[k] = [Math.round(h / asp), h];
      continue;
    }
    const r = atlas[k] || DEFAULT_ATLAS[k];
    const swap = r.rot === 90 || r.rot === 270;
    const w = swap ? r.h : r.w;
    const h = swap ? r.w : r.h;
    const max = k.startsWith('sleeve') ? 900 : 1024;
    const s = max / Math.max(w, h);
    dims[k] = [Math.max(64, Math.round(w * s)), Math.max(64, Math.round(h * s))];
  }
  return dims;
}

function setFont(ctx, f, size) {
  ctx.font = `${f.weight} ${Math.round(size)}px ${f.css}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * f.spacing)}px`;
}

function drawText(ctx, text, x, y, size, maxW, font, fill, stroke, strokeW) {
  if (!text) return;
  let s = size * font.scale;
  setFont(ctx, font, s);
  const w = ctx.measureText(text).width;
  if (w > maxW) {
    s *= maxW / w;
    setFont(ctx, font, s);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (stroke && strokeW > 0) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeW * (s / size) * 2;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function drawFit(ctx, img, cx, cy, bw, bh) {
  const r = Math.min(bw / img.width, bh / img.height);
  ctx.drawImage(img, cx - (img.width * r) / 2, cy - (img.height * r) / 2, img.width * r, img.height * r);
}

function drawMark(ctx, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `700 ${Math.round(size)}px 'Chakra Petch', 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('sc1', x, y);
  ctx.restore();
}

const panelCanvases = {};
function panelCanvas(key, w, h) {
  let c = panelCanvases[key];
  if (!c) c = panelCanvases[key] = document.createElement('canvas');
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

export function outlineColor(st) {
  if (!st.outline) return null;
  return st.textColor.toLowerCase() === st.colors.a.toLowerCase() ? st.colors.b : st.colors.a;
}

// ---------- elementos que se pueden mover y deformar (logo del pecho, mangas, patrocinadores) ----------
// Cada elemento: { key, panel, kind: 'logo'|'flag'|'text', x, y (centro, fracción de la pieza),
//   bw, bh (caja en px de la pieza, ya con estiramiento), logo, flag, text }
// key: 'logo', 'sleeveLeft', 'sleeveRight', 'sp:<id>'
// Tamaño = caja natural (respeta la proporción del logo) × escala × estiramiento (sx, sy) que el cliente
// cambia arrastrando las esquinas.
const measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
function textAspect(text, font) {
  if (!measureCtx || !text) return 4;
  setFont(measureCtx, font, 100);
  const w = measureCtx.measureText(text).width;
  if ('letterSpacing' in measureCtx) measureCtx.letterSpacing = '0px';
  return Math.max(0.6, w / 100); // ancho / alto de la letra
}
// caja natural (px) de un contenido dentro de una caja máxima
function naturalBox(it, maxW, maxH, font) {
  let asp = 1;
  if (it.kind === 'logo' && it.logo && it.logo.img) asp = (it.logo.img.naturalWidth || it.logo.img.width || 1) / (it.logo.img.naturalHeight || it.logo.img.height || 1);
  else if (it.kind === 'flag') asp = 1.5;
  else if (it.kind === 'text') asp = textAspect(String(it.text || '').toUpperCase(), font);
  let w = maxW;
  let h = w / asp;
  if (h > maxH) {
    h = maxH;
    w = h * asp;
  }
  return [w, h];
}

export function layoutItems(st, dims) {
  const out = [];
  const font = FONTS.find((x) => x.id === st.font) || FONTS[0];
  const push = (base, maxW, maxH, sc, sx, sy, xy) => {
    const [w, h] = naturalBox(base, maxW * sc, maxH * sc, font);
    out.push({ ...base, x: xy.x, y: xy.y, bw: w * (sx || 1), bh: h * (sy || 1), baseW: w, baseH: h });
  };
  const ch = LAYOUT.chest;
  if (st.logo) {
    const [W] = dims.front;
    push({ key: 'logo', panel: 'front', kind: 'logo', logo: st.logo }, W * ch.box, W * ch.box, st.logoSize || 1, st.logoSX, st.logoSY, st.logoXY || { x: ch.x[st.logoPos || 'izq'], y: ch.y });
  }
  const L = LAYOUT.sleeve;
  // sleeveR = lado +x del modelo = manga IZQUIERDA del jugador
  for (const [key, panel] of [['sleeveLeft', 'sleeveR'], ['sleeveRight', 'sleeveL']]) {
    const it = st[key];
    if (!it || it.kind === 'none') continue;
    if (it.kind === 'logo' && !it.logo) continue;
    if (it.kind === 'text' && !it.text) continue;
    const [W, H] = dims[panel];
    const maxH = it.kind === 'text' ? W * L.text : H * 0.42;
    push({ key, panel, kind: it.kind, logo: it.logo, flag: it.flag, text: it.text }, it.kind === 'text' ? W * 0.3 : W * L.box, maxH, it.scale || 1, it.sx, it.sy, it.xy || { x: L.x, y: L.y });
  }
  for (const sp of st.sponsors || []) {
    const P = SPONSOR_POS[sp.pos];
    if (!P || !((sp.kind === 'logo' && sp.logo) || (sp.kind === 'text' && sp.text))) continue;
    const [W] = dims[P.panel];
    const text = sp.kind === 'text';
    push({ key: 'sp:' + sp.id, panel: P.panel, kind: sp.kind, logo: sp.logo, text: sp.text }, W * (text ? P.maxW : P.boxW), W * (text ? P.size : P.boxH), sp.scale || 1, sp.sx, sp.sy, sp.xy || { x: P.x, y: P.y });
  }
  return out;
}

// texto estirado a su caja exacta (el cliente lo puede deformar desde las esquinas)
function drawTextBox(ctx, text, cx, cy, bw, bh, font, fill, stroke) {
  ctx.save();
  setFont(ctx, font, 100);
  const tw = ctx.measureText(text).width || 1;
  ctx.translate(cx, cy);
  ctx.scale(bw / tw, bh / 100);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 10;
    ctx.strokeText(text, 0, 4);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 4);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
}

async function drawItem(ctx, W, H, it, st, font, outline) {
  const cx = W * it.x;
  const cy = H * it.y;
  const x0 = cx - it.bw / 2;
  const y0 = cy - it.bh / 2;
  if (it.kind === 'logo') ctx.drawImage(it.logo.img, x0, y0, it.bw, it.bh);
  if (it.kind === 'flag') {
    const img = await flagImage(it.flag);
    if (img) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 4;
      ctx.drawImage(img, x0, y0, it.bw, it.bh);
      ctx.restore();
    }
  }
  if (it.kind === 'text') drawTextBox(ctx, it.text.toUpperCase(), cx, cy, it.bw, it.bh, font, st.textColor, outline);
  // señalado con el mouse (la selección con esquinas se dibuja encima del visor)
  if (st.hoverKey === it.key && st.selKey !== it.key) {
    ctx.save();
    ctx.setLineDash([W * 0.012, W * 0.008]);
    ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeRect(x0 - 6, y0 - 6, it.bw + 12, it.bh + 12);
    ctx.restore();
  }
}

// Dibuja las 4 piezas. Asíncrono porque los diseños vectoriales se cargan como imagen.
export async function composePanels(st, atlas) {
  const C = st.colors;
  const font = FONTS.find((x) => x.id === st.font) || FONTS[0];
  const dims = panelDims(atlas, st.garment);
  const imgs = await Promise.all(PANELS.map((k) => patternImage(st.template, dims[k][0], dims[k][1], C, k.startsWith('sleeve') ? 'sleeve' : k, k)));
  const out = {};
  const outline = outlineColor(st);
  const items = layoutItems(st, dims);
  for (let i = 0; i < PANELS.length; i++) {
    const key = PANELS[i];
    const [W, H] = dims[key];
    const c = panelCanvas(key, W, H);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.a;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(imgs[i], 0, 0, W, H);

    if (key === 'back') {
      drawMark(ctx, W * 0.5, H * 0.1, W * 0.05, st.textColor);
      const g = LAYOUT.gamertag;
      drawText(ctx, (st.name || '').toUpperCase(), W * g.x, H * g.y, W * g.size, W * g.maxW, font, st.textColor, outline, 10);
      if (st.number !== '' && st.number != null) {
        const n = LAYOUT.number;
        drawText(ctx, String(st.number), W * n.x, H * n.y, W * n.size, W * n.maxW, font, st.textColor, outline, 16);
      }
    }
    if (key === 'front') {
      const ch = LAYOUT.chest;
      // marca sc1 en el pecho, del lado opuesto al logo (o debajo si el logo va al centro)
      const pos = st.logoPos || 'izq';
      const mx = pos === 'centro' ? 0.5 : pos === 'izq' ? ch.x.der : ch.x.izq;
      const my = pos === 'centro' && st.logo && !st.logoXY ? ch.y + ch.box * (st.logoSize || 1) * (W / H) * 0.75 : ch.y;
      drawMark(ctx, W * mx, H * my, W * 0.06, st.textColor);
    }
    for (const it of items) if (it.panel === key) await drawItem(ctx, W, H, it, st, font, outline);
    out[key] = c;
  }
  return out;
}

// Coloca las piezas en la textura según el "atlas" del modelo (procedural o .glb)
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
  for (const key of PANELS) {
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
    const bleed = 6;
    ctx.drawImage(src, -w / 2 - bleed, -h / 2 - bleed, w + bleed * 2, h + bleed * 2);
    ctx.restore();
  }
  return canvas;
}

export function trimColors(st) {
  const C = st.colors;
  const map = { a: C.a, b: C.b, c: C.c, blanco: '#f4f5f8', negro: '#0b0d12' };
  const pick = (k, def) => (k && k[0] === '#' ? k : map[k] || def);
  const rib = pick(st.collar, C.c);
  const rib2 = pick(st.collar2, C.b);
  const cuff = st.cuff ? pick(st.cuff, rib) : rib;
  return { collar: rib, collar2: rib2, cuff, hem: mix(C.a, '#000000', 0.25), inner: mix(C.a, '#8d93a3', 0.35) };
}

// ---------- archivo de impresión en vectores (SVG) ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function svgText(text, x, y, sizePx, font, fill, stroke, strokeW) {
  const s = sizePx * font.scale;
  const ls = s * font.spacing;
  const st = stroke ? `stroke="${stroke}" stroke-width="${strokeW * 2}" stroke-linejoin="round" paint-order="stroke"` : '';
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${esc(font.family)}" font-weight="${font.weight}" font-size="${s.toFixed(1)}" letter-spacing="${ls.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="${fill}" ${st}>${esc(text)}</text>`;
}

// Logo en el archivo de impresión: si fue vectorizado va como trazos (vector real), si no como imagen
function svgLogo(logo, cx, cy, bw, bh, par = 'xMidYMid meet') {
  if (logo.svg) {
    const inner = logo.svg.replace(/^[\s\S]*?<svg([^>]*)>/, (m, attrs) => {
      const vb = /viewBox="([^"]+)"/.exec(attrs);
      return `<svg x="${(cx - bw / 2).toFixed(1)}" y="${(cy - bh / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" preserveAspectRatio="${par}"${vb ? ` viewBox="${vb[1]}"` : ''}>`;
    });
    return inner;
  }
  return svgImage(logo.img.src, cx, cy, bw, bh, par);
}

function svgImage(src, cx, cy, bw, bh, par = 'xMidYMid meet') {
  return `<image href="${src}" x="${(cx - bw / 2).toFixed(1)}" y="${(cy - bh / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" preserveAspectRatio="${par}"/>`;
}

// Hoja con las 4 piezas planas en vectores (diseño y textos) + logos incrustados
export function printSVG(st, atlas) {
  const dims = panelDims(atlas, st.garment);
  const font = FONTS.find((x) => x.id === st.font) || FONTS[0];
  const outline = outlineColor(st);
  const gap = 60;
  const rowH = Math.max(dims.front[1], dims.back[1]) + gap + 30;
  const place = {
    front: [0, 0],
    back: [dims.front[0] + gap, 0],
    sleeveR: [0, rowH],
    sleeveL: [dims.sleeveR[0] + gap, rowH],
  };
  const totalW = Math.max(place.back[0] + dims.back[0], place.sleeveL[0] + dims.sleeveL[0]);
  const totalH = rowH + Math.max(dims.sleeveR[1], dims.sleeveL[1]);
  const labels = { front: 'FRENTE', back: 'ESPALDA', sleeveR: 'MANGA IZQUIERDA', sleeveL: 'MANGA DERECHA' };
  let body = '';
  const items = layoutItems(st, dims);
  for (const k of PANELS) {
    const [W, H] = dims[k];
    const [ox, oy] = place[k];
    const pat = patternSVG(st.template, W, H, st.colors, k.startsWith('sleeve') ? 'sleeve' : k, k).replace('<svg ', '<svg x="0" y="0" ');
    let over = '';
    if (k === 'back') {
      const g = LAYOUT.gamertag;
      if (st.name) over += svgText(st.name.toUpperCase(), W * g.x, H * g.y, W * g.size, font, st.textColor, outline, 10);
      const n = LAYOUT.number;
      if (st.number) over += svgText(String(st.number), W * n.x, H * n.y, W * n.size, font, st.textColor, outline, 16);
    }
    for (const it of items) {
      if (it.panel !== k) continue;
      const cx = W * it.x;
      const cy = H * it.y;
      if (it.kind === 'logo') over += svgLogo(it.logo, cx, cy, it.bw, it.bh, 'none');
      if (it.kind === 'flag' && FLAGS[it.flag]) over += `<svg x="${(cx - it.bw / 2).toFixed(1)}" y="${(cy - it.bh / 2).toFixed(1)}" width="${it.bw.toFixed(1)}" height="${it.bh.toFixed(1)}" viewBox="0 0 3 2">${FLAGS[it.flag].svg}</svg>`;
      if (it.kind === 'text') {
        const t = it.text.toUpperCase();
        const nat = textAspect(t, font) * it.bh; // ancho natural a esa altura
        over += `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${(it.bw / nat).toFixed(4)} 1)">${svgText(t, 0, 0, it.bh / font.scale, font, st.textColor, outline, 6)}</g>`;
      }
    }
    body += `<g transform="translate(${ox} ${oy})"><text x="0" y="-16" font-family="Arial" font-size="22" fill="#555">${labels[k]} · ${W}×${H}</text>${pat}${over}<rect width="${W}" height="${H}" fill="none" stroke="#999" stroke-dasharray="8 6"/></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH + 40}" viewBox="0 -40 ${totalW} ${totalH + 40}">${body}</svg>`;
}
