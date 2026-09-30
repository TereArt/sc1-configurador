// Geometría procedural del jersey (hombre / mujer) con mapa UV controlado.
//
// Distribución de la textura (lienzo 2048 x 2048, origen arriba a la izquierda):
//   Frente  : x 0–1024,    y 0–1000   (visto de frente, cuello arriba)
//   Espalda : x 1024–2048, y 0–1000   (visto de espalda, cuello arriba)
//   Manga derecha del lienzo (+x del modelo): x 0–1024,    y 1040–1440
//   Manga izquierda del lienzo (-x del modelo): x 1024–2048, y 1040–1440
// En cada manga: u=0 axila, u=0.5 parte de arriba del hombro; y=1040 hombro, y=1440 puño.

export const TEX = {
  size: 2048,
  torsoH: 1000,
  sleeveY0: 1040,
  sleeveY1: 1440,
};

export const CUTS = {
  hombre: {
    label: 'Hombre',
    shoulderY: 0.56,
    neckY: 0.665,
    frontDrop: 0.045,
    neckRX: 0.088,
    neckRZ: 0.078,
    // y, medio ancho, media profundidad
    body: [
      [0.0, 0.262, 0.14],
      [0.2, 0.266, 0.143],
      [0.4, 0.275, 0.148],
      [0.56, 0.272, 0.138],
    ],
    sleeve: { rootX: 0.2, rootY: 0.49, angle: 0.62, len: 0.25, r0: 0.105, r1: 0.083, depth: 0.95 },
  },
  mujer: {
    label: 'Mujer',
    shoulderY: 0.52,
    neckY: 0.62,
    frontDrop: 0.05,
    neckRX: 0.085,
    neckRZ: 0.074,
    body: [
      [0.0, 0.244, 0.132],
      [0.12, 0.228, 0.126],
      [0.2, 0.222, 0.124],
      [0.34, 0.24, 0.15],
      [0.42, 0.245, 0.148],
      [0.52, 0.24, 0.128],
    ],
    sleeve: { rootX: 0.178, rootY: 0.458, angle: 0.66, len: 0.21, r0: 0.094, r1: 0.074, depth: 0.95 },
  },
};

const SE_P = 2.5; // exponente de superelipse: sección entre elipse y rectángulo redondeado
const VS = 0.82; // fracción de la altura del lienzo que ocupa el cuerpo (el resto es hombro/pecho alto)

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function profileAt(cut, y) {
  const b = cut.body;
  if (y <= b[0][0]) return [b[0][1], b[0][2]];
  for (let i = 1; i < b.length; i++) {
    if (y <= b[i][0]) {
      const t = smooth((y - b[i - 1][0]) / (b[i][0] - b[i - 1][0]));
      return [lerp(b[i - 1][1], b[i][1], t), lerp(b[i - 1][2], b[i][2], t)];
    }
  }
  const l = b[b.length - 1];
  return [l[1], l[2]];
}

function se(theta, w, d) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const e = 2 / SE_P;
  return [w * Math.sign(c) * Math.pow(Math.abs(c), e), d * Math.sign(s) * Math.pow(Math.abs(s), e)];
}

// Punto del torso para el ángulo theta (0 = costado +x, PI/2 = frente) y altura v (0 = bastilla, 1 = cuello)
function torsoPoint(cut, theta, v) {
  if (v <= VS) {
    const y = cut.shoulderY * (v / VS);
    const [w, d] = profileAt(cut, y);
    const [x, z] = se(theta, w, d);
    // ligero volumen de pecho al frente
    const chest = Math.max(0, Math.sin(theta)) ** 3 * 0.012 * Math.sin(Math.PI * Math.min(1, y / cut.shoulderY));
    return [x, y, z + chest];
  }
  const t = (v - VS) / (1 - VS);
  const a = (t * Math.PI) / 2;
  const [w, d] = profileAt(cut, cut.shoulderY);
  const [bx, bz] = se(theta, w, d);
  const nx = cut.neckRX * Math.cos(theta);
  const nz = cut.neckRZ * Math.sin(theta);
  const neckY = cut.neckY - cut.frontDrop * Math.max(0, Math.sin(theta)) ** 2;
  const hx = 1 - Math.cos(a);
  const hy = 0.55 * Math.sin(a) + 0.45 * hx;
  return [lerp(bx, nx, hx), cut.shoulderY + (neckY - cut.shoulderY) * hy, lerp(bz, nz, hx)];
}

function dist(p, q) {
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// Reparametriza una mitad del contorno por longitud de arco, para que la textura no se estire en los costados
function arcThetas(cut, v, th0, th1, n) {
  const M = 360;
  const pts = [];
  const len = [0];
  for (let i = 0; i <= M; i++) {
    const th = lerp(th0, th1, i / M);
    pts.push(torsoPoint(cut, th, v));
    if (i > 0) len.push(len[i - 1] + dist(pts[i], pts[i - 1]));
  }
  const total = len[M];
  const out = [];
  let k = 0;
  for (let j = 0; j <= n; j++) {
    const target = (total * j) / n;
    while (k < M - 1 && len[k + 1] < target) k++;
    const seg = len[k + 1] - len[k] || 1;
    const f = (target - len[k]) / seg;
    out.push(lerp(lerp(th0, th1, k / M), lerp(th0, th1, (k + 1) / M), f));
  }
  return out;
}

function makeMesh() {
  return { pos: [], uv: [], idx: [] };
}

function buildTorso(cut) {
  const m = makeMesh();
  const NH = 64; // segmentos por mitad
  const NV = 90;
  const cols = NH * 2 + 1;
  for (let j = 0; j <= NV; j++) {
    const v = j / NV;
    // frente: theta de PI (costado -x) a 0 (costado +x). espalda: de 0 a -PI.
    const front = arcThetas(cut, v, Math.PI, 0, NH);
    const back = arcThetas(cut, v, 0, -Math.PI, NH);
    const thetas = front.concat(back.slice(1));
    const V = 1 - (TEX.torsoH / TEX.size) * (1 - v);
    for (let i = 0; i < cols; i++) {
      const p = torsoPoint(cut, thetas[i], v);
      m.pos.push(p[0], p[1], p[2]);
      m.uv.push(i / (cols - 1), V);
    }
  }
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      m.idx.push(a, c, b, b, c, d);
    }
  }
  return m;
}

function sleeveFrame(cut, side) {
  const s = cut.sleeve;
  const d = [side * Math.cos(s.angle), -Math.sin(s.angle), 0];
  const n1 = [0, 0, side]; // side -1 invierte para conservar la orientación (manga espejo)
  const n2 = [d[1] * n1[2] - d[2] * n1[1], d[2] * n1[0] - d[0] * n1[2], d[0] * n1[1] - d[1] * n1[0]];
  const root = [side * s.rootX, s.rootY, 0];
  return { d, n1, n2, root };
}

function sleeveRing(cut, side, t, phi) {
  const s = cut.sleeve;
  const { d, n1, n2, root } = sleeveFrame(cut, side);
  const c = [root[0] + d[0] * s.len * t, root[1] + d[1] * s.len * t, root[2]];
  // la raíz se ensancha para meterse en el torso; el puño se cierra un poco
  const r = lerp(s.r0, s.r1, smooth(t)) * (1 + 0.12 * Math.pow(1 - t, 3));
  const rz = r * s.depth;
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  // aplanar un poco la parte de arriba del hombro
  const top = Math.max(0, -cp);
  const rr = r * (1 - 0.06 * top);
  return [c[0] + n2[0] * cp * rr + n1[0] * sp * rz, c[1] + n2[1] * cp * rr + n1[1] * sp * rz, c[2] + n2[2] * cp * rr + n1[2] * sp * rz];
}

function buildSleeve(cut, side) {
  const m = makeMesh();
  const NU = 72;
  const NV = 28;
  const x0 = side > 0 ? 0 : 0.5;
  const V0 = 1 - TEX.sleeveY0 / TEX.size;
  const V1 = 1 - TEX.sleeveY1 / TEX.size;
  // la raíz empieza un poco hacia dentro del torso
  const tStart = -0.18;
  for (let j = 0; j <= NV; j++) {
    const t = lerp(tStart, 1, j / NV);
    const tc = Math.max(0, t);
    for (let i = 0; i <= NU; i++) {
      const phi = (i / NU) * Math.PI * 2;
      const p = sleeveRing(cut, side, t, phi);
      m.pos.push(p[0], p[1], p[2]);
      m.uv.push(x0 + (i / NU) * 0.5, lerp(V0, V1, tc));
    }
  }
  const cols = NU + 1;
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      m.idx.push(a, c, b, b, c, d);
    }
  }
  return m;
}

// Tubo delgado que sigue una curva cerrada (cuello, puños, bastilla)
function buildRib(points, radius, radial = 10) {
  const m = makeMesh();
  const n = points.length;
  for (let i = 0; i <= n; i++) {
    const p = points[i % n];
    const pn = points[(i + 1) % n];
    const pp = points[(i - 1 + n) % n];
    let t = [pn[0] - pp[0], pn[1] - pp[1], pn[2] - pp[2]];
    const tl = Math.hypot(...t) || 1;
    t = t.map((x) => x / tl);
    // normal hacia afuera aproximada desde el centroide del anillo
    let up = [0, 1, 0];
    if (Math.abs(t[1]) > 0.9) up = [1, 0, 0];
    let b = [t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]];
    const bl = Math.hypot(...b) || 1;
    b = b.map((x) => x / bl);
    const nn = [b[1] * t[2] - b[2] * t[1], b[2] * t[0] - b[0] * t[2], b[0] * t[1] - b[1] * t[0]];
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const ca = Math.cos(a) * radius;
      const sa = Math.sin(a) * radius;
      m.pos.push(p[0] + nn[0] * ca + b[0] * sa, p[1] + nn[1] * ca + b[1] * sa, p[2] + nn[2] * ca + b[2] * sa);
      m.uv.push(i / n, k / radial);
    }
  }
  const cols = radial + 1;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * cols + k;
      const b2 = a + 1;
      const c = a + cols;
      const d = c + 1;
      m.idx.push(a, c, b2, b2, c, d);
    }
  }
  return m;
}

// Normales suaves soldando vértices que comparten posición (evita la costura visible)
function finalize(m, outwardCenterFn) {
  const pos = new Float32Array(m.pos);
  const idx = new Uint32Array(m.idx);
  const nrm = new Float32Array(pos.length);
  const key = (i) => `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`;
  const groups = new Map();
  const vcount = pos.length / 3;
  const gid = new Int32Array(vcount);
  for (let i = 0; i < vcount; i++) {
    const k = key(i);
    if (!groups.has(k)) groups.set(k, groups.size);
    gid[i] = groups.get(k);
  }
  const acc = new Float32Array(groups.size * 3);
  for (let f = 0; f < idx.length; f += 3) {
    const a = idx[f] * 3;
    const b = idx[f + 1] * 3;
    const c = idx[f + 2] * 3;
    const ux = pos[b] - pos[a];
    const uy = pos[b + 1] - pos[a + 1];
    const uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a];
    const vy = pos[c + 1] - pos[a + 1];
    const vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const v of [idx[f], idx[f + 1], idx[f + 2]]) {
      const g = gid[v] * 3;
      acc[g] += nx;
      acc[g + 1] += ny;
      acc[g + 2] += nz;
    }
  }
  for (let i = 0; i < vcount; i++) {
    const g = gid[i] * 3;
    const l = Math.hypot(acc[g], acc[g + 1], acc[g + 2]) || 1;
    nrm[i * 3] = acc[g] / l;
    nrm[i * 3 + 1] = acc[g + 1] / l;
    nrm[i * 3 + 2] = acc[g + 2] / l;
  }
  // orientar: las normales deben apuntar hacia afuera
  if (outwardCenterFn) {
    let score = 0;
    for (let i = 0; i < vcount; i += 7) {
      const c = outwardCenterFn(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      score += (pos[i * 3] - c[0]) * nrm[i * 3] + (pos[i * 3 + 1] - c[1]) * nrm[i * 3 + 1] + (pos[i * 3 + 2] - c[2]) * nrm[i * 3 + 2];
    }
    if (score < 0) {
      for (let f = 0; f < idx.length; f += 3) {
        const t = idx[f + 1];
        idx[f + 1] = idx[f + 2];
        idx[f + 2] = t;
      }
      for (let i = 0; i < nrm.length; i++) nrm[i] = -nrm[i];
    }
  }
  return { pos, nrm, uv: new Float32Array(m.uv), idx };
}

export function buildJersey(cutId) {
  const cut = CUTS[cutId];
  const torso = finalize(buildTorso(cut), (x, y) => [0, y, 0]);
  const sleeves = [1, -1].map((side) => {
    const f = sleeveFrame(cut, side);
    return finalize(buildSleeve(cut, side), (x, y, z) => {
      // proyectar al eje de la manga
      const px = x - f.root[0];
      const py = y - f.root[1];
      const t = px * f.d[0] + py * f.d[1];
      return [f.root[0] + f.d[0] * t, f.root[1] + f.d[1] * t, 0];
    });
  });

  // Cuello: sigue el borde superior del torso
  const neckPts = [];
  for (let i = 0; i < 96; i++) {
    const th = (i / 96) * Math.PI * 2;
    const p = torsoPoint(cut, th, 1);
    neckPts.push([p[0] * 1.02, p[1] + 0.004, p[2] * 1.02]);
  }
  const collar = finalize(buildRib(neckPts, 0.011), (x, y) => [0, y, 0]);

  // Puños
  const cuffs = [1, -1].map((side) => {
    const pts = [];
    for (let i = 0; i < 72; i++) pts.push(sleeveRing(cut, side, 1, (i / 72) * Math.PI * 2));
    return finalize(buildRib(pts, 0.008), null);
  });

  // Bastilla
  const hemPts = [];
  for (let i = 0; i < 128; i++) hemPts.push(torsoPoint(cut, (i / 128) * Math.PI * 2, 0));
  const hem = finalize(buildRib(hemPts, 0.005), null);

  return { torso, sleeves, collar, cuffs, hem, height: cut.neckY };
}
