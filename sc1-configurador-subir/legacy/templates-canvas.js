// 12 plantillas originales estilo gamer. Cada una se dibuja por pieza (frente, espalda, manga)
// con 3 colores editables: a = principal, b = secundario, c = acento.

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexRgb(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(h, a) {
  const [r, g, b] = hexRgb(h);
  return `rgba(${r},${g},${b},${a})`;
}

export function mix(h1, h2, t) {
  const a = hexRgb(h1);
  const b = hexRgb(h2);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

function fill(ctx, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

function vignette(ctx, w, h, C, part) {
  // sombreado lateral suave, da volumen al imprimir
  if (part === 'sleeve') return;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.22)');
  g.addColorStop(0.18, 'rgba(0,0,0,0)');
  g.addColorStop(0.82, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const T = {};

T['neon-rush'] = (ctx, w, h, C, r, part) => {
  fill(ctx, w, h, C.a);
  const n = part === 'sleeve' ? 3 : 4;
  const slope = part === 'sleeve' ? 0.5 : 0.9;
  for (let i = 0; i < n; i++) {
    const x0 = w * (-0.25 + i * 0.32) + (part === 'back' ? 90 : 0);
    const bw = [150, 60, 110, 40][i % 4];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, h);
    ctx.lineTo(x0 + bw, h);
    ctx.lineTo(x0 + bw + h * slope, 0);
    ctx.lineTo(x0 + h * slope, 0);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? rgba(C.b, 0.55) : C.b;
    ctx.fill();
    glow(ctx, C.c, 28);
    ctx.strokeStyle = C.c;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x0 + bw, h);
    ctx.lineTo(x0 + bw + h * slope, 0);
    ctx.stroke();
    ctx.restore();
  }
  vignette(ctx, w, h, C, part);
};

T['circuit'] = (ctx, w, h, C, r, part) => {
  fill(ctx, w, h, C.a);
  const g = ctx.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, rgba(C.b, 0.9));
  g.addColorStop(0.7, rgba(C.b, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const traces = part === 'sleeve' ? 10 : 26;
  const step = 38;
  for (let k = 0; k < traces; k++) {
    let x = Math.round((r() * w) / step) * step;
    let y = part === 'sleeve' ? h : h - r() * h * 0.35;
    const len = 6 + Math.floor(r() * 14);
    ctx.save();
    glow(ctx, C.c, 16);
    ctx.strokeStyle = k % 3 === 0 ? rgba(C.c, 0.45) : C.c;
    ctx.lineWidth = k % 3 === 0 ? 4 : 6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    let dir = 0;
    for (let s = 0; s < len; s++) {
      const turn = r();
      if (turn < 0.25) dir = -1;
      else if (turn < 0.5) dir = 1;
      else if (turn < 0.8) dir = 0;
      x += dir * step;
      y -= step;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = C.a;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  vignette(ctx, w, h, C, part);
};

T['pulse'] = (ctx, w, h, C, r, part) => {
  fill(ctx, w, h, C.a);
  const cy = part === 'sleeve' ? h * 0.55 : part === 'back' ? h * 0.78 : h * 0.62;
  const bandH = part === 'sleeve' ? h * 0.5 : h * 0.3;
  const g = ctx.createLinearGradient(0, cy - bandH / 2, 0, cy + bandH / 2);
  g.addColorStop(0, rgba(C.b, 0));
  g.addColorStop(0.5, rgba(C.b, 0.95));
  g.addColorStop(1, rgba(C.b, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, cy - bandH / 2, w, bandH);
  const bars = part === 'sleeve' ? 40 : 64;
  const bw = w / bars;
  ctx.save();
  glow(ctx, C.c, 18);
  ctx.fillStyle = C.c;
  for (let i = 0; i < bars; i++) {
    const env = Math.sin((i / bars) * Math.PI) ** 0.6;
    const amp = (0.15 + r() * 0.85) * env * bandH * 0.42;
    ctx.fillRect(i * bw + bw * 0.22, cy - amp, bw * 0.56, amp * 2);
  }
  ctx.restore();
  ctx.fillStyle = rgba(C.c, 0.7);
  ctx.fillRect(0, cy - 2, w, 4);
  vignette(ctx, w, h, C, part);
};

T['glitch-split'] = (ctx, w, h, C, r, part) => {
  fill(ctx, w, h, C.a);
  const slices = part === 'sleeve' ? 7 : 16;
  for (let i = 0; i < slices; i++) {
    const y = r() * h;
    const sh = 12 + r() * (part === 'sleeve' ? 50 : 90);
    const x = r() * w * 0.6 - w * 0.1;
    const sw = w * (0.25 + r() * 0.7);
    ctx.fillStyle = C.b;
    ctx.fillRect(x, y, sw, sh);
    ctx.fillStyle = rgba(C.c, 0.85);
    ctx.fillRect(x + 14 + r() * 30, y + sh * 0.2, sw * (0.3 + r() * 0.5), Math.max(4, sh * 0.18));
  }
  // bloques de píxel
  for (let i = 0; i < (part === 'sleeve' ? 20 : 60); i++) {
    const s = 10 + r() * 26;
    ctx.fillStyle = r() < 0.5 ? rgba(C.c, 0.9) : rgba(C.b, 0.9);
    ctx.fillRect(r() * w, r() * h, s, s);
  }
  vignette(ctx, w, h, C, part);
};

T['static'] = (ctx, w, h, C, r, part) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, C.a);
  g.addColorStop(0.45, C.a);
  g.addColorStop(1, C.b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const n = part === 'sleeve' ? 2200 : 7000;
  for (let i = 0; i < n; i++) {
    const y = h * Math.pow(r(), 0.55);
    const s = 2 + r() * 5;
    const t = y / h;
    ctx.fillStyle = r() < 0.35 ? rgba(C.c, 0.25 + 0.6 * t) : `rgba(255,255,255,${0.05 + 0.25 * t})`;
    ctx.fillRect(r() * w, y, s * (1 + r() * 3), s);
  }
  vignette(ctx, w, h, C, part);
};

T['scanline'] = (ctx, w, h, C, r, part) => {
  fill(ctx, w, h, C.a);
  const by = part === 'sleeve' ? h * 0.55 : h * 0.58;
  const bh = part === 'sleeve' ? h * 0.26 : h * 0.14;
  ctx.fillStyle = C.b;
  ctx.fillRect(0, by - bh * 1.35, w, bh * 0.35);
  ctx.save();
  glow(ctx, C.c, 24);
  ctx.fillStyle = C.c;
  ctx.fillRect(0, by, w, bh);
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = 0; y < h; y += 9) ctx.fillRect(0, y, w, 3);
  vignette(ctx, w, h, C, part);
};

T['8-bit'] = (ctx, w, h, C, r, part) => {
  fill(ctx, w, h, C.a);
  const s = part === 'sleeve' ? 32 : 40;
  for (let y = 0; y < h; y += s) {
    const p = part === 'sleeve' ? 0.55 * (1 - y / h) : Math.max(0, 0.9 - (y / h) * 1.35);
    for (let x = 0; x < w; x += s) {
      const q = r();
      if (q < p) {
        ctx.fillStyle = q < p * 0.12 ? C.c : q < p * 0.55 ? C.b : mix(C.a, C.b, 0.45);
        ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
      }
    }
  }
  vignette(ctx, w, h, C, part);
};

T['arcade'] = (ctx, w, h, C, r, part) => {
  const hz = part === 'sleeve' ? h * 0.35 : h * 0.62;
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, C.a);
  sky.addColorStop(1, mix(C.a, C.b, 0.35));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, hz);
  ctx.fillStyle = mix(C.a, '#000000', 0.35);
  ctx.fillRect(0, hz, w, h - hz);
  if (part !== 'sleeve') {
    const R = w * 0.3;
    const cx = w / 2;
    const cy = hz;
    const sg = ctx.createLinearGradient(0, cy - R, 0, cy);
    sg.addColorStop(0, C.c);
    sg.addColorStop(1, C.b);
    ctx.save();
    glow(ctx, C.c, 40);
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI, 0);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = mix(C.a, C.b, 0.35);
    for (let i = 0; i < 7; i++) {
      const y = cy - R * 0.08 - i * R * 0.13;
      ctx.fillRect(cx - R, y, R * 2, 4 + (6 - i) * 2.4);
    }
  }
  ctx.save();
  glow(ctx, C.c, 12);
  ctx.strokeStyle = rgba(C.c, 0.85);
  ctx.lineWidth = 3;
  for (let i = -12; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + i * 26, hz);
    ctx.lineTo(w / 2 + i * 150, h);
    ctx.stroke();
  }
  for (let k = 0; k < 9; k++) {
    const y = hz + (h - hz) * Math.pow(k / 8, 1.8);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
};

T['pixel-camo'] = (ctx, w, h, C, r, part) => {
  const s = 32;
  const cols = Math.ceil(w / s);
  const rows = Math.ceil(h / s);
  // ruido suavizado en rejilla gruesa
  const gw = Math.ceil(cols / 4) + 2;
  const gh = Math.ceil(rows / 4) + 2;
  const grid = Array.from({ length: gw * gh }, () => r());
  const at = (x, y) => grid[Math.min(gh - 1, y) * gw + Math.min(gw - 1, x)];
  const palette = [C.a, mix(C.a, C.b, 0.5), C.b, mix(C.b, '#000000', 0.35)];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const fx = x / 4;
      const fy = y / 4;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const v = (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
      const jitter = (r() - 0.5) * 0.12;
      const idx = Math.max(0, Math.min(3, Math.floor((v + jitter) * 4)));
      ctx.fillStyle = r() < 0.012 ? C.c : palette[idx];
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  vignette(ctx, w, h, C, part);
};

T['apex'] = (ctx, w, h, C, r, part) => {
  fill(ctx, w, h, C.a);
  if (part === 'sleeve') {
    ctx.fillStyle = C.b;
    ctx.fillRect(w * 0.36, 0, w * 0.28, h);
    ctx.fillStyle = C.c;
    ctx.fillRect(w * 0.33, 0, w * 0.02, h);
    ctx.fillRect(w * 0.65, 0, w * 0.02, h);
    return;
  }
  const tipY = part === 'back' ? h * 0.2 : h * 0.62;
  const draw = (off, color, width) => {
    ctx.beginPath();
    ctx.moveTo(-40, h * 0.02 + off);
    ctx.lineTo(w / 2, tipY + off);
    ctx.lineTo(w + 40, h * 0.02 + off);
    ctx.lineTo(w + 40, h * 0.02 + off + width);
    ctx.lineTo(w / 2, tipY + off + width);
    ctx.lineTo(-40, h * 0.02 + off + width);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  if (part === 'back') {
    ctx.fillStyle = mix(C.a, '#000000', 0.25);
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    draw(h * 0.6, C.b, 60);
  } else {
    draw(0, C.b, 150);
    draw(170, C.c, 18);
  }
  const side = ctx.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, rgba(C.b, 0.7));
  side.addColorStop(0.12, rgba(C.b, 0));
  side.addColorStop(0.88, rgba(C.b, 0));
  side.addColorStop(1, rgba(C.b, 0.7));
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, w, h);
};

T['shard'] = (ctx, w, h, C, r, part) => {
  fill(ctx, w, h, C.a);
  const n = part === 'sleeve' ? 18 : 46;
  for (let i = 0; i < n; i++) {
    // concentrar fragmentos en la diagonal inferior
    const t = r();
    const cx = w * (0.1 + t * 0.9) + (r() - 0.5) * 220;
    const cy = h * (1 - t * 0.85) + (r() - 0.5) * 200;
    const s = 60 + r() * 180;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = r() * Math.PI * 2;
      const rr = s * (0.5 + r() * 0.6);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const q = r();
    ctx.fillStyle = q < 0.18 ? rgba(C.c, 0.85) : rgba(C.b, 0.35 + r() * 0.5);
    ctx.fill();
    if (q < 0.3) {
      ctx.strokeStyle = rgba(C.c, 0.8);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  vignette(ctx, w, h, C, part);
};

T['hex'] = (ctx, w, h, C, r, part) => {
  fill(ctx, w, h, C.a);
  const R = 34;
  const dx = R * Math.sqrt(3);
  const dy = R * 1.5;
  for (let row = -1; row * dy < h + R; row++) {
    for (let col = -1; col * dx < w + dx; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0);
      const cy = row * dy;
      // más fuerte en los costados
      const edge = part === 'sleeve' ? cy / h : Math.abs(cx / w - 0.5) * 2;
      const p = Math.pow(edge, 1.6);
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const px = cx + Math.cos(a) * (R - 3);
        const py = cy + Math.sin(a) * (R - 3);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (r() < p * 0.95) {
        ctx.fillStyle = r() < 0.08 ? C.c : rgba(C.b, 0.4 + 0.6 * p);
        ctx.fill();
      }
      ctx.strokeStyle = rgba(C.c, 0.08 + 0.3 * p);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  vignette(ctx, w, h, C, part);
};

export const TEMPLATES = [
  { id: 'neon-rush', name: 'Neon Rush', family: 'Neón', colors: ['#07090f', '#1f3fbf', '#35e0ff'] },
  { id: 'circuit', name: 'Circuit', family: 'Neón', colors: ['#06080d', '#12235e', '#2ee6a6'] },
  { id: 'pulse', name: 'Pulse', family: 'Neón', colors: ['#0b0d12', '#3a1a6b', '#ff3da6'] },
  { id: 'glitch-split', name: 'Glitch Split', family: 'Glitch', colors: ['#0b0d12', '#1f3fbf', '#e8ecf5'] },
  { id: 'static', name: 'Static', family: 'Glitch', colors: ['#0b0d12', '#1f3fbf', '#d9a92b'] },
  { id: 'scanline', name: 'Scanline', family: 'Glitch', colors: ['#10131a', '#e8ecf5', '#d9a92b'] },
  { id: '8-bit', name: '8-Bit', family: 'Retro pixel', colors: ['#0b0d12', '#1f3fbf', '#d9a92b'] },
  { id: 'arcade', name: 'Arcade', family: 'Retro pixel', colors: ['#1a0b3b', '#ff3d6e', '#ffc93c'] },
  { id: 'pixel-camo', name: 'Pixel Camo', family: 'Retro pixel', colors: ['#1e2a1f', '#56663f', '#d9a92b'] },
  { id: 'apex', name: 'Apex', family: 'Pro', colors: ['#f2f3f7', '#1f3fbf', '#d9a92b'] },
  { id: 'shard', name: 'Shard', family: 'Pro', colors: ['#0b0d12', '#6b7280', '#d9a92b'] },
  { id: 'hex', name: 'Hex', family: 'Pro', colors: ['#0b0d12', '#1f3fbf', '#35e0ff'] },
];

export function drawTemplate(ctx, id, w, h, C, part, seed) {
  const f = T[id] || T['neon-rush'];
  ctx.save();
  f(ctx, w, h, C, rng(seed), part);
  noGlow(ctx);
  ctx.restore();
}
