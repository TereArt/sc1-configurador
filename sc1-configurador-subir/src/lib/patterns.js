// Biblioteca de diseños de tela en VECTORES (SVG). Todos son originales de SC1.
// Cada diseño recibe el tamaño de la pieza (W×H), los 3 colores (a = base, b = secundario, c = acento),
// la pieza ('front' | 'back' | 'sleeve') y un generador aleatorio con semilla (siempre da lo mismo).
// El mismo SVG se usa para ver el jersey en 3D y como archivo de impresión.

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexRgb = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mix = (h1, h2, t) => {
  const a = hexRgb(h1);
  const b = hexRgb(h2);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const f = (n) => Math.round(n * 10) / 10;
const pts = (arr) => arr.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');

// ---------- piezas de construcción ----------
const bg = (W, H, c) => `<rect width="${W}" height="${H}" fill="${c}"/>`;
const poly = (p, fill, extra = '') => `<polygon points="${pts(p)}" fill="${fill}" ${extra}/>`;
const glowOf = (markup, blur = 10) => `<g filter="url(#blur${blur})" opacity="0.9">${markup}</g>${markup}`;
const lin = (id, x1, y1, x2, y2, stops) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="objectBoundingBox">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</linearGradient>`;
const shade = (W, H, part) =>
  part === 'sleeve'
    ? ''
    : `<defs>${lin('sh', 0, 0, 1, 0, [[0, '#000', 0.22], [0.16, '#000', 0], [0.84, '#000', 0], [1, '#000', 0.22]])}</defs><rect width="${W}" height="${H}" fill="url(#sh)"/>`;

// ---------- diseños ----------
const P = {};

// NEÓN
P['neon-rush'] = (W, H, C, part) => {
  const n = part === 'sleeve' ? 3 : 4;
  const k = part === 'sleeve' ? 0.5 : 0.9;
  let s = '';
  for (let i = 0; i < n; i++) {
    const x0 = W * (-0.25 + i * 0.32) + (part === 'back' ? W * 0.09 : 0);
    const bw = W * [0.15, 0.06, 0.11, 0.04][i % 4];
    s += poly([[x0, H], [x0 + bw, H], [x0 + bw + H * k, 0], [x0 + H * k, 0]], C.b, i % 2 ? 'opacity="0.55"' : '');
    s += glowOf(`<line x1="${f(x0 + bw)}" y1="${H}" x2="${f(x0 + bw + H * k)}" y2="0" stroke="${C.c}" stroke-width="7"/>`, 12);
  }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['circuit'] = (W, H, C, part, r) => {
  let s = `<defs>${lin('cg', 0, 1, 0, 0, [[0, C.b, 0.95], [0.7, C.b, 0]])}</defs><rect width="${W}" height="${H}" fill="url(#cg)"/>`;
  const step = W * 0.037;
  const traces = part === 'sleeve' ? 10 : 26;
  let lines = '';
  for (let k = 0; k < traces; k++) {
    let x = Math.round((r() * W) / step) * step;
    let y = part === 'sleeve' ? H : H - r() * H * 0.35;
    const p = [[x, y]];
    let dir = 0;
    const len = 6 + Math.floor(r() * 14);
    for (let i = 0; i < len; i++) {
      const t = r();
      dir = t < 0.25 ? -1 : t < 0.5 ? 1 : t < 0.8 ? 0 : dir;
      x += dir * step;
      y -= step;
      p.push([x, y]);
    }
    const w = k % 3 === 0 ? 4 : 6;
    const col = k % 3 === 0 ? C.c + '88' : C.c;
    lines += `<polyline points="${pts(p)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round"/><circle cx="${f(x)}" cy="${f(y)}" r="11" fill="${C.a}" stroke="${C.c}" stroke-width="5"/>`;
  }
  return bg(W, H, C.a) + s + glowOf(lines, 8) + shade(W, H, part);
};

P['pulse'] = (W, H, C, part, r) => {
  const cy = part === 'sleeve' ? H * 0.55 : part === 'back' ? H * 0.8 : H * 0.62;
  const bh = part === 'sleeve' ? H * 0.5 : H * 0.3;
  let bars = '';
  const n = part === 'sleeve' ? 40 : 64;
  const bw = W / n;
  for (let i = 0; i < n; i++) {
    const env = Math.sin((i / n) * Math.PI) ** 0.6;
    const a = (0.15 + r() * 0.85) * env * bh * 0.42;
    bars += `<rect x="${f(i * bw + bw * 0.22)}" y="${f(cy - a)}" width="${f(bw * 0.56)}" height="${f(a * 2)}" fill="${C.c}"/>`;
  }
  return (
    bg(W, H, C.a) +
    `<defs>${lin('pg', 0, 0, 0, 1, [[0, C.b, 0], [0.5, C.b, 0.95], [1, C.b, 0]])}</defs><rect y="${f(cy - bh / 2)}" width="${W}" height="${f(bh)}" fill="url(#pg)"/>` +
    glowOf(bars, 8) +
    `<rect y="${f(cy - 2)}" width="${W}" height="4" fill="${C.c}" opacity="0.7"/>` +
    shade(W, H, part)
  );
};

P['laser-grid'] = (W, H, C, part) => {
  const hz = part === 'sleeve' ? H * 0.2 : H * 0.45;
  let g = '';
  for (let i = -14; i <= 14; i++) g += `<line x1="${f(W / 2 + i * W * 0.03)}" y1="${f(hz)}" x2="${f(W / 2 + i * W * 0.16)}" y2="${H}" stroke="${C.c}" stroke-width="3"/>`;
  for (let k = 0; k < 10; k++) {
    const y = hz + (H - hz) * Math.pow(k / 9, 1.7);
    g += `<line x1="0" y1="${f(y)}" x2="${W}" y2="${f(y)}" stroke="${C.c}" stroke-width="3"/>`;
  }
  return (
    bg(W, H, C.a) +
    `<defs>${lin('lg', 0, 0, 0, 1, [[0, C.a, 1], [0.45, C.b, 0.6], [1, C.a, 1]])}</defs><rect width="${W}" height="${H}" fill="url(#lg)"/>` +
    glowOf(g, 6) +
    shade(W, H, part)
  );
};

P['neon-slash'] = (W, H, C, part) => {
  const s1 = [[W * -0.1, H * 0.95], [W * 0.1, H * 1.05], [W * 1.1, H * 0.15], [W * 0.9, H * 0.02]];
  const s2 = [[W * 0.05, H * 0.2], [W * 0.18, H * 0.08], [W * 1.05, H * 0.85], [W * 0.92, H * 0.98]];
  return (
    bg(W, H, C.a) +
    glowOf(poly(s1, C.b), 14) +
    glowOf(poly(s2, C.c), 14) +
    `<polyline points="${pts(s1.slice(1, 3))}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3" fill="none"/>` +
    shade(W, H, part)
  );
};

P['plasma'] = (W, H, C, part, r) => {
  let d = '<defs>';
  let s = '';
  for (let i = 0; i < 6; i++) {
    const col = i % 2 ? C.b : C.c;
    d += `<radialGradient id="pl${i}"><stop offset="0" stop-color="${col}" stop-opacity="0.85"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`;
    const rr = W * (0.25 + r() * 0.3);
    s += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(rr)}" fill="url(#pl${i})"/>`;
  }
  return bg(W, H, C.a) + d + '</defs>' + s + shade(W, H, part);
};

// GLITCH / DIGITAL
P['glitch-split'] = (W, H, C, part, r) => {
  let s = '';
  const n = part === 'sleeve' ? 7 : 16;
  for (let i = 0; i < n; i++) {
    const y = r() * H;
    const sh = H * (0.012 + r() * (part === 'sleeve' ? 0.12 : 0.09));
    const x = r() * W * 0.6 - W * 0.1;
    const sw = W * (0.25 + r() * 0.7);
    s += `<rect x="${f(x)}" y="${f(y)}" width="${f(sw)}" height="${f(sh)}" fill="${C.b}"/>`;
    s += `<rect x="${f(x + 14 + r() * 30)}" y="${f(y + sh * 0.2)}" width="${f(sw * (0.3 + r() * 0.5))}" height="${f(Math.max(4, sh * 0.18))}" fill="${C.c}" opacity="0.85"/>`;
  }
  for (let i = 0; i < (part === 'sleeve' ? 20 : 60); i++) {
    const z = 10 + r() * 26;
    s += `<rect x="${f(r() * W)}" y="${f(r() * H)}" width="${f(z)}" height="${f(z)}" fill="${r() < 0.5 ? C.c : C.b}" opacity="0.9"/>`;
  }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['static'] = (W, H, C, part, r) => {
  let s = `<defs>${lin('stg', 0, 0, 0, 1, [[0, C.a], [0.45, C.a], [1, C.b]])}</defs><rect width="${W}" height="${H}" fill="url(#stg)"/>`;
  const n = part === 'sleeve' ? 700 : 1800;
  for (let i = 0; i < n; i++) {
    const y = H * Math.pow(r(), 0.55);
    const z = 3 + r() * 6;
    const t = y / H;
    s += `<rect x="${f(r() * W)}" y="${f(y)}" width="${f(z * (1 + r() * 3))}" height="${f(z)}" fill="${r() < 0.4 ? C.c : '#ffffff'}" opacity="${f(0.15 + 0.6 * t)}"/>`;
  }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['scanline'] = (W, H, C, part) => {
  const by = H * (part === 'sleeve' ? 0.55 : 0.58);
  const bh = H * (part === 'sleeve' ? 0.26 : 0.14);
  let lines = '';
  for (let y = 0; y < H; y += 9) lines += `<rect y="${y}" width="${W}" height="3" fill="#000" opacity="0.28"/>`;
  return (
    bg(W, H, C.a) +
    `<rect y="${f(by - bh * 1.35)}" width="${W}" height="${f(bh * 0.35)}" fill="${C.b}"/>` +
    glowOf(`<rect y="${f(by)}" width="${W}" height="${f(bh)}" fill="${C.c}"/>`, 12) +
    lines +
    shade(W, H, part)
  );
};

P['data-rain'] = (W, H, C, part, r) => {
  let s = '';
  const cols = Math.round(W / 26);
  for (let i = 0; i < cols; i++) {
    const x = i * 26 + 8;
    let y = -r() * H * 0.5;
    while (y < H) {
      const len = 20 + r() * 90;
      const bright = r() < 0.15;
      s += `<rect x="${x}" y="${f(y)}" width="8" height="${f(len)}" fill="${bright ? C.c : C.b}" opacity="${bright ? 1 : f(0.3 + r() * 0.5)}"/>`;
      y += len + 12 + r() * 60;
    }
  }
  return bg(W, H, C.a) + glowOf(s, 4) + shade(W, H, part);
};

P['hud'] = (W, H, C, part) => {
  const cx = W * (part === 'back' ? 0.5 : 0.5);
  const cy = H * (part === 'sleeve' ? 0.5 : 0.62);
  const R = Math.min(W, H) * (part === 'sleeve' ? 0.4 : 0.36);
  let s = '';
  for (const k of [1, 0.72, 0.45]) s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * k)}" fill="none" stroke="${C.c}" stroke-width="${k === 1 ? 5 : 3}" stroke-dasharray="${k === 0.72 ? '18 12' : 'none'}"/>`;
  for (let a = 0; a < 360; a += 10) {
    const rad = (a * Math.PI) / 180;
    const l = a % 30 === 0 ? 26 : 12;
    s += `<line x1="${f(cx + Math.cos(rad) * R)}" y1="${f(cy + Math.sin(rad) * R)}" x2="${f(cx + Math.cos(rad) * (R + l))}" y2="${f(cy + Math.sin(rad) * (R + l))}" stroke="${C.c}" stroke-width="3"/>`;
  }
  s += `<line x1="0" y1="${f(cy)}" x2="${W}" y2="${f(cy)}" stroke="${C.b}" stroke-width="3"/><line x1="${f(cx)}" y1="0" x2="${f(cx)}" y2="${H}" stroke="${C.b}" stroke-width="3"/>`;
  const br = (x, y, sx, sy) => `<polyline points="${pts([[x, y + sy * 60], [x, y], [x + sx * 60, y]])}" fill="none" stroke="${C.c}" stroke-width="7"/>`;
  s += br(W * 0.06, H * 0.08, 1, 1) + br(W * 0.94, H * 0.08, -1, 1) + br(W * 0.06, H * 0.92, 1, -1) + br(W * 0.94, H * 0.92, -1, -1);
  return bg(W, H, C.a) + glowOf(s, 6) + shade(W, H, part);
};

P['halftone'] = (W, H, C, part) => {
  let s = '';
  const g = 30;
  for (let y = g / 2; y < H; y += g)
    for (let x = g / 2; x < W; x += g) {
      const t = part === 'sleeve' ? y / H : Math.max(0, (y / H - 0.25) / 0.75);
      const rr = (g / 2) * Math.min(1, t * 1.1);
      if (rr > 1) s += `<circle cx="${x}" cy="${y}" r="${f(rr)}" fill="${C.b}"/>`;
    }
  return bg(W, H, C.a) + s + `<rect y="${f(H * 0.22)}" width="${W}" height="10" fill="${C.c}"/>` + shade(W, H, part);
};

// RETRO / PIXEL
P['8-bit'] = (W, H, C, part, r) => {
  const z = part === 'sleeve' ? 32 : 40;
  let s = '';
  for (let y = 0; y < H; y += z) {
    const p = part === 'sleeve' ? 0.55 * (1 - y / H) : Math.max(0, 0.9 - (y / H) * 1.35);
    for (let x = 0; x < W; x += z) {
      const q = r();
      if (q < p) s += `<rect x="${x + 2}" y="${y + 2}" width="${z - 4}" height="${z - 4}" fill="${q < p * 0.12 ? C.c : q < p * 0.55 ? C.b : mix(C.a, C.b, 0.45)}"/>`;
    }
  }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['arcade'] = (W, H, C, part) => {
  const hz = H * (part === 'sleeve' ? 0.35 : 0.62);
  let s = `<defs>${lin('sky', 0, 0, 0, 1, [[0, C.a], [1, mix(C.a, C.b, 0.35)]])}${lin('sun', 0, 0, 0, 1, [[0, C.c], [1, C.b]])}</defs>`;
  s += `<rect width="${W}" height="${f(hz)}" fill="url(#sky)"/><rect y="${f(hz)}" width="${W}" height="${f(H - hz)}" fill="${mix(C.a, '#000000', 0.35)}"/>`;
  if (part !== 'sleeve') {
    const R = W * 0.3;
    s += glowOf(`<path d="M${f(W / 2 - R)},${f(hz)} A${f(R)},${f(R)} 0 0 1 ${f(W / 2 + R)},${f(hz)} Z" fill="url(#sun)"/>`, 16);
    for (let i = 0; i < 7; i++) s += `<rect x="${f(W / 2 - R)}" y="${f(hz - R * 0.08 - i * R * 0.13)}" width="${f(R * 2)}" height="${f(4 + (6 - i) * 2.4)}" fill="${mix(C.a, C.b, 0.35)}"/>`;
  }
  let g = '';
  for (let i = -12; i <= 12; i++) g += `<line x1="${f(W / 2 + i * 26)}" y1="${f(hz)}" x2="${f(W / 2 + i * 150)}" y2="${H}" stroke="${C.c}" stroke-width="3"/>`;
  for (let k = 0; k < 9; k++) {
    const y = hz + (H - hz) * Math.pow(k / 8, 1.8);
    g += `<line x1="0" y1="${f(y)}" x2="${W}" y2="${f(y)}" stroke="${C.c}" stroke-width="3"/>`;
  }
  return bg(W, H, C.a) + s + glowOf(g, 5);
};

P['pixel-camo'] = (W, H, C, part, r) => {
  const z = 32;
  const cols = Math.ceil(W / z);
  const rows = Math.ceil(H / z);
  const gw = Math.ceil(cols / 4) + 2;
  const gh = Math.ceil(rows / 4) + 2;
  const grid = Array.from({ length: gw * gh }, () => r());
  const at = (x, y) => grid[Math.min(gh - 1, y) * gw + Math.min(gw - 1, x)];
  const pal = [C.a, mix(C.a, C.b, 0.5), C.b, mix(C.b, '#000000', 0.35)];
  let s = '';
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const fx = x / 4;
      const fy = y / 4;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const v = (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
      const i = Math.max(0, Math.min(3, Math.floor((v + (r() - 0.5) * 0.12) * 4)));
      if (i > 0 || r() < 0.012) s += `<rect x="${x * z}" y="${y * z}" width="${z}" height="${z}" fill="${r() < 0.012 ? C.c : pal[i]}"/>`;
    }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['pixel-fade'] = (W, H, C, part, r) => {
  const z = 48;
  let s = '';
  for (let y = 0; y < H; y += z)
    for (let x = 0; x < W; x += z) {
      const t = part === 'sleeve' ? x / W : Math.abs(x / W - 0.5) * 2;
      if (r() < t * t * 1.1) s += `<rect x="${x + 3}" y="${y + 3}" width="${z - 6}" height="${z - 6}" fill="${r() < 0.15 ? C.c : C.b}"/>`;
    }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['synthwave'] = (W, H, C, part, r) => {
  const layers = [0.55, 0.68, 0.8];
  let s = `<defs>${lin('sw', 0, 0, 0, 1, [[0, mix(C.a, C.b, 0.25)], [1, C.a]])}</defs><rect width="${W}" height="${H}" fill="url(#sw)"/>`;
  if (part !== 'sleeve') s += glowOf(`<circle cx="${f(W * 0.5)}" cy="${f(H * 0.42)}" r="${f(W * 0.16)}" fill="${C.c}"/>`, 18);
  layers.forEach((ly, li) => {
    const p = [[0, H]];
    const n = 7;
    for (let i = 0; i <= n; i++) p.push([(i / n) * W, H * ly - r() * H * 0.18 * (i % 2 ? 1 : 0.3)]);
    p.push([W, H]);
    s += poly(p, mix(C.a, C.b, 0.7 - li * 0.25), `stroke="${C.c}" stroke-width="${li === 0 ? 4 : 0}"`);
  });
  return s + shade(W, H, part);
};

P['checker-race'] = (W, H, C, part) => {
  const z = 44;
  let s = '';
  const k = part === 'sleeve' ? 0 : 1;
  for (let i = -30; i < 60; i++)
    for (let j = 0; j < 4; j++) {
      if ((i + j) % 2) continue;
      const x = i * z;
      const y = H * 0.55 + j * z - x * 0.55 * k;
      s += poly([[x, y], [x + z, y - z * 0.55 * k], [x + z, y - z * 0.55 * k + z], [x, y + z]], C.b);
    }
  return bg(W, H, C.a) + `<g transform="translate(0 ${part === 'sleeve' ? -H * 0.3 : 0})">${s}</g>` + `<rect y="${f(H * 0.18)}" width="${W}" height="8" fill="${C.c}"/>` + shade(W, H, part);
};

// PRO / LIGA
P['apex'] = (W, H, C, part) => {
  if (part === 'sleeve')
    return bg(W, H, C.a) + `<rect x="${f(W * 0.36)}" width="${f(W * 0.28)}" height="${H}" fill="${C.b}"/><rect x="${f(W * 0.33)}" width="${f(W * 0.02)}" height="${H}" fill="${C.c}"/><rect x="${f(W * 0.65)}" width="${f(W * 0.02)}" height="${H}" fill="${C.c}"/>`;
  const tip = part === 'back' ? H * 0.2 : H * 0.62;
  const chev = (off, col, w) => poly([[-40, H * 0.02 + off], [W / 2, tip + off], [W + 40, H * 0.02 + off], [W + 40, H * 0.02 + off + w], [W / 2, tip + off + w], [-40, H * 0.02 + off + w]], col);
  let s = bg(W, H, C.a);
  if (part === 'back') s += `<rect y="${f(H * 0.62)}" width="${W}" height="${f(H * 0.38)}" fill="${mix(C.a, '#000000', 0.25)}"/>` + chev(H * 0.6, C.b, H * 0.06);
  else s += chev(0, C.b, H * 0.15) + chev(H * 0.17, C.c, H * 0.018);
  return s + shade(W, H, part);
};

P['sash'] = (W, H, C, part) => {
  const w = W * 0.26;
  const band = [[-W * 0.1, H * 0.9], [-W * 0.1, H * 0.9 + w], [W * 1.1, H * 0.05 + w], [W * 1.1, H * 0.05]];
  const pin = (o) => `<line x1="${-W * 0.1}" y1="${f(H * 0.9 + o)}" x2="${W * 1.1}" y2="${f(H * 0.05 + o)}" stroke="${C.c}" stroke-width="6"/>`;
  return bg(W, H, C.a) + poly(band, C.b) + pin(-18) + pin(w + 18) + shade(W, H, part);
};

P['split-half'] = (W, H, C, part) => {
  const x = part === 'back' ? W * 0.5 : W * 0.5;
  return bg(W, H, C.a) + `<rect x="${f(x)}" width="${f(W - x)}" height="${H}" fill="${C.b}"/><rect x="${f(x - 7)}" width="14" height="${H}" fill="${C.c}"/>` + shade(W, H, part);
};

P['yoke'] = (W, H, C, part) => {
  if (part === 'sleeve') return bg(W, H, C.b) + `<rect y="${f(H * 0.78)}" width="${W}" height="${f(H * 0.08)}" fill="${C.c}"/>`;
  const y = H * 0.3;
  return (
    bg(W, H, C.a) +
    poly([[0, 0], [W, 0], [W, y * 0.7], [W / 2, y], [0, y * 0.7]], C.b) +
    `<polyline points="${pts([[0, y * 0.7 + 14], [W / 2, y + 14], [W, y * 0.7 + 14]])}" fill="none" stroke="${C.c}" stroke-width="10"/>` +
    shade(W, H, part)
  );
};

P['pinstripe'] = (W, H, C, part) => {
  let s = '';
  for (let x = 20; x < W; x += 46) s += `<rect x="${x}" width="${x % 138 === 20 ? 10 : 4}" height="${H}" fill="${x % 138 === 20 ? C.c : C.b}"/>`;
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['hoops'] = (W, H, C, part) => {
  let s = '';
  const band = H / (part === 'sleeve' ? 4 : 7);
  for (let i = 0; i * band < H; i += 2) s += `<rect y="${f(i * band)}" width="${W}" height="${f(band)}" fill="${C.b}"/><rect y="${f(i * band + band - 6)}" width="${W}" height="6" fill="${C.c}"/>`;
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['side-panels'] = (W, H, C, part) => {
  if (part === 'sleeve') return bg(W, H, C.b) + `<rect x="${f(W * 0.47)}" width="${f(W * 0.06)}" height="${H}" fill="${C.c}"/>`;
  const p = W * 0.2;
  return (
    bg(W, H, C.a) +
    `<defs>${lin('sp', 0, 0, 1, 0, [[0, C.b], [1, C.b, 0]])}${lin('sp2', 1, 0, 0, 0, [[0, C.b], [1, C.b, 0]])}</defs>` +
    `<rect width="${f(p)}" height="${H}" fill="url(#sp)"/><rect x="${f(W - p)}" width="${f(p)}" height="${H}" fill="url(#sp2)"/>` +
    `<rect x="${f(p * 0.55)}" width="10" height="${H}" fill="${C.c}"/><rect x="${f(W - p * 0.55 - 10)}" width="10" height="${H}" fill="${C.c}"/>` +
    shade(W, H, part)
  );
};

P['center-stripe'] = (W, H, C, part) => {
  const w = W * 0.2;
  return (
    bg(W, H, C.a) +
    `<rect x="${f(W / 2 - w / 2)}" width="${f(w)}" height="${H}" fill="${C.b}"/>` +
    `<rect x="${f(W / 2 - w / 2 - 22)}" width="10" height="${H}" fill="${C.c}"/><rect x="${f(W / 2 + w / 2 + 12)}" width="10" height="${H}" fill="${C.c}"/>` +
    shade(W, H, part)
  );
};

// SALVAJE / TEXTURAS
P['tiger'] = (W, H, C, part, r) => {
  let s = '';
  const n = part === 'sleeve' ? 7 : 14;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const y = (i / n) * H * 1.05 + r() * 30;
    const x0 = side < 0 ? -20 : W + 20;
    const len = W * (0.25 + r() * 0.35);
    const x1 = x0 - side * len;
    const th = 18 + r() * 34;
    s += `<path d="M${x0},${f(y - th)} Q${f((x0 + x1) / 2)},${f(y - th * 1.4 + r() * 40)} ${f(x1)},${f(y + r() * 30)} Q${f((x0 + x1) / 2)},${f(y + th * 0.8)} ${x0},${f(y + th)} Z" fill="${i % 3 === 0 ? C.c : C.b}"/>`;
  }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['claw'] = (W, H, C, part) => {
  let s = '';
  for (let i = 0; i < 4; i++) {
    const ox = W * (0.2 + i * 0.13);
    const d = `M${f(ox)},${f(H * 0.08)} Q${f(ox + W * 0.1)},${f(H * 0.5)} ${f(ox + W * 0.34)},${f(H * 0.95)} L${f(ox + W * 0.3)},${f(H * 0.96)} Q${f(ox + W * 0.05)},${f(H * 0.55)} ${f(ox - W * 0.02)},${f(H * 0.1)} Z`;
    s += `<path d="${d}" fill="${C.b}"/><path d="${d}" fill="none" stroke="${C.c}" stroke-width="5" transform="translate(8 6)"/>`;
  }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['flames'] = (W, H, C, part, r) => {
  const flame = (base, height, col) => {
    let d = `M0,${H}`;
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * W;
      const tipY = H - height * (0.5 + r() * 0.6);
      d += ` Q${f(x - W / n / 2)},${f(base)} ${f(x)},${f(tipY)}`;
    }
    return `<path d="${d} L${W},${H} Z" fill="${col}"/>`;
  };
  const h = part === 'sleeve' ? H * 0.8 : H * 0.7;
  return bg(W, H, C.a) + glowOf(flame(H, h, C.b), 10) + flame(H, h * 0.72, C.c) + flame(H, h * 0.4, mix(C.c, '#ffffff', 0.35)) + shade(W, H, part);
};

P['lightning'] = (W, H, C, part, r) => {
  const bolt = (x, w) => {
    const p = [[x, -10]];
    let y = 0;
    let cx = x;
    while (y < H) {
      y += 60 + r() * 90;
      cx += (r() - 0.5) * 160;
      p.push([cx, y]);
    }
    return `<polyline points="${pts(p)}" fill="none" stroke="${C.c}" stroke-width="${w}" stroke-linejoin="bevel"/>`;
  };
  const n = part === 'sleeve' ? 2 : 4;
  let s = '';
  for (let i = 0; i < n; i++) s += bolt(W * (0.15 + (i / n) * 0.8), 8 + r() * 6);
  return bg(W, H, C.a) + `<defs>${lin('lt', 0, 0, 0, 1, [[0, C.b, 0.6], [1, C.a, 0]])}</defs><rect width="${W}" height="${H}" fill="url(#lt)"/>` + glowOf(s, 12) + shade(W, H, part);
};

P['splatter'] = (W, H, C, part, r) => {
  let s = '';
  const n = part === 'sleeve' ? 5 : 11;
  for (let i = 0; i < n; i++) {
    const cx = r() * W;
    const cy = r() * H;
    const col = i % 3 === 0 ? C.c : C.b;
    const R = 30 + r() * 90;
    s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="${col}"/>`;
    for (let k = 0; k < 12; k++) {
      const a = r() * Math.PI * 2;
      const d = R * (1 + r() * 1.6);
      s += `<circle cx="${f(cx + Math.cos(a) * d)}" cy="${f(cy + Math.sin(a) * d)}" r="${f(4 + r() * 16)}" fill="${col}"/>`;
    }
  }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['brush'] = (W, H, C, part, r) => {
  let s = '';
  const n = part === 'sleeve' ? 3 : 6;
  for (let i = 0; i < n; i++) {
    const y = H * (0.15 + (i / n) * 0.8);
    const col = i % 2 ? C.c : C.b;
    for (let k = 0; k < 14; k++) {
      const oy = (r() - 0.5) * 60;
      const x0 = -40 + r() * 80;
      const x1 = W * (0.5 + r() * 0.55);
      s += `<path d="M${f(x0)},${f(y + oy)} Q${f(x1 / 2)},${f(y + oy - 40 + r() * 80)} ${f(x1)},${f(y + oy + (r() - 0.5) * 40)}" stroke="${col}" stroke-width="${f(3 + r() * 12)}" fill="none" stroke-linecap="round" opacity="${f(0.5 + r() * 0.5)}"/>`;
    }
  }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['camo'] = (W, H, C, part, r) => {
  const blob = (col) => {
    const cx = r() * W;
    const cy = r() * H;
    const R = 50 + r() * 110;
    const n = 9;
    const p = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = R * (0.55 + r() * 0.6);
      p.push([cx + Math.cos(a) * rr * 1.5, cy + Math.sin(a) * rr]);
    }
    let d = `M${f(p[0][0])},${f(p[0][1])}`;
    for (let i = 0; i < n; i++) {
      const q = p[(i + 1) % n];
      const m = [(p[i][0] + q[0]) / 2, (p[i][1] + q[1]) / 2];
      d += ` Q${f(p[i][0])},${f(p[i][1])} ${f(m[0])},${f(m[1])}`;
    }
    return `<path d="${d} Z" fill="${col}"/>`;
  };
  let s = '';
  const cols = [mix(C.a, C.b, 0.5), C.b, mix(C.b, '#000000', 0.3), C.c];
  const n = part === 'sleeve' ? 10 : 26;
  for (let i = 0; i < n; i++) s += blob(cols[i % 4 === 3 && r() < 0.5 ? 3 : i % 3]);
  return bg(W, H, C.a) + s + shade(W, H, part);
};

// GEOMÉTRICO
P['hex'] = (W, H, C, part, r) => {
  const R = 34;
  const dx = R * Math.sqrt(3);
  const dy = R * 1.5;
  let s = '';
  for (let row = -1; row * dy < H + R; row++)
    for (let col = -1; col * dx < W + dx; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0);
      const cy = row * dy;
      const edge = part === 'sleeve' ? cy / H : Math.abs(cx / W - 0.5) * 2;
      const p = Math.pow(Math.max(0, edge), 1.6);
      const hp = [];
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        hp.push([cx + Math.cos(a) * (R - 3), cy + Math.sin(a) * (R - 3)]);
      }
      const on = r() < p * 0.95;
      s += poly(hp, on ? (r() < 0.08 ? C.c : C.b) : 'none', `fill-opacity="${f(0.4 + 0.6 * p)}" stroke="${C.c}" stroke-opacity="${f(0.08 + 0.3 * p)}" stroke-width="2"`);
    }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['shard'] = (W, H, C, part, r) => {
  let s = '';
  const n = part === 'sleeve' ? 18 : 46;
  for (let i = 0; i < n; i++) {
    const t = r();
    const cx = W * (0.1 + t * 0.9) + (r() - 0.5) * 220;
    const cy = H * (1 - t * 0.85) + (r() - 0.5) * 200;
    const z = 60 + r() * 180;
    const p = [0, 1, 2].map(() => {
      const a = r() * Math.PI * 2;
      const rr = z * (0.5 + r() * 0.6);
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
    });
    const q = r();
    s += poly(p, q < 0.18 ? C.c : C.b, `fill-opacity="${q < 0.18 ? 0.85 : f(0.35 + r() * 0.5)}" ${q < 0.3 ? `stroke="${C.c}" stroke-width="3"` : ''}`);
  }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['low-poly'] = (W, H, C, part, r) => {
  const z = 110;
  const cols = Math.ceil(W / z) + 1;
  const rows = Math.ceil(H / z) + 1;
  const g = [];
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) g.push([x * z + (r() - 0.5) * z * 0.6, y * z + (r() - 0.5) * z * 0.6]);
  const at = (x, y) => g[y * (cols + 1) + x];
  let s = '';
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const t = part === 'sleeve' ? y / rows : Math.abs(x / cols - 0.5) * 2;
      const c1 = mix(C.a, C.b, Math.min(1, t * (0.5 + r() * 0.8)));
      const c2 = mix(C.a, C.b, Math.min(1, t * (0.5 + r() * 0.8)));
      s += poly([at(x, y), at(x + 1, y), at(x, y + 1)], r() < 0.03 ? C.c : c1) + poly([at(x + 1, y), at(x + 1, y + 1), at(x, y + 1)], c2);
    }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['topo'] = (W, H, C, part, r) => {
  let s = '';
  const cx = W * (0.3 + r() * 0.4);
  const cy = H * (0.5 + r() * 0.3);
  const ph = [r() * 6, r() * 6, r() * 6];
  for (let k = 1; k < 22; k++) {
    const p = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const rr = k * 34 * (1 + 0.18 * Math.sin(a * 3 + ph[0]) + 0.1 * Math.sin(a * 5 + ph[1] + k * 0.2));
      p.push([cx + Math.cos(a) * rr * 1.2, cy + Math.sin(a) * rr]);
    }
    s += `<polyline points="${pts(p)}" fill="none" stroke="${k % 5 === 0 ? C.c : C.b}" stroke-width="${k % 5 === 0 ? 5 : 3}"/>`;
  }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['zigzag'] = (W, H, C, part) => {
  let s = '';
  const amp = 50;
  const step = 90;
  const bands = part === 'sleeve' ? [0.5] : [0.35, 0.62];
  for (const b of bands) {
    const y = H * b;
    const top = [];
    for (let x = -step; x <= W + step; x += step) top.push([x, y + ((x / step) % 2 ? -amp : amp)]);
    const bot = top.map(([x, yy]) => [x, yy + 70]).reverse();
    s += poly([...top, ...bot], C.b);
    s += `<polyline points="${pts(top.map(([x, yy]) => [x, yy - 16]))}" fill="none" stroke="${C.c}" stroke-width="8"/>`;
  }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['scales'] = (W, H, C, part) => {
  const R = 44;
  let s = '';
  for (let row = 0; row * R * 0.8 < H + R; row++)
    for (let col = -1; col * R * 2 < W + R * 2; col++) {
      const cx = col * R * 2 + (row % 2 ? R : 0);
      const cy = row * R * 0.8;
      const t = part === 'sleeve' ? row / (H / (R * 0.8)) : cy / H;
      s += `<path d="M${cx - R},${f(cy)} A${R},${R} 0 0 0 ${cx + R},${f(cy)}" fill="${mix(C.a, C.b, Math.min(1, t * 1.2))}" stroke="${C.c}" stroke-width="3" stroke-opacity="${f(0.25 + t * 0.6)}"/>`;
    }
  return bg(W, H, C.a) + s + shade(W, H, part);
};

P['waves'] = (W, H, C, part) => {
  let s = '';
  const n = part === 'sleeve' ? 3 : 5;
  for (let i = 0; i < n; i++) {
    const y0 = H * (0.25 + (i / n) * 0.7);
    const amp = 40 + i * 12;
    let d = `M0,${f(y0)}`;
    for (let x = 0; x <= W; x += 32) d += ` L${x},${f(y0 + Math.sin(x / 110 + i) * amp)}`;
    const col = i % 2 ? C.c : C.b;
    s += `<path d="${d} L${W},${H} L0,${H} Z" fill="${col}" opacity="${f(0.25 + i * 0.12)}"/>`;
    s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="5"/>`;
  }
  return bg(W, H, C.a) + s + shade(W, H, part);
};


// ---------- SC1 ORIGINALES (réplica de los jerseys del catálogo de SC1) ----------
// trazos orgánicos tipo "tribal" (textura de la Jersey girl)
function swirls(W, H, col, r, n, op = 0.75) {
  let s = '';
  for (let k = 0; k < n; k++) {
    let x = r() * W;
    let y = r() * H;
    let a = r() * Math.PI * 2;
    let d = `M${f(x)},${f(y)}`;
    const segs = 3 + Math.floor(r() * 4);
    for (let i = 0; i < segs; i++) {
      const len = 40 + r() * 90;
      a += (r() - 0.5) * 2.2;
      const cx = x + Math.cos(a) * len * 0.6;
      const cy = y + Math.sin(a) * len * 0.6;
      a += (r() - 0.5) * 1.6;
      x = cx + Math.cos(a) * len * 0.6;
      y = cy + Math.sin(a) * len * 0.6;
      d += ` Q${f(cx)},${f(cy)} ${f(x)},${f(y)}`;
    }
    s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(9 + r() * 12)}" stroke-linecap="round" opacity="${op}"/>`;
  }
  return s;
}

// una flama: base (x, yBase), alto h, ancho w, inclinación
function flame(x, yb, h, w, lean, fill, stroke, sw) {
  const t = [x + lean * h, yb - h];
  const d = `M${f(x - w / 2)},${f(yb)} C${f(x - w * 0.9)},${f(yb - h * 0.45)} ${f(x + lean * h * 0.3 - w * 0.9)},${f(yb - h * 0.55)} ${f(t[0])},${f(t[1])} C${f(x + lean * h * 0.2 + w * 0.2)},${f(yb - h * 0.6)} ${f(x + w * 0.9)},${f(yb - h * 0.4)} ${f(x + w / 2)},${f(yb)} Z`;
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}

P['sc1-flames'] = (W, H, C, part, r) => {
  const dark = mix(C.a, '#000000', 0.45);
  let s = `<defs>${lin('fg', 0, 0, 0, 1, [[0, dark], [0.55, C.a], [1, mix(C.a, C.c, 0.18)]])}${lin('ff', 0, 1, 0, 0, [[0, C.c, 0.55], [1, C.c, 0]])}</defs><rect width="${W}" height="${H}" fill="url(#fg)"/>`;
  s += swirls(W, H, C.b, r, part === 'sleeve' ? 90 : 260, 0.85);
  if (part === 'sleeve') {
    // flamas pequeñas en contorno cerca del puño
    for (let i = 0; i < 9; i++) {
      const x = W * (0.05 + i * 0.11);
      s += flame(x, H * 1.02, H * (0.22 + r() * 0.12), W * 0.05, (r() - 0.5) * 0.3, 'none', mix(C.c, '#ffffff', 0.3), 3);
    }
    return s;
  }
  const n = 7;
  let fl = '';
  for (let i = 0; i < n; i++) {
    const x = W * (0.04 + (i / (n - 1)) * 0.92) + (r() - 0.5) * 30;
    const h = H * (0.35 + r() * 0.3) * (1 - Math.abs(i / (n - 1) - 0.5) * 0.4);
    const w = W * (0.12 + r() * 0.06);
    const lean = (r() - 0.5) * 0.5;
    fl += flame(x, H * 1.02, h, w, lean, 'url(#ff)', mix(C.c, '#ffffff', 0.35), 5);
    fl += flame(x - w * 0.15, H * 1.02, h * 0.82, w * 0.7, lean * 1.1, 'none', mix(C.c, '#ffffff', 0.15), 3);
    fl += flame(x + lean * 20, H * 1.02, h * 0.6, w * 0.45, lean * 1.2, 'none', C.c, 3);
  }
  return s + `<g opacity="0.95">${fl}</g>` + shade(W, H, part);
};

// camuflaje digital con malla hexagonal (Jersey boy azul)
function hexMesh(W, H, col, op, R = 11) {
  const dx = R * Math.sqrt(3);
  const dy = R * 1.5;
  let d = '';
  for (let row = 0; row * dy < H + R; row++)
    for (let c = 0; c * dx < W + dx; c++) {
      const cx = c * dx + (row % 2 ? dx / 2 : 0);
      const cy = row * dy;
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        d += `${k ? 'L' : 'M'}${f(cx + Math.cos(a) * R * 0.85)},${f(cy + Math.sin(a) * R * 0.85)}`;
      }
      d += 'Z';
    }
  return `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" opacity="${op}"/>`;
}
function camoBlobs(W, H, cols, r, n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const cx = r() * W;
    const cy = r() * H;
    const R = 30 + r() * 70;
    const m = 8;
    const p = [];
    for (let k = 0; k < m; k++) {
      const a = (k / m) * Math.PI * 2;
      const rr = R * (0.5 + r() * 0.7);
      p.push([cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr]);
    }
    let d = `M${f((p[0][0] + p[m - 1][0]) / 2)},${f((p[0][1] + p[m - 1][1]) / 2)}`;
    for (let k = 0; k < m; k++) {
      const q = p[(k + 1) % m];
      d += ` Q${f(p[k][0])},${f(p[k][1])} ${f((p[k][0] + q[0]) / 2)},${f((p[k][1] + q[1]) / 2)}`;
    }
    s += `<path d="${d}Z" fill="${cols[i % cols.length]}"/>`;
  }
  return s;
}

P['sc1-blade'] = (W, H, C, part, r) => {
  let s = bg(W, H, C.a) + camoBlobs(W, H, [C.b, mix(C.a, C.b, 0.5), mix(C.a, '#000000', 0.3)], r, part === 'sleeve' ? 30 : 70) + hexMesh(W, H, '#000000', 0.35);
  const white = C.c;
  if (part === 'sleeve') {
    s += `<path d="M0,${f(H * 0.55)} C${f(W * 0.3)},${f(H * 0.4)} ${f(W * 0.7)},${f(H * 0.7)} ${W},${f(H * 0.5)} L${W},${H} L0,${H} Z" fill="${white}"/>`;
    s += `<path d="M${f(W * 0.15)},${f(H * 0.72)} Q${f(W * 0.3)},${f(H * 0.6)} ${f(W * 0.45)},${f(H * 0.8)}" stroke="${C.a}" stroke-width="18" fill="none" stroke-linecap="round"/>`;
    return s;
  }
  // paneles blancos laterales con filo curvo (tipo aleta)
  const side = (m) => {
    const X = (x) => (m ? W - x : x);
    return `<path d="M${X(0)},${f(H * 0.02)} C${X(W * 0.22)},${f(H * 0.12)} ${X(W * 0.36)},${f(H * 0.3)} ${X(W * 0.3)},${f(H * 0.5)} C${X(W * 0.24)},${f(H * 0.66)} ${X(W * 0.3)},${f(H * 0.84)} ${X(W * 0.4)},${H} L${X(0)},${H} Z" fill="${white}"/>`;
  };
  s += side(false) + side(true);
  // espinas azules dentro del blanco
  const spike = (m, y, len, w) => {
    const X = (x) => (m ? W - x : x);
    return `<path d="M${X(W * 0.02)},${f(y)} Q${X(W * 0.02 + len * 0.6)},${f(y - w)} ${X(W * 0.02 + len)},${f(y + w * 0.4)} Q${X(W * 0.02 + len * 0.5)},${f(y + w * 0.3)} ${X(W * 0.02)},${f(y + w)} Z" fill="${C.a}"/>`;
  };
  for (const m of [false, true]) {
    s += spike(m, H * 0.62, W * 0.2, 26) + spike(m, H * 0.78, W * 0.26, 30) + spike(m, H * 0.92, W * 0.3, 34);
  }
  // hombros: franja blanca curva hacia el cuello
  s += `<path d="M0,${f(H * 0.16)} Q${f(W * 0.2)},${f(H * 0.05)} ${f(W * 0.34)},0" stroke="${white}" stroke-width="16" fill="none"/><path d="M${W},${f(H * 0.16)} Q${f(W * 0.8)},${f(H * 0.05)} ${f(W * 0.66)},0" stroke="${white}" stroke-width="16" fill="none"/>`;
  return s + shade(W, H, part);
};

// trazos diagonales rojo/negro (Jersey boy rojo)
P['sc1-strike'] = (W, H, C, part, r) => {
  const blk = C.b;
  let s = bg(W, H, C.a);
  const n = part === 'sleeve' ? 30 : 90;
  const ang = -1.05;
  for (let i = 0; i < n; i++) {
    const cx = r() * W * 1.2 - W * 0.1;
    const cy = r() * H * 1.2 - H * 0.1;
    const len = 80 + r() * 260;
    const w = 6 + r() * 26;
    const dx = Math.cos(ang) * len / 2;
    const dy = Math.sin(ang) * len / 2;
    const nx = -Math.sin(ang) * w / 2;
    const ny = Math.cos(ang) * w / 2;
    const tip = 0.35 + r() * 0.4; // extremos en punta (brochazo)
    s += poly([[cx - dx, cy - dy], [cx - dx * tip + nx, cy - dy * tip + ny], [cx + dx + nx * 0.3, cy + dy + ny * 0.3], [cx + dx * tip - nx, cy + dy * tip - ny]], blk, `opacity="${f(0.55 + r() * 0.45)}"`);
  }
  if (part === 'sleeve') {
    return bg(W, H, blk) + `<g opacity="0.35">${s}</g>` + `<rect y="${f(H * 0.9)}" width="${W}" height="10" fill="${C.c}"/>`;
  }
  // costados negros
  s += `<defs>${lin('sk', 0, 0, 1, 0, [[0, blk, 1], [0.16, blk, 0.9], [0.24, blk, 0], [0.76, blk, 0], [0.84, blk, 0.9], [1, blk, 1]])}</defs><rect width="${W}" height="${H}" fill="url(#sk)"/>`;
  // arco blanco en el pecho y parte baja negra con filo blanco
  const arcY = part === 'back' ? H * 0.34 : H * 0.42;
  s += `<path d="M0,${f(arcY)} Q${f(W / 2)},${f(arcY + H * 0.14)} ${W},${f(arcY)}" stroke="${C.c}" stroke-width="16" fill="none"/>`;
  if (part === 'back') s += `<path d="M0,0 L${W},0 L${W},${f(arcY)} Q${f(W / 2)},${f(arcY + H * 0.14)} 0,${f(arcY)} Z" fill="${blk}" opacity="0.35"/>`;
  s += `<path d="M0,${f(H * 0.86)} Q${f(W / 2)},${f(H * 0.7)} ${W},${f(H * 0.86)} L${W},${H} L0,${H} Z" fill="${blk}"/><path d="M0,${f(H * 0.86)} Q${f(W / 2)},${f(H * 0.7)} ${W},${f(H * 0.86)}" stroke="${C.c}" stroke-width="8" fill="none"/>`;
  return s + shade(W, H, part);
};

// SC1 Vortex: negro técnico con paneles angulares y filos de acento (estilo pro esports)
P['sc1-vortex'] = (W, H, C, part, r) => {
  const steel = C.b;
  const acc = C.c;
  let s = bg(W, H, C.a);
  // bandas diagonales sutiles
  for (let i = -4; i < 14; i++) {
    const x = i * W * 0.11;
    s += poly([[x, 0], [x + W * 0.05, 0], [x + W * 0.05 - H * 0.35, H], [x - H * 0.35, H]], steel, 'opacity="0.18"');
  }
  if (part === 'sleeve') {
    s += poly([[0, H * 0.58], [W, H * 0.42], [W, H * 0.8], [0, H * 0.94]], steel);
    s += `<path d="M0,${f(H * 0.58)} L${W},${f(H * 0.42)}" stroke="${acc}" stroke-width="7" fill="none"/>`;
    s += `<rect y="${f(H * 0.9)}" width="${W}" height="${f(H * 0.1)}" fill="${acc}"/>`;
    return s;
  }
  const back = part === 'back';
  // paneles laterales angulares con filo de acento
  const side = (m) => {
    const X = (x) => (m ? W - x : x);
    const P2 = [[X(0), H * 0.16], [X(W * 0.2), H * 0.24], [X(W * 0.27), H * 0.5], [X(W * 0.19), H * 0.66], [X(W * 0.32), H], [X(0), H]];
    const edge = P2.slice(0, 5).map(([x, y]) => `${f(x)},${f(y)}`).join(' L');
    return poly(P2, steel) + `<path d="M${edge}" stroke="${acc}" stroke-width="7" fill="none" stroke-linejoin="miter"/>`;
  };
  s += side(false) + side(true);
  // garras de acento abajo
  const claw = (m, x0, h) => {
    const X = (x) => (m ? W - x : x);
    return poly([[X(x0), H], [X(x0 + W * 0.05), H - h], [X(x0 + W * 0.075), H - h * 0.55], [X(x0 + W * 0.12), H - h * 0.95], [X(x0 + W * 0.1), H]], acc, 'opacity="0.9"');
  };
  for (const m of [false, true]) s += claw(m, W * 0.2, H * 0.2) + claw(m, W * 0.33, H * 0.12);
  // líneas de hombro que bajan en ángulo
  for (const m of [false, true]) {
    const X = (x) => (m ? W - x : x);
    s += `<path d="M${f(X(0))},${f(H * 0.09)} L${f(X(W * 0.22))},${f(H * 0.05)} L${f(X(W * 0.34))},${f(H * (back ? 0.02 : 0.1))}" stroke="${acc}" stroke-width="6" fill="none"/>`;
    // detalles tech en el pecho
    s += `<rect x="${f(X(W * 0.085) - (m ? W * 0.07 : 0))}" y="${f(H * 0.3)}" width="${f(W * 0.07)}" height="5" fill="${acc}" opacity="0.8"/>`;
    s += `<rect x="${f(X(W * 0.085) - (m ? W * 0.045 : 0))}" y="${f(H * 0.315)}" width="${f(W * 0.045)}" height="5" fill="${acc}" opacity="0.5"/>`;
  }
  if (back) s += poly([[W * 0.36, 0], [W * 0.64, 0], [W * 0.5, H * 0.06]], steel);
  return s + shade(W, H, part);
};

// ---------- catálogo ----------
export const PATTERNS = [
  // SC1 Originales (catálogo SC1)
  { id: 'sc1-vortex', name: 'SC1 Vortex', family: 'SC1', colors: ['#07080c', '#1b2230', '#2f6bff'], collar: 'c' },
  { id: 'sc1-blade', name: 'SC1 Blade', family: 'SC1', colors: ['#0b1a4a', '#1e3a9e', '#f4f5f8'], collar: 'c' },
  { id: 'sc1-strike', name: 'SC1 Strike', family: 'SC1', colors: ['#b3121d', '#12090a', '#f4f5f8'], collar: 'c' },
  { id: 'sc1-flames', name: 'SC1 Flames', family: 'SC1', colors: ['#3d1470', '#200a3d', '#c77dff'], collar: 'blanco' },
  // Neón
  { id: 'neon-rush', name: 'Neon Rush', family: 'Neón', colors: ['#07090f', '#1f3fbf', '#35e0ff'] },
  { id: 'circuit', name: 'Circuit', family: 'Neón', colors: ['#06080d', '#12235e', '#2ee6a6'] },
  { id: 'pulse', name: 'Pulse', family: 'Neón', colors: ['#0b0d12', '#3a1a6b', '#ff3da6'] },
  { id: 'laser-grid', name: 'Laser Grid', family: 'Neón', colors: ['#05060a', '#3a1a6b', '#35e0ff'] },
  { id: 'neon-slash', name: 'Neon Slash', family: 'Neón', colors: ['#0b0d12', '#ff3da6', '#35e0ff'] },
  { id: 'plasma', name: 'Plasma', family: 'Neón', colors: ['#07090f', '#6d28d9', '#2f6bff'] },
  // Glitch
  { id: 'glitch-split', name: 'Glitch Split', family: 'Glitch', colors: ['#0b0d12', '#1f3fbf', '#e8ecf5'] },
  { id: 'static', name: 'Static', family: 'Glitch', colors: ['#0b0d12', '#1f3fbf', '#d9a92b'] },
  { id: 'scanline', name: 'Scanline', family: 'Glitch', colors: ['#10131a', '#e8ecf5', '#d9a92b'] },
  { id: 'data-rain', name: 'Data Rain', family: 'Glitch', colors: ['#040805', '#14532d', '#2ee6a6'] },
  { id: 'hud', name: 'HUD', family: 'Glitch', colors: ['#0b0d12', '#1f3fbf', '#35e0ff'] },
  { id: 'halftone', name: 'Halftone', family: 'Glitch', colors: ['#f4f5f8', '#1f3fbf', '#d9a92b'] },
  // Retro
  { id: '8-bit', name: '8-Bit', family: 'Retro', colors: ['#0b0d12', '#1f3fbf', '#d9a92b'] },
  { id: 'arcade', name: 'Arcade', family: 'Retro', colors: ['#1a0b3b', '#ff3d6e', '#ffc93c'] },
  { id: 'pixel-camo', name: 'Pixel Camo', family: 'Retro', colors: ['#1e2a1f', '#56663f', '#d9a92b'] },
  { id: 'pixel-fade', name: 'Pixel Fade', family: 'Retro', colors: ['#0b0d12', '#e11d2e', '#ffd60a'] },
  { id: 'synthwave', name: 'Synthwave', family: 'Retro', colors: ['#12072b', '#ff3da6', '#ffc93c'] },
  { id: 'checker-race', name: 'Checker', family: 'Retro', colors: ['#0b0d12', '#f4f5f8', '#e11d2e'] },
  // Pro
  { id: 'apex', name: 'Apex', family: 'Pro', colors: ['#f2f3f7', '#1f3fbf', '#d9a92b'] },
  { id: 'sash', name: 'Sash', family: 'Pro', colors: ['#0b0d12', '#d9a92b', '#f4f5f8'] },
  { id: 'split-half', name: 'Split', family: 'Pro', colors: ['#0b0d12', '#1f3fbf', '#d9a92b'] },
  { id: 'yoke', name: 'Yoke', family: 'Pro', colors: ['#f4f5f8', '#0f1b4d', '#e11d2e'] },
  { id: 'pinstripe', name: 'Pinstripe', family: 'Pro', colors: ['#0f1b4d', '#1f3fbf', '#d9a92b'] },
  { id: 'hoops', name: 'Hoops', family: 'Pro', colors: ['#0b0d12', '#7a1030', '#d9a92b'] },
  { id: 'side-panels', name: 'Side Panels', family: 'Pro', colors: ['#f4f5f8', '#1f3fbf', '#0b0d12'] },
  { id: 'center-stripe', name: 'Center Stripe', family: 'Pro', colors: ['#0b0d12', '#e11d2e', '#f4f5f8'] },
  // Salvaje
  { id: 'tiger', name: 'Tiger', family: 'Salvaje', colors: ['#ff7a1a', '#0b0d12', '#f4f5f8'] },
  { id: 'claw', name: 'Claw', family: 'Salvaje', colors: ['#0b0d12', '#7a1030', '#e11d2e'] },
  { id: 'flames', name: 'Flames', family: 'Salvaje', colors: ['#0b0d12', '#e11d2e', '#ffd60a'] },
  { id: 'lightning', name: 'Lightning', family: 'Salvaje', colors: ['#07090f', '#1f3fbf', '#ffd60a'] },
  { id: 'splatter', name: 'Splatter', family: 'Salvaje', colors: ['#f4f5f8', '#0b0d12', '#e11d2e'] },
  { id: 'brush', name: 'Brush', family: 'Salvaje', colors: ['#0b0d12', '#2f6bff', '#f4f5f8'] },
  { id: 'camo', name: 'Camo', family: 'Salvaje', colors: ['#2a2f3a', '#6b7280', '#d9a92b'] },
  // Geométrico
  { id: 'hex', name: 'Hex', family: 'Geométrico', colors: ['#0b0d12', '#1f3fbf', '#35e0ff'] },
  { id: 'shard', name: 'Shard', family: 'Geométrico', colors: ['#0b0d12', '#6b7280', '#d9a92b'] },
  { id: 'low-poly', name: 'Low Poly', family: 'Geométrico', colors: ['#0b0d12', '#1f3fbf', '#35e0ff'] },
  { id: 'topo', name: 'Topo', family: 'Geométrico', colors: ['#0b0d12', '#2a2f3a', '#d9a92b'] },
  { id: 'zigzag', name: 'Zigzag', family: 'Geométrico', colors: ['#f4f5f8', '#0b0d12', '#e11d2e'] },
  { id: 'scales', name: 'Scales', family: 'Geométrico', colors: ['#0b0d12', '#14b8a6', '#d9a92b'] },
  { id: 'waves', name: 'Waves', family: 'Geométrico', colors: ['#0f1b4d', '#2f6bff', '#35e0ff'] },
];

const SEEDS = { front: 11, back: 23, sleeveR: 37, sleeveL: 37, sleeve: 37 };

// SVG completo de una pieza
export function patternSVG(id, W, H, C, part, seedKey) {
  const fn = P[id] || P['neon-rush'];
  const inner = fn(W, H, C, part, rng(SEEDS[seedKey || part] || 1));
  const blurs = [4, 5, 6, 8, 10, 12, 14, 16, 18]
    .map((b) => `<filter id="blur${b}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${b}"/></filter>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${blurs}</defs>${inner}</svg>`;
}

// Carga un SVG como imagen para dibujarlo en canvas (con caché)
const cache = new Map();
export function patternImage(id, W, H, C, part, seedKey) {
  const key = [id, Math.round(W), Math.round(H), C.a, C.b, C.c, part, seedKey].join('|');
  if (cache.has(key)) return cache.get(key);
  const svg = patternSVG(id, Math.round(W), Math.round(H), C, part, seedKey);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  cache.set(key, p);
  if (cache.size > 120) cache.delete(cache.keys().next().value);
  return p;
}
