// Conversión inteligente de foto → logo vectorial (en el navegador, en menos de un segundo).
// 1) reduce la foto, 2) quita el fondo (color de las orillas, relleno desde los bordes),
// 3) recorta al logo, 4) reduce a pocos colores y traza contornos (imagetracerjs),
// 5) limpia el SVG y, si se pide, lo pasa a una sola tinta para integrarlo al jersey.
import ImageTracer from 'imagetracerjs';

const MAX = 520; // px de trabajo (suficiente para un logo; el resultado es vector)

function toCanvas(img, max = MAX) {
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  const s = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.max(8, Math.round(w0 * s));
  c.height = Math.max(8, Math.round(h0 * s));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

const dist2 = (d, i, c) => (d[i] - c[0]) ** 2 + (d[i + 1] - c[1]) ** 2 + (d[i + 2] - c[2]) ** 2;

// Color de fondo: mediana de los píxeles de la orilla
function borderColor(d, W, H) {
  const rs = [], gs = [], bs = [];
  let transparent = 0, n = 0;
  const take = (x, y) => {
    const i = (y * W + x) * 4;
    n++;
    if (d[i + 3] < 40) return transparent++;
    rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]);
  };
  for (let x = 0; x < W; x += 2) { take(x, 0); take(x, H - 1); }
  for (let y = 0; y < H; y += 2) { take(0, y); take(W - 1, y); }
  if (transparent > n * 0.5 || !rs.length) return null;
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  return [med(rs), med(gs), med(bs)];
}

// Quita el fondo: relleno desde las orillas con tolerancia adaptada a la variación del fondo
function removeBackground(c) {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const W = c.width, H = c.height;
  const im = ctx.getImageData(0, 0, W, H);
  const d = im.data;
  const bg = borderColor(d, W, H);
  if (!bg) return false;
  // variación típica del fondo en la orilla (sombras, textura de papel, ruido de cámara)
  let v = 0, k = 0;
  for (let x = 0; x < W; x += 3) { v += dist2(d, x * 4, bg); v += dist2(d, ((H - 1) * W + x) * 4, bg); k += 2; }
  const tol = Math.min(95 ** 2, Math.max(28 ** 2, (Math.sqrt(v / k) * 3.2) ** 2));
  const seen = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    const p = y * W + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (dist2(d, p * 4, bg) <= tol || d[p * 4 + 3] < 40) stack.push(p);
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    d[p * 4 + 3] = 0;
    const x = p % W, y = (p / W) | 0;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
  ctx.putImageData(im, 0, 0);
  return true;
}

// Recorta al contenido visible con un pequeño margen
function cropToContent(c) {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const { width: W, height: H } = c;
  const d = ctx.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (d[(y * W + x) * 4 + 3] > 60) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return c;
  const m = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03) + 2;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
  x1 = Math.min(W - 1, x1 + m); y1 = Math.min(H - 1, y1 + m);
  const out = document.createElement('canvas');
  // se vuelve a escalar para que el logo siempre tenga buena resolución al trazarlo
  const s = Math.min(3, MAX / Math.max(x1 - x0 + 1, y1 - y0 + 1));
  out.width = Math.round((x1 - x0 + 1) * s);
  out.height = Math.round((y1 - y0 + 1) * s);
  const o = out.getContext('2d', { willReadFrequently: true });
  o.imageSmoothingQuality = 'high';
  o.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, out.width, out.height);
  return out;
}

// Alfa binaria (el trazador trabaja mejor sin bordes semitransparentes)
function hardAlpha(c) {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const im = ctx.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  ctx.putImageData(im, 0, 0);
}

// ---- colores: k-means en espacio perceptual (inicio "el más distinto" para no perder detalles pequeños, p. ej. texto blanco)
function toLab(r, g, b) {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = f(r), G = f(g), B = f(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))];
}

function quantize(d, W, H, k) {
  const N = W * H;
  const lab = new Float32Array(N * 3);
  const idx = [];
  for (let p = 0; p < N; p++) {
    if (!d[p * 4 + 3]) continue;
    const L = toLab(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]);
    lab[p * 3] = L[0]; lab[p * 3 + 1] = L[1]; lab[p * 3 + 2] = L[2];
    idx.push(p);
  }
  if (!idx.length) return null;
  const step = Math.max(1, Math.floor(idx.length / 20000));
  const sample = idx.filter((_, i) => i % step === 0);
  const D = (p, c) => (lab[p * 3] - c[0]) ** 2 + (lab[p * 3 + 1] - c[1]) ** 2 + (lab[p * 3 + 2] - c[2]) ** 2;
  // inicio: color más común (aprox. mediana) y luego el punto más lejano a los centros ya elegidos
  const cs = [[lab[sample[sample.length >> 1] * 3], lab[sample[sample.length >> 1] * 3 + 1], lab[sample[sample.length >> 1] * 3 + 2]]];
  while (cs.length < k) {
    let far = -1, fd = -1;
    for (const p of sample) {
      let m = Infinity;
      for (const c of cs) m = Math.min(m, D(p, c));
      if (m > fd) { fd = m; far = p; }
    }
    if (fd < 60) break; // ya no hay colores realmente distintos
    cs.push([lab[far * 3], lab[far * 3 + 1], lab[far * 3 + 2]]);
  }
  const K = cs.length;
  for (let it = 0; it < 12; it++) {
    const acc = cs.map(() => [0, 0, 0, 0]);
    for (const p of sample) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < K; j++) { const dd = D(p, cs[j]); if (dd < bd) { bd = dd; best = j; } }
      const a = acc[best];
      a[0] += lab[p * 3]; a[1] += lab[p * 3 + 1]; a[2] += lab[p * 3 + 2]; a[3]++;
    }
    acc.forEach((a, j) => { if (a[3]) cs[j] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
  }
  // etiqueta por píxel (K = transparente) y color promedio real (RGB) de cada grupo
  const lbl = new Uint8Array(N).fill(K);
  const rgb = cs.map(() => [0, 0, 0, 0]);
  for (const p of idx) {
    let best = 0, bd = Infinity;
    for (let j = 0; j < K; j++) { const dd = D(p, cs[j]); if (dd < bd) { bd = dd; best = j; } }
    lbl[p] = best;
    const a = rgb[best];
    a[0] += d[p * 4]; a[1] += d[p * 4 + 1]; a[2] += d[p * 4 + 2]; a[3]++;
  }
  // colores limpios: casi blanco → blanco, casi negro → negro (la foto los ensucia con luz y sombras)
  const pal = rgb.map((a) => {
    if (!a[3]) return [0, 0, 0];
    const c = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
    const [L, A, B] = toLab(...c);
    const chroma = Math.hypot(A, B);
    if (L > 80 && chroma < 14) return [255, 255, 255];
    if (L < 14 && chroma < 12) return [10, 11, 14];
    return c.map(Math.round);
  });
  return { lbl, pal, K };
}

// filtro de moda: cada píxel toma la etiqueta más frecuente a su alrededor (quita ruido y filos de otro color)
function modeFilter(lbl, W, H, K, r) {
  const out = new Uint8Array(lbl.length);
  const cnt = new Uint16Array(K + 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      cnt.fill(0);
      for (let j = Math.max(0, y - r); j <= Math.min(H - 1, y + r); j++)
        for (let i = Math.max(0, x - r); i <= Math.min(W - 1, x + r); i++) cnt[lbl[j * W + i]]++;
      let best = lbl[y * W + x], bc = 0;
      for (let q = 0; q <= K; q++) if (cnt[q] > bc) { bc = cnt[q]; best = q; }
      out[y * W + x] = best;
    }
  return out;
}

function loadSvgImage(svg) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('No se pudo generar el vector'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

export const VEC_STYLES = [
  ['color', 'Colores originales'],
  ['tinta', 'Una tinta'],
  ['blanco', 'Blanco'],
];

// opts: { colors: 2..8, removeBg: bool, style: 'color' | 'tinta' | 'blanco', ink: '#hex' }
export async function vectorizeImage(img, opts = {}) {
  const { colors = 4, removeBg = true, style = 'color', ink = '#ffffff' } = opts;
  await new Promise((r) => setTimeout(r, 0)); // deja pintar la interfaz antes del cálculo
  let c = toCanvas(img);
  let bgRemoved = false;
  if (removeBg) bgRemoved = removeBackground(c);
  c = cropToContent(c);
  hardAlpha(c);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const W0 = c.width, H0 = c.height;
  const q = quantize(data.data, W0, H0, colors);
  if (!q) throw new Error('No se encontró un logo en la imagen');
  let lbl = modeFilter(q.lbl, W0, H0, q.K, 2);
  lbl = modeFilter(lbl, W0, H0, q.K, 1);
  const dd = data.data;
  for (let p = 0; p < W0 * H0; p++) {
    const L = lbl[p];
    if (L === q.K) { dd[p * 4 + 3] = 0; dd[p * 4] = dd[p * 4 + 1] = dd[p * 4 + 2] = 0; continue; }
    dd[p * 4] = q.pal[L][0]; dd[p * 4 + 1] = q.pal[L][1]; dd[p * 4 + 2] = q.pal[L][2]; dd[p * 4 + 3] = 255;
  }
  const small = Math.max(W0, H0);
  const raw = ImageTracer.imagedataToSVG(data, {
    pal: [...q.pal.map(([r, g, b]) => ({ r, g, b, a: 255 })), { r: 0, g: 0, b: 0, a: 0 }],
    numberofcolors: q.K + 1,
    colorquantcycles: 1,
    mincolorratio: 0,
    pathomit: Math.round(small / 70),
    ltres: 1,
    qtres: 1,
    blurradius: 0,
    rightangleenhance: true,
    linefilter: true,
    strokewidth: 0,
    roundcoords: 1,
    viewbox: true,
    desc: false,
  });
  // limpiar: quitar capas transparentes, dejar rellenos sólidos y (opcional) una sola tinta
  const tint = style === 'blanco' ? '#ffffff' : style === 'tinta' ? ink : null;
  const paths = [];
  raw.replace(/<path[^>]*\/>/g, (tag) => {
    const op = /opacity="([\d.]+)"/.exec(tag);
    if (op && parseFloat(op[1]) < 0.5) return '';
    const fill = /fill="([^"]+)"/.exec(tag);
    const dd = /d="([^"]+)"/.exec(tag);
    if (!dd) return '';
    paths.push(`<path fill="${tint || (fill ? fill[1] : '#000')}" d="${dd[1]}"/>`);
    return '';
  });
  if (!paths.length) throw new Error('No se encontró un logo en la imagen');
  const W = c.width, H = c.height;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${paths.join('')}</svg>`;
  const vimg = await loadSvgImage(svg);
  return { svg, img: vimg, paths: paths.length, bgRemoved };
}

// Lee un archivo subido: SVG se usa tal cual (ya es vector); foto → se vectoriza
export function readLogoFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Sin archivo'));
    if (file.size > 8 * 1024 * 1024) return reject(new Error('El archivo pesa más de 8 MB'));
    const reader = new FileReader();
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    reader.onload = () => {
      const src = isSvg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(reader.result) : reader.result;
      const img = new Image();
      img.onload = () => resolve({ img, name: file.name, svg: isSvg ? String(reader.result) : null, isSvg });
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = src;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    if (isSvg) reader.readAsText(file);
    else reader.readAsDataURL(file);
  });
}

// "Foto real" de ejemplo: un escudo impreso en papel, fotografiado con luz dispareja y ruido
export function sampleLogoPhoto() {
  const W = 720, H = 540;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(W * 0.35, H * 0.3, 40, W * 0.5, H * 0.5, W * 0.75);
  g.addColorStop(0, '#f3efe6');
  g.addColorStop(1, '#c9c2b3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2 + 6);
  ctx.rotate(-0.05);
  // escudo
  ctx.beginPath();
  ctx.moveTo(0, -190); ctx.lineTo(150, -140); ctx.lineTo(140, 40);
  ctx.quadraticCurveTo(110, 140, 0, 200); ctx.quadraticCurveTo(-110, 140, -140, 40);
  ctx.lineTo(-150, -140); ctx.closePath();
  ctx.fillStyle = '#16233f'; ctx.fill();
  ctx.lineWidth = 16; ctx.strokeStyle = '#e8b21f'; ctx.stroke();
  // rayo
  ctx.beginPath();
  ctx.moveTo(18, -130); ctx.lineTo(-62, 10); ctx.lineTo(-6, 10); ctx.lineTo(-30, 120); ctx.lineTo(62, -30); ctx.lineTo(6, -30); ctx.lineTo(40, -130); ctx.closePath();
  ctx.fillStyle = '#e8b21f'; ctx.fill();
  // banda con texto
  ctx.fillStyle = '#d7263d';
  ctx.fillRect(-175, 40, 350, 62);
  ctx.fillStyle = '#ffffff';
  ctx.font = "700 46px 'Chakra Petch', 'Arial Black', sans-serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('VOLT GG', 0, 73);
  ctx.restore();
  // luz dispareja + ruido de cámara
  const sh = ctx.createLinearGradient(0, 0, W, H);
  sh.addColorStop(0, 'rgba(255,255,255,0.10)');
  sh.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, W, H);
  const im = ctx.getImageData(0, 0, W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  for (let i = 0; i < im.data.length; i += 4) {
    const n = rnd() * 22;
    im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n;
  }
  ctx.putImageData(im, 0, 0);
  // compresión JPEG de celular
  const url = c.toDataURL('image/jpeg', 0.55);
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ img, name: 'foto-ejemplo.jpg', svg: null, isSvg: false });
    img.src = url;
  });
}
