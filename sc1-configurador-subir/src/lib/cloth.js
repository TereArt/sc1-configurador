// Movimiento de la tela al girar (estilo "dramático").
// El jersey gira como un cuerpo rígido; la tela reacciona con un resorte poco amortiguado:
//  - se retrasa al acelerar (torsión, más fuerte abajo y en las mangas)
//  - se abre hacia afuera con la velocidad (fuerza centrífuga)
//  - ondea (ondas que recorren la bastilla) y rebota varias veces antes de asentarse
// Todo ocurre en el shader de vértices, así que sirve para el modelo procedural y para cualquier .glb.

export const clothUniforms = {
  uTime: { value: 0 },
  uLag: { value: 0 }, // ángulo de retraso (rad)
  uSpin: { value: 0 }, // apertura por velocidad (0..1)
  uFlutter: { value: 0 }, // intensidad de ondas (0..1)
  uH: { value: 0.665 }, // alto del modelo
  uHalfW: { value: 0.27 }, // medio ancho del torso
  uAmt: { value: 1 }, // escala global del efecto
};

const DEFORM_GLSL = /* glsl */ `
uniform float uTime; uniform float uLag; uniform float uSpin; uniform float uFlutter;
uniform float uH; uniform float uHalfW; uniform float uAmt;
vec3 clothDeform(vec3 p, inout vec3 n) {
  float h = clamp(p.y / uH, 0.0, 1.0);
  float body = pow(1.0 - h, 1.5);
  float ax = abs(p.x);
  float sleeve = smoothstep(uHalfW * 0.92, uHalfW * 1.75, ax) * smoothstep(0.35, 0.7, h);
  float w = max(body, sleeve * 0.9) * uAmt;
  float th = atan(p.z, p.x);
  float len = length(p.xz);
  vec2 dir = len > 1e-4 ? p.xz / len : vec2(1.0, 0.0);
  // ondas: dos frecuencias que viajan alrededor de la prenda
  float ph1 = th * 3.0 - uTime * 6.5 + p.y * 7.0;
  float ph2 = th * 5.0 + uTime * 4.1 - p.y * 11.0;
  float wave = (sin(ph1) * 0.7 + sin(ph2) * 0.3) * uFlutter * w;
  float dwave = (cos(ph1) * 0.7 * 3.0 + cos(ph2) * 0.3 * 5.0) * uFlutter * w;
  // apertura centrífuga + ondas (radial)
  float radial = uSpin * w * 0.012 + wave * 0.006;
  vec2 r = p.xz + dir * radial;
  // las mangas se levantan un poco con la velocidad
  p.y += sleeve * uSpin * 0.018 * uAmt;
  // la parte baja se levanta ligeramente al abrirse
  p.y += body * uSpin * 0.006 * uAmt;
  // torsión por retraso
  float ang = -uLag * w;
  float c = cos(ang), s = sin(ang);
  p.xz = vec2(c * r.x - s * r.y, s * r.x + c * r.y);
  n.xz = vec2(c * n.x - s * n.z, s * n.x + c * n.z);
  // inclinar la normal según la pendiente de la onda (para que se vean los pliegues moverse)
  vec3 tang = vec3(-sin(th + ang), 0.0, cos(th + ang));
  n = normalize(n - tang * (dwave * 0.008) / max(len, 0.06));
  return p;
}
`;

// Inyecta la deformación en cualquier material de three.js
export function injectCloth(material) {
  if (material.userData.cloth) return material;
  material.userData.cloth = true;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    Object.assign(shader.uniforms, clothUniforms);
    shader.vertexShader = DEFORM_GLSL + shader.vertexShader;
    if (shader.vertexShader.includes('#include <defaultnormal_vertex>')) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 clothP = clothDeform(position, objectNormal);')
        .replace('#include <begin_vertex>', 'vec3 transformed = clothP;');
    } else {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 clothN = vec3(0.0, 1.0, 0.0);\nvec3 transformed = clothDeform(position, clothN);');
    }
  };
  material.customProgramCacheKey = () => 'cloth-' + material.type;
  return material;
}

// ---------- física ----------
// Estado del giro del cuerpo + resorte de la tela
export const motion = {
  angle: 0, // giro del jersey (rad)
  vel: 0, // velocidad angular (rad/s)
  goal: null, // ángulo objetivo (vistas frente/espalda)
  dragging: false,
  spin: false,
  lag: 0,
  lagVel: 0,
  flutter: 0,
  spinAmt: 0,
};

const K = 26; // rigidez del resorte de la tela
const C = 1.6; // amortiguación (baja = más rebote)
const DRIVE = 0.085; // cuánto empuja la aceleración a la tela

export function stepMotion(dt) {
  const m = motion;
  const prevVel = m.vel;
  if (m.spin) {
    m.vel += (1.6 - m.vel) * Math.min(1, dt * 2.5);
  } else if (m.goal != null && !m.dragging) {
    // resorte crítico hacia la vista pedida
    const k = 38;
    const c = 2 * Math.sqrt(k) * 0.9;
    const acc = k * (m.goal - m.angle) - c * m.vel;
    m.vel += acc * dt;
    if (Math.abs(m.goal - m.angle) < 0.002 && Math.abs(m.vel) < 0.01) m.goal = null;
  } else if (!m.dragging) {
    // inercia al soltar
    m.vel *= Math.pow(0.12, dt);
    if (Math.abs(m.vel) < 0.002) m.vel = 0;
  }
  if (!m.dragging) m.angle += m.vel * dt;
  const acc = (m.vel - prevVel) / Math.max(dt, 1e-3);

  // resorte de la tela impulsado por la aceleración del cuerpo
  const a = -K * m.lag - C * m.lagVel + acc * DRIVE;
  m.lagVel += a * dt;
  m.lag += m.lagVel * dt;
  m.lag = Math.max(-0.35, Math.min(0.35, m.lag));

  // apertura por velocidad (suavizada, con rebote ligero)
  const spinTarget = Math.min(1, Math.abs(m.vel) / 12) ** 1.5;
  m.spinAmt += (spinTarget - m.spinAmt) * Math.min(1, dt * 4);
  // ondas: crecen con el movimiento y se apagan despacio
  const excite = Math.min(1, Math.abs(m.vel) * 0.25 + Math.abs(m.lagVel) * 0.6);
  m.flutter = Math.max(excite, m.flutter * Math.pow(0.35, dt));

  clothUniforms.uLag.value = m.lag;
  clothUniforms.uSpin.value = m.spinAmt;
  clothUniforms.uFlutter.value = m.flutter;
  return Math.abs(m.vel) > 0.001 || Math.abs(m.lagVel) > 0.001 || m.flutter > 0.01;
}
