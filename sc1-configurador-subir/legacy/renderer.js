// Visor 3D mínimo en WebGL2: cámara orbital, luces de escenario, tela con relieve y piso con brillo.
// En producción esto se reemplaza por React Three Fiber; la geometría y la textura se reutilizan tal cual.

const VS_SRC = `#version 300 es
in vec3 aPos; in vec3 aNrm; in vec2 aUv;
uniform mat4 uViewProj;
out vec3 vPos; out vec3 vNrm; out vec2 vUv;
void main(){ vPos = aPos; vNrm = aNrm; vUv = aUv; gl_Position = uViewProj * vec4(aPos,1.0); }`;

const FS_SRC = `#version 300 es
precision highp float;
in vec3 vPos; in vec3 vNrm; in vec2 vUv;
uniform sampler2D uMap; uniform int uUseMap; uniform vec3 uColor;
uniform vec3 uCam; uniform vec3 uInner; uniform float uKnit;
uniform vec3 uRimA; uniform vec3 uRimB;
out vec4 frag;
vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
void main(){
  vec3 n = normalize(vNrm);
  vec3 base = uUseMap==1 ? toLin(texture(uMap, vUv).rgb) : toLin(uColor);
  if(!gl_FrontFacing){ n = -n; base = toLin(uInner); }
  // relieve de tejido interlock: patrón fino que perturba la normal
  if(uKnit > 0.0){
    vec2 k = vUv * vec2(900.0, 1300.0);
    float r = sin(k.x) * 0.5 + sin(k.y + sin(k.x*0.5)*1.4) * 0.5;
    n = normalize(n + uKnit * vec3(cos(k.x)*0.5, sin(k.y)*0.35, 0.0) * r);
  }
  vec3 V = normalize(uCam - vPos);
  vec3 L1 = normalize(vec3(0.35, 0.85, 0.9));   // luz principal
  vec3 L2 = normalize(vec3(-0.9, 0.35, 0.25));  // relleno
  float wrap = 0.35;
  float d1 = max((dot(n,L1)+wrap)/(1.0+wrap), 0.0);
  float d2 = max((dot(n,L2)+wrap)/(1.0+wrap), 0.0);
  float hemi = 0.5 + 0.5*n.y;
  vec3 amb = mix(vec3(0.10,0.10,0.13), vec3(0.34,0.36,0.42), hemi);
  vec3 col = base * (amb + d1*vec3(1.05,1.0,0.96)*1.05 + d2*vec3(0.55,0.6,0.75)*0.45);
  // brillo suave de poliéster
  vec3 H = normalize(L1 + V);
  float spec = pow(max(dot(n,H),0.0), 42.0) * 0.10;
  // sheen / borde: tela brillante en ángulos rasantes
  float fres = pow(1.0 - max(dot(n,V),0.0), 3.0);
  float side = n.x;
  vec3 rim = mix(uRimB, uRimA, smoothstep(-0.4,0.4,side)) * fres * 0.95;
  float back = smoothstep(0.1, -0.6, dot(n, normalize(vec3(0.0,0.2,1.0))));
  col += spec + rim * (0.35 + 0.65*back) + base*fres*0.25;
  if(!gl_FrontFacing) col *= 0.55;
  col = aces(col*1.08);
  frag = vec4(pow(col, vec3(1.0/2.2)), 1.0);
}`;

const FLOOR_VS = `#version 300 es
in vec2 aP; uniform mat4 uViewProj; uniform float uY; uniform float uR;
out vec2 vP;
void main(){ vP = aP; gl_Position = uViewProj * vec4(aP.x*uR, uY, aP.y*uR, 1.0); }`;

const FLOOR_FS = `#version 300 es
precision highp float;
in vec2 vP; uniform vec3 uGlow; uniform vec2 uShadow;
out vec4 frag;
void main(){
  float r = length(vP);
  if(r > 1.0) discard;
  float ring = smoothstep(0.035, 0.0, abs(r - 0.82)) * 0.9 + smoothstep(0.3, 0.0, abs(r-0.82))*0.18;
  float fill = (1.0 - smoothstep(0.0, 1.0, r)) * 0.22;
  vec2 s = vP / uShadow;
  float shadow = exp(-dot(s,s)*2.2) * 0.75;
  float g = clamp(ring*0.9 + fill, 0.0, 1.0);
  vec3 c = uGlow * g * (1.0 - shadow);
  float a = clamp(g + shadow*(1.0 - g), 0.0, 1.0);
  frag = vec4(c, a);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

// --- matrices (column-major) ---
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

function lookAt(eye, c, up) {
  let zx = eye[0] - c[0];
  let zy = eye[1] - c[1];
  let zz = eye[2] - c[2];
  let l = Math.hypot(zx, zy, zz);
  zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz);
  xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ]);
}

function mul(a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      o[i * 4 + j] = s;
    }
  return o;
}

function hexToRgb(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('webgl2');
    this.gl = gl;
    this.prog = program(gl, VS_SRC, FS_SRC);
    this.floorProg = program(gl, FLOOR_VS, FLOOR_FS);
    this.meshes = [];
    this.tex = gl.createTexture();
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.target = [0, 0.33, 0];
    this.az = 0.32;
    this.el = 0.12;
    this.dist = 1.9;
    this.goal = null;
    this.autoRotate = false;
    this.dirty = true;
    this.colors = { collar: '#ffffff', cuff: '#ffffff', hem: '#111111', inner: '#1a1d24' };
    this.glow = hexToRgb('#2f5bff');
    this.rimA = hexToRgb('#3a6bff');
    this.rimB = hexToRgb('#ffb62e');
    this.floorY = -0.1;

    const fb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, fb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.floorVao = gl.createVertexArray();
    gl.bindVertexArray(this.floorVao);
    const loc = gl.getAttribLocation(this.floorProg, 'aP');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this._bindInput();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _upload(m) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const attr = (name, data, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const l = gl.getAttribLocation(this.prog, name);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
    };
    attr('aPos', m.pos, 3);
    attr('aNrm', m.nrm, 3);
    attr('aUv', m.uv, 2);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: m.idx.length };
  }

  setJersey(j) {
    this.meshes = [];
    const add = (m, kind) => this.meshes.push({ ...this._upload(m), kind });
    add(j.torso, 'fabric');
    j.sleeves.forEach((s) => add(s, 'fabric'));
    add(j.collar, 'collar');
    j.cuffs.forEach((c) => add(c, 'cuff'));
    add(j.hem, 'hem');
    this.target = [0, j.height / 2 + 0.005, 0];
    this.dirty = true;
  }

  setTexture(canvas) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    this.dirty = true;
  }

  setTrim({ collar, cuff, hem, inner }) {
    Object.assign(this.colors, { collar, cuff, hem, inner });
    this.dirty = true;
  }

  // vista: 'frente' | 'espalda' | 'lado'
  showView(v) {
    const map = { frente: 0.0, espalda: Math.PI, lado: Math.PI / 2 };
    let goal = map[v] ?? 0;
    // ir por el camino corto
    const twoPi = Math.PI * 2;
    let cur = ((this.az % twoPi) + twoPi) % twoPi;
    let delta = goal - cur;
    if (delta > Math.PI) delta -= twoPi;
    if (delta < -Math.PI) delta += twoPi;
    this.goal = { az: this.az + delta, el: 0.1, dist: Math.min(this.dist, 1.9) };
    this.dirty = true;
  }

  _bindInput() {
    const c = this.canvas;
    const pointers = new Map();
    let pinch = 0;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.goal = null;
      this.autoRotate = false;
      this.onInteract && this.onInteract();
    });
    c.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const p = pointers.get(e.pointerId);
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 1) {
        this.az -= dx * 0.009;
        this.el = Math.max(-0.35, Math.min(0.75, this.el + dy * 0.006));
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.dist = Math.max(0.85, Math.min(2.6, this.dist * (pinch / d)));
        pinch = d;
      }
      this.dirty = true;
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.dist = Math.max(0.85, Math.min(2.6, this.dist * (1 + e.deltaY * 0.0012)));
        this.dirty = true;
      },
      { passive: false }
    );
  }

  _resize() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
      this.dirty = true;
    }
  }

  _loop(t) {
    const dt = this._last ? Math.min(0.05, (t - this._last) / 1000) : 0.016;
    this._last = t;
    this._resize();
    if (this.goal) {
      const k = 1 - Math.pow(0.0015, dt);
      this.az += (this.goal.az - this.az) * k;
      this.el += (this.goal.el - this.el) * k;
      this.dist += (this.goal.dist - this.dist) * k;
      if (Math.abs(this.goal.az - this.az) < 0.001 && Math.abs(this.goal.el - this.el) < 0.001) this.goal = null;
      this.dirty = true;
    }
    if (this.autoRotate) {
      this.az += dt * 0.5;
      this.dirty = true;
    }
    if (this.dirty) {
      this.render();
      this.dirty = false;
    }
    requestAnimationFrame(this._loop);
  }

  render() {
    const gl = this.gl;
    const c = this.canvas;
    gl.viewport(0, 0, c.width, c.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = c.width / Math.max(1, c.height);
    // en pantallas angostas alejar la cámara para que quepa el jersey completo
    const vfov = (30 * Math.PI) / 180;
    const needed = 0.62 / (Math.tan(vfov / 2) * aspect); // que quepan las mangas a lo ancho
    const d = this.dist * Math.max(1, needed / 1.9);
    const eye = [
      this.target[0] + d * Math.sin(this.az) * Math.cos(this.el),
      this.target[1] + d * Math.sin(this.el),
      this.target[2] + d * Math.cos(this.az) * Math.cos(this.el),
    ];
    const vp = mul(perspective(vfov, aspect, 0.05, 20), lookAt(eye, this.target, [0, 1, 0]));

    // piso
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.floorProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.floorProg, 'uViewProj'), false, vp);
    gl.uniform1f(gl.getUniformLocation(this.floorProg, 'uY'), this.floorY);
    gl.uniform1f(gl.getUniformLocation(this.floorProg, 'uR'), 0.62);
    gl.uniform3fv(gl.getUniformLocation(this.floorProg, 'uGlow'), this.glow);
    gl.uniform2fv(gl.getUniformLocation(this.floorProg, 'uShadow'), [0.5, 0.3]);
    gl.bindVertexArray(this.floorVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // jersey
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    const p = this.prog;
    gl.useProgram(p);
    gl.uniformMatrix4fv(gl.getUniformLocation(p, 'uViewProj'), false, vp);
    gl.uniform3fv(gl.getUniformLocation(p, 'uCam'), eye);
    gl.uniform3fv(gl.getUniformLocation(p, 'uRimA'), this.rimA);
    gl.uniform3fv(gl.getUniformLocation(p, 'uRimB'), this.rimB);
    gl.uniform3fv(gl.getUniformLocation(p, 'uInner'), hexToRgb(this.colors.inner));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(gl.getUniformLocation(p, 'uMap'), 0);
    const uUse = gl.getUniformLocation(p, 'uUseMap');
    const uCol = gl.getUniformLocation(p, 'uColor');
    const uKnit = gl.getUniformLocation(p, 'uKnit');
    for (const m of this.meshes) {
      if (m.kind === 'fabric') {
        gl.uniform1i(uUse, 1);
        gl.uniform1f(uKnit, 0.06);
      } else {
        gl.uniform1i(uUse, 0);
        gl.uniform1f(uKnit, 0.0);
        gl.uniform3fv(uCol, hexToRgb(this.colors[m.kind]));
      }
      gl.bindVertexArray(m.vao);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
  }

  snapshot(w = 480) {
    this.render();
    const c = document.createElement('canvas');
    const r = this.canvas.height / this.canvas.width;
    c.width = w;
    c.height = Math.round(w * r);
    c.getContext('2d').drawImage(this.canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }
}
