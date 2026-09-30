import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, N8AO, Bloom, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useStore, glRef } from '../store.js';
import { diagLog } from '../lib/diag.js';
import { trimColors, DEFAULT_ATLAS } from '../lib/compose.js';
import { jerseyTexture, knitNormal, makeFloorTexture, weaveTexture, weaveCavity, WEAVES } from '../lib/texture.js';
import { collarPaint, injectCollar, collarUniforms, NECK_PTS, CUFF_PTS } from '../lib/collar.js';
import { clothUniforms, injectCloth, motion, stepMotion } from '../lib/cloth.js';
import { pickPanel, itemAt, panelToLocal, panelPoint } from '../lib/pick.js';
import { editor, HANDLES } from '../lib/editor.js';
import { layoutItems, panelDims } from '../lib/compose.js';

// grupo del jersey (para saber qué punto de la tela se toca al arrastrar logos)
const garmentGroup = { current: null };
const LOGOS_STEP = 3;

const FLOOR_Y = -0.1;

// ---------- materiales ----------
const rectU = (r, S) => new THREE.Vector4(r.x / S, r.y / S, r.w / S, r.h / S);

// Ajustes del shader de la tela:
//  - modo "projection": el diseño se proyecta desde frente/espalda/mangas (para .glb con UV desordenado)
//  - sombras horneadas del modelo original como detalle sobre el diseño
function patchFabric(fabric, garment) {
  const d = (garment && garment.detail) || {};
  const proj = garment && garment.mapping === 'projection';
  const prev = fabric.onBeforeCompile;
  fabric.userData.weave = {
    uWeave: { value: weaveTexture('tecnodry') },
    uWeaveCav: { value: weaveCavity('tecnodry') },
    uWeaveRepeat: { value: WEAVES.tecnodry.repeat },
    uWeaveStrength: { value: WEAVES.tecnodry.strength },
    uWeaveCavAmt: { value: WEAVES.tecnodry.cavity },
  };
  fabric.onBeforeCompile = (shader, r) => {
    prev && prev(shader, r);
    Object.assign(shader.uniforms, fabric.userData.weave);
    // coordenadas del tejido: en modo proyección salen de la posición 3D (continuas en las costuras del modelo)
    const WUV = proj ? '(weaveUV() * uWeaveRepeat / 70.0)' : '(vMapUv * uWeaveRepeat)';
    shader.fragmentShader = 'uniform sampler2D uWeave; uniform sampler2D uWeaveCav; uniform float uWeaveRepeat; uniform float uWeaveStrength; uniform float uWeaveCavAmt;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#ifdef USE_MAP
        float cav = texture2D(uWeaveCav, ${WUV}).r;
        diffuseColor.rgb *= mix(1.0, 0.72 + 0.28 * cav, uWeaveCavAmt);
      #endif
      #include <color_fragment>`
    ).replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      #if defined( USE_MAP ) && defined( USE_NORMALMAP_TANGENTSPACE )
        vec3 wv = texture2D(uWeave, ${WUV}).xyz * 2.0 - 1.0;
        normal = normalize(normal + tbn * vec3(wv.xy * uWeaveStrength, 0.0));
      #endif`
    );
    let mapCode = '#include <map_fragment>';
    if (proj) {
      const A = DEFAULT_ATLAS;
      Object.assign(shader.uniforms, {
        uFW: { value: garment.proj.fw },
        uFD: { value: garment.proj.fd },
        uSL: { value: garment.proj.sleeveLen },
        uXS: { value: garment.proj.xs || garment.proj.fw },
        uYS: { value: garment.proj.ys || garment.height * 0.9 },
        uArmY: { value: garment.proj.armY || garment.height * 0.53 },
        uSA: { value: garment.proj.sleeveA || new THREE.Vector3(garment.proj.fw, garment.height * 0.7, 0) },
        uSRef: { value: garment.proj.sleeveRef || new THREE.Vector3(0.6, 0.8, 0) },
        uSAsp: { value: A.sleeveR.w / A.sleeveR.h },
        uSC: { value: garment.proj.sleeveC || new THREE.Vector3(garment.proj.fw + garment.proj.sleeveLen, garment.height * 0.6, 0) },
        uPH: { value: garment.height },
        uRF: { value: rectU(A.front, A.size) },
        uRB: { value: rectU(A.back, A.size) },
        uRSR: { value: rectU(A.sleeveR, A.size) },
        uRSL: { value: rectU(A.sleeveL, A.size) },
      });
      shader.vertexShader = 'varying vec3 vObjPos;\n' + shader.vertexShader.replace('void main() {', 'void main() {\n  vObjPos = position;');
      shader.fragmentShader =
        `varying vec3 vObjPos;
        uniform float uFW; uniform float uFD; uniform float uSL; uniform float uPH; uniform float uXS; uniform float uYS; uniform float uArmY; uniform vec3 uSA; uniform vec3 uSC; uniform vec3 uSRef; uniform float uSAsp;
        // costura de la sisa (manga pegada): baja casi recta desde el hombro y se curva hacia la axila
        float seamX(float y) { float t = clamp((y - uArmY) / max(uYS - uArmY, 1e-3), 0.0, 1.0); return mix(uFW * 0.97, uXS, sqrt(t)); }
        float seamDist(vec3 p) { if (p.y < uArmY - 0.004 || p.y > uYS + 0.03) return 1.0; return abs(abs(p.x) - seamX(p.y)); }
        uniform vec4 uRF; uniform vec4 uRB; uniform vec4 uRSR; uniform vec4 uRSL;
        vec2 atlasUV(vec4 rc, vec2 q) { vec2 c = rc.xy + clamp(q, 0.0, 1.0) * rc.zw; return vec2(c.x, 1.0 - c.y); }
        bool inSleeve(vec3 p) { return p.y > uArmY && abs(p.x) > seamX(p.y); }
        // manga como cilindro: x = ángulo alrededor del eje (0 = parte de arriba), y = distancia desde el hombro, z = radio, w = largo total
        vec4 sleeveFrame(vec3 p) {
          vec3 pm = vec3(abs(p.x), p.y, p.z);
          vec3 ax3 = uSC - uSA; float L = length(ax3); vec3 d = ax3 / L;
          float t = dot(pm - uSA, d);
          vec3 r = pm - uSA - d * t;
          vec3 up = normalize(uSRef - d * dot(uSRef, d));
          vec3 side = cross(d, up);
          // de lado, la derecha de la pantalla es -z en la manga +x y +z en la manga -x
          float ang = -sign(p.x) * atan(dot(r, side), dot(r, up));
          float t0 = dot(vec3(uXS, uYS, uSA.z) - uSA, d);
          return vec4(ang, t - t0, length(r), L - t0);
        }
        // tejido: repeticiones enteras alrededor del torso y de la manga para que no haya cortes
        vec2 weaveUV() {
          vec3 p = vObjPos;
          if (inSleeve(p)) { vec4 f = sleeveFrame(p); return vec2(f.x / 6.2831853 * floor(0.45 * 80.0), f.y * 80.0); }
          float a = uFW, b = uFD;
          float per = 3.14159 * (3.0 * (a + b) - sqrt((3.0 * a + b) * (a + 3.0 * b)));
          float th = atan(p.x / a, p.z / b);
          return vec2(th / 6.2831853 * floor(per * 80.0), p.y * 80.0);
        }
        vec2 projUV() {
          vec3 p = vObjPos; float ax = abs(p.x);
          if (inSleeve(p)) {
            // largo medido desde el punto del hombro; contorno por longitud de arco (sin deformar logos)
            vec4 f = sleeveFrame(p);
            vec2 q = vec2(0.5 + f.x * f.z / (f.w * uSAsp), f.y / f.w);
            return p.x > 0.0 ? atlasUV(uRSR, q) : atlasUV(uRSL, q);
          }
          float v = (uPH - p.y) / uPH;
          if (p.z >= 0.0) return atlasUV(uRF, vec2((p.x + uFW) / (2.0 * uFW), v));
          return atlasUV(uRB, vec2((uFW - p.x) / (2.0 * uFW), v));
        }
        ` + shader.fragmentShader;
      // nivel de detalle calculado desde la posición (evita líneas en las costuras de la proyección)
      mapCode = `#ifdef USE_MAP
        float projTexel = 1024.0 / (2.0 * uFW);
        float projLod = log2(max(max(length(dFdx(vObjPos)), length(dFdy(vObjPos))) * projTexel, 1e-4));
        vec4 sampledDiffuseColor = textureLod(map, projUV(), clamp(projLod, 0.0, 10.0));
        diffuseColor *= sampledDiffuseColor;
        // pespunte de la sisa
        float sd = seamDist(vObjPos);
        diffuseColor.rgb *= 1.0 - 0.28 * (1.0 - smoothstep(0.0006, 0.0022, sd));
        diffuseColor.rgb *= 1.0 - 0.10 * (1.0 - smoothstep(0.0022, 0.006, sd)) * smoothstep(0.0006, 0.0022, sd);
      #endif`;
    }
    if (d.shadeMap) {
      shader.uniforms.uShadeMap = { value: d.shadeMap };
      shader.uniforms.uShadeAvg = { value: d.shadeAvg };
      shader.fragmentShader = 'uniform sampler2D uShadeMap; uniform float uShadeAvg;\n' + shader.fragmentShader;
      mapCode += `
      #ifdef USE_MAP
        vec3 shadeC = texture2D(uShadeMap, vMapUv).rgb;
        float shadeL = dot(shadeC, vec3(0.2126, 0.7152, 0.0722)) / uShadeAvg;
        diffuseColor.rgb *= clamp(mix(1.0, shadeL, 0.6), 0.55, 1.25);
      #endif`;
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', mapCode);
  };
  fabric.customProgramCacheKey = () => `cloth-fabric-${proj ? 'p' : 'u'}-${d.shadeMap ? 's' : 'n'}`;
}

function useMaterials(garment) {
  const mats = useMemo(() => {
    const d = (garment && garment.detail) || {};
    const fabric = new THREE.MeshPhysicalMaterial({
      map: jerseyTexture,
      // microfibra mate: sin brillo satinado, casi sin reflejos
      roughness: 0.94,
      metalness: 0,
      specularIntensity: 0.28,
      envMapIntensity: 0.45,
      sheen: 0.18,
      sheenRoughness: 0.95,
      sheenColor: new THREE.Color('#9aa0ad'),
      normalMap: d.normalMap || knitNormal,
      normalScale: d.normalScale || new THREE.Vector2(0.22, 0.22),
      side: THREE.FrontSide,
    });
    if (d.aoMap) {
      fabric.aoMap = d.aoMap;
      fabric.aoMapIntensity = 1;
    }
    injectCloth(fabric);
    patchFabric(fabric, garment);
    injectCollar(fabric, true);
    const inner = injectCollar(injectCloth(new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.BackSide })));
    const rib = injectCloth(new THREE.MeshPhysicalMaterial({ roughness: 0.92, sheen: 0.15, sheenRoughness: 0.95, envMapIntensity: 0.45, sheenColor: new THREE.Color('#9aa0ad'), normalMap: knitNormal, normalScale: new THREE.Vector2(0.2, 0.2), side: THREE.DoubleSide }));
    const hem = injectCloth(new THREE.MeshStandardMaterial({ roughness: 0.7 }));
    const rib2 = injectCloth(new THREE.MeshPhysicalMaterial({ roughness: 0.92, sheen: 0.15, sheenRoughness: 0.95, envMapIntensity: 0.45, sheenColor: new THREE.Color('#9aa0ad'), normalMap: knitNormal, normalScale: new THREE.Vector2(0.2, 0.2), side: THREE.DoubleSide }));
    const vfill = injectCloth(new THREE.MeshStandardMaterial({ roughness: 0.95 }));
    // las sombras proyectadas también se deforman con la tela
    const depth = injectCollar(injectCloth(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })));
    return { fabric, inner, trim: { collar: rib, cuff: rib, hem, collar2: rib2, vfill }, depth };
  }, [garment]);
  useEffect(() => () => [mats.fabric, mats.inner, mats.trim.collar, mats.trim.hem, mats.trim.collar2, mats.trim.vfill, mats.depth].forEach((m) => m.dispose()), [mats]);
  return mats;
}

function Garment() {
  const garment = useStore((s) => s.garment);
  const colors = useStore((s) => s.colors);
  const collar = useStore((s) => s.collar);
  const collar2 = useStore((s) => s.collar2);
  const cuff = useStore((s) => s.cuff);
  const trims = trimColors({ colors, collar, collar2, cuff });
  const collarType = useStore((s) => s.collarType);
  const weave = useStore((s) => s.weave);
  const group = useRef();
  const mats = useMaterials(garment);
  mats.inner.color.set(trims.inner);
  mats.trim.collar.color.set(trims.collar);
  mats.trim.collar2.color.set(trims.collar2);
  mats.trim.hem.color.set(trims.hem);
  mats.trim.vfill.color.set(trims.inner).multiplyScalar(0.55);
  const wv = WEAVES[weave] || WEAVES.liso;
  if (mats.fabric.userData.weave) {
    mats.fabric.userData.weave.uWeave.value = weaveTexture(weave);
    mats.fabric.userData.weave.uWeaveCav.value = weaveCavity(weave);
    mats.fabric.userData.weave.uWeaveCavAmt.value = wv.cavity || 0;
    mats.fabric.userData.weave.uWeaveRepeat.value = wv.repeat;
    mats.fabric.userData.weave.uWeaveStrength.value = wv.strength;
  }
  // cuello pintado sobre el escote original del modelo
  const paintCfg = useMemo(() => {
    try {
      return garment ? collarPaint(garment.analysis, collarType) : null;
    } catch (e) {
      console.warn('cuello', e);
      return null;
    }
  }, [garment, collarType]);
  const U = collarUniforms;
  U.uBandOn.value = paintCfg ? 1 : 0;
  if (paintCfg) {
    paintCfg.neck.forEach((p, i) => U.uNeck.value[i].copy(p));
    U.uNeckN.value = paintCfg.neck.length;
    U.uNeckY.value = paintCfg.neckY;
    const doble = collarType === 'doble';
    // doble cuello = cuello V + telita cosida en el vértice
    U.uW1.value = 2.4 / 108;
    U.uW2.value = 0;
    U.uC1.value.set(trims.collar);
    U.uC2.value.set(trims.collar);
    U.uC3.value.set(trims.collar2);
    U.uCC.value.set(trims.cuff);
    U.uVIns.value = doble ? 3.2 / 108 : 0;
    const [ca, cb] = paintCfg.cuffs;
    U.uCuffN.value = ca && cb ? CUFF_PTS : 0;
    if (ca && cb) {
      ca.forEach((p, i) => U.uCuffA.value[i].copy(p));
      cb.forEach((p, i) => U.uCuffB.value[i].copy(p));
    }
    U.uCuffX.value = paintCfg.cuffX;
    U.uVOn.value = paintCfg.v ? 1 : 0;
    if (paintCfg.v) {
      U.uVApex.value = paintCfg.v.apexY;
      U.uVSX.value = paintCfg.v.sx;
      U.uVSY.value = paintCfg.v.sy;
      U.uVZ.value = paintCfg.v.zc;
    }
  } else U.uVOn.value = 0;

  useEffect(() => {
    if (!garment) return;
    clothUniforms.uH.value = garment.height;
    clothUniforms.uHalfW.value = garment.halfW;
  }, [garment]);

  useFrame((state, dt) => {
    // física en pasos fijos: igual de rápida con 30 o 144 FPS
    let t = Math.min(dt, 0.25);
    while (t > 1e-4) {
      const h = Math.min(t, 1 / 60);
      stepMotion(h);
      t -= h;
    }
    clothUniforms.uTime.value = state.clock.elapsedTime;
    if (group.current) group.current.rotation.y = motion.angle;
    garmentGroup.current = group.current;
  });

  if (!garment) return null;
  return (
    <group ref={group}>
      {garment.parts.map((p, i) =>
        p.role === 'fabric' ? (
          <group key={i}>
            <mesh geometry={p.geometry} material={mats.fabric} customDepthMaterial={mats.depth} castShadow receiveShadow userData={{ pickable: true }} />
            <mesh geometry={p.geometry} material={mats.inner} />
          </group>
        ) : (
          <mesh key={i} geometry={p.geometry} material={mats.trim[p.role] || mats.trim.collar} customDepthMaterial={mats.depth} castShadow receiveShadow />
        )
      )}
    </group>
  );
}

function Floor() {
  const tex = useMemo(() => makeFloorTexture(), []);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y - 0.002, 0]}>
      <circleGeometry args={[0.7, 96]} />
      <meshBasicMaterial map={tex} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

// Fondo de estudio dibujado en la escena (incluye el nombre en grande)
function Backdrop() {
  const name = useStore((s) => s.name);
  const fontsVersion = useStore((s) => s.fontsVersion);
  const { scene, size } = useThree();
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(document.createElement('canvas'));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => {
    const c = tex.image;
    const W = 1024;
    const H = Math.max(256, Math.round((W * size.height) / Math.max(1, size.width)));
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(W / 2, H * 0.32, 0, W / 2, H * 0.32, Math.max(W, H) * 0.75);
    g.addColorStop(0, '#1a2352');
    g.addColorStop(0.45, '#0a0e1c');
    g.addColorStop(1, '#040509');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = (W / 2) % 36; x < W; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = (H / 2) % 36; y < H; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    const txt = (name || 'SC1').toUpperCase();
    let fs = W * 0.22;
    ctx.font = `700 ${fs}px 'Chakra Petch', 'Arial Black', sans-serif`;
    const tw = ctx.measureText(txt).width;
    if (tw > W * 0.92) {
      fs *= (W * 0.92) / tw;
      ctx.font = `700 ${fs}px 'Chakra Petch', 'Arial Black', sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(120,150,255,0.14)';
    ctx.lineWidth = 2;
    ctx.strokeText(txt, W / 2, H * 0.46);
    tex.needsUpdate = true;
    scene.background = tex;
  }, [name, fontsVersion, size.width, size.height, tex, scene]);
  return null;
}

// ---------- cámara e interacción ----------
// Arrastrar a los lados gira el jersey (con inercia); arriba/abajo cambia la altura de la cámara.
const VIEWS = { frente: 0, espalda: Math.PI, lado: -Math.PI / 2, ladoIzq: -Math.PI / 2, ladoDer: Math.PI / 2 };
const BASE_DIST = 1.95;

function Controls() {
  const { camera, gl, size } = useThree();
  const cam = useRef({ polar: 1.45, dist: BASE_DIST, polarGoal: 1.45 });
  const garment = useStore((s) => s.garment);
  const nonce = useStore((s) => s.viewNonce);
  const view = useStore((s) => s.view);
  const spin = useStore((s) => s.spin);
  const target = useMemo(() => new THREE.Vector3(0, (garment ? garment.height : 0.665) / 2, 0), [garment]);

  useEffect(() => {
    motion.spin = spin;
    if (spin) motion.goal = null;
  }, [spin]);

  useEffect(() => {
    if (!view || !(view in VIEWS)) return;
    const base = VIEWS[view];
    const k = Math.round((motion.angle - base) / (Math.PI * 2));
    motion.goal = base + k * Math.PI * 2;
    cam.current.polarGoal = 1.45;
  }, [nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = gl.domElement;
    const pts = new Map();
    let last = null;
    let pinch = 0;
    const hist = [];
    // ---- arrastrar logos sobre la tela (paso Logos) ----
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let drag = null; // { key, panel, dx, dy, id }
    const hitAt = (e) => {
      const g = garmentGroup.current;
      if (!g) return null;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const meshes = [];
      g.traverse((o) => o.isMesh && o.userData.pickable && meshes.push(o));
      const hits = ray.intersectObjects(meshes, false);
      if (!hits.length) return null;
      const local = g.worldToLocal(hits[0].point.clone());
      return pickPanel(local, useStore.getState().garment);
    };
    const canMove = () => useStore.getState().step === LOGOS_STEP;
    // ---- deformar desde las esquinas / orillas del recuadro de selección ----
    editor.startResize = (h, e0) => {
      const st = useStore.getState();
      const garment = st.garment;
      if (!st.selKey || !garment) return;
      const dims = panelDims(garment.atlas, garment);
      const it = layoutItems(st, dims).find((x) => x.key === st.selKey);
      if (!it) return;
      const [W, H] = dims[it.panel];
      const hw = it.bw / 2 / W;
      const hh = it.bh / 2 / H;
      const fx = h.includes('w') ? it.x + hw : h.includes('e') ? it.x - hw : it.x;
      const fy = h.includes('n') ? it.y + hh : h.includes('s') ? it.y - hh : it.y;
      const k0 = { key: it.key, panel: it.panel, W, H, fx, fy, bw0: it.bw, bh0: it.bh, cx0: it.x, cy0: it.y, baseW: 1, baseH: 1, h };
      // caja natural sin estiramiento (bw = baseW·sx) — baseW ya incluye la escala
      k0.baseW = it.bw / st.itemStretch(it.key).sx;
      k0.baseH = it.bh / st.itemStretch(it.key).sy;
      st.set({ dragKey: it.key, moveHint: false });
      const mv = (e) => {
        const hit = hitAt(e);
        if (!hit || hit.panel !== k0.panel) return;
        let w = k0.bw0;
        let hgt = k0.bh0;
        let cx = k0.cx0;
        let cy = k0.cy0;
        const horiz = /[ew]/.test(k0.h);
        const vert = /[ns]/.test(k0.h);
        if (horiz) w = Math.abs(hit.x - k0.fx) * k0.W;
        if (vert) hgt = Math.abs(hit.y - k0.fy) * k0.H;
        if (e.shiftKey && horiz && vert) {
          // Shift: sin deformar (misma proporción)
          const k = Math.max(w / k0.bw0, hgt / k0.bh0);
          w = k0.bw0 * k;
          hgt = k0.bh0 * k;
        }
        w = Math.max(k0.W * 0.03, w);
        hgt = Math.max(k0.W * 0.03, hgt);
        if (horiz) cx = k0.fx + Math.sign(hit.x - k0.fx || 1) * (w / 2 / k0.W);
        if (vert) cy = k0.fy + Math.sign(hit.y - k0.fy || 1) * (hgt / 2 / k0.H);
        const cl = (v) => Math.min(0.98, Math.max(0.02, v));
        useStore.getState().moveItem(k0.key, { xy: { x: cl(cx), y: cl(cy) }, sx: +(w / k0.baseW).toFixed(4), sy: +(hgt / k0.baseH).toFixed(4) });
      };
      const upH = () => {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', upH);
        window.removeEventListener('pointercancel', upH);
        useStore.getState().set({ dragKey: null });
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', upH);
      window.addEventListener('pointercancel', upH);
      e0.preventDefault();
    };
    window.__sc1p2l = (panel, fx, fy) => {
      const g = garmentGroup.current;
      const meshes = [];
      g.traverse((o) => o.isMesh && o.userData.pickable && meshes.push(o));
      g.updateMatrixWorld();
      const cast = (o, d) => {
        ray.set(g.localToWorld(o.clone()), d.clone().transformDirection(g.matrixWorld));
        const hs = ray.intersectObjects(meshes, false);
        return hs.length ? { point: g.worldToLocal(hs[0].point.clone()) } : null;
      };
      const h = panelToLocal(panel, fx, fy, useStore.getState().garment, cast);
      const back = h ? pickPanel(h.point, useStore.getState().garment) : null;
      return { p: h && h.point.toArray().map((v) => +v.toFixed(3)), back };
    };
    // ayuda para pruebas automáticas: punto de pantalla de una posición de la pieza
    window.__sc1screen = (panel, fx, fy) => {
      const g = garmentGroup.current;
      const garment = useStore.getState().garment;
      if (!g || !garment) return null;
      let best = null;
      g.traverse((o) => {
        if (!o.isMesh || !o.userData.pickable) return;
        const P = o.geometry.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < P.count; i += 2) {
          v.fromBufferAttribute(P, i);
          const h = pickPanel(v, garment);
          if (!h || h.panel !== panel) continue;
          const d = (h.x - fx) ** 2 + (h.y - fy) ** 2;
          if (!best || d < best.d) best = { d, v: v.clone() };
        }
      });
      if (!best) return null;
      const w = g.localToWorld(best.v).project(camera);
      const r = el.getBoundingClientRect();
      return { x: r.left + ((w.x + 1) / 2) * r.width, y: r.top + ((1 - w.y) / 2) * r.height };
    };
    let hoverRaf = 0;
    const hover = (e) => {
      if (!canMove() || pts.size || e.pointerType === 'touch') return;
      cancelAnimationFrame(hoverRaf);
      hoverRaf = requestAnimationFrame(() => {
        const st = useStore.getState();
        const it = itemAt(st, hitAt(e));
        const k = it ? it.key : null;
        el.style.cursor = k ? 'move' : '';
        if (st.hoverKey !== k) st.set({ hoverKey: k });
      });
    };
    const down = (e) => {
      if (canMove() && pts.size === 0) {
        const st = useStore.getState();
        const hit = hitAt(e);
        const it = itemAt(st, hit);
        if (it) {
          el.setPointerCapture(e.pointerId);
          drag = { key: it.key, panel: it.panel, dx: it.x - hit.x, dy: it.y - hit.y, id: e.pointerId };
          st.set({ dragKey: it.key, selKey: it.key, hoverKey: null, moveHint: false, spin: false, view: null });
          motion.goal = null;
          e.preventDefault();
          return;
        }
        if (st.selKey) st.set({ selKey: null });
      }
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        last = { x: e.clientX, y: e.clientY };
        motion.dragging = true;
        motion.goal = null;
        hist.length = 0;
        const st = useStore.getState();
        if (st.spin || st.view) st.set({ spin: false, view: null });
      }
    };
    const move = (e) => {
      if (drag && e.pointerId === drag.id) {
        const hit = hitAt(e);
        if (hit && hit.panel === drag.panel) {
          const cl = (v) => Math.min(0.97, Math.max(0.03, v));
          useStore.getState().moveItem(drag.key, { xy: { x: cl(hit.x + drag.dx), y: cl(hit.y + drag.dy) } });
        }
        return;
      }
      if (!pts.has(e.pointerId)) return hover(e);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1 && last) {
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        last = { x: e.clientX, y: e.clientY };
        const d = dx * 0.0095;
        motion.angle += d;
        const now = performance.now();
        hist.push({ t: now, d });
        while (hist.length && now - hist[0].t > 90) hist.shift();
        const win = hist.length > 1 ? (now - hist[0].t) / 1000 : 0.016;
        motion.vel = hist.reduce((a, h) => a + h.d, 0) / Math.max(win, 0.016);
        cam.current.polarGoal = Math.max(1.05, Math.min(1.75, cam.current.polarGoal - dy * 0.004));
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const dd = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) cam.current.dist = Math.max(1.0, Math.min(3.2, cam.current.dist * (pinch / dd)));
        pinch = dd;
      }
    };
    const up = (e) => {
      if (drag && e.pointerId === drag.id) {
        drag = null;
        useStore.getState().set({ dragKey: null });
        return;
      }
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = 0;
      if (pts.size === 0) {
        motion.dragging = false;
        last = null;
        const now = performance.now();
        if (!hist.length || now - hist[hist.length - 1].t > 80) motion.vel = 0;
        motion.vel = Math.max(-14, Math.min(14, motion.vel));
      }
    };
    const wheel = (e) => {
      e.preventDefault();
      // rueda sobre un logo (paso Logos): cambia su tamaño
      const st = useStore.getState();
      if (canMove() && st.hoverKey) {
        const sc = Math.min(2.2, Math.max(0.4, st.itemScale(st.hoverKey) * (1 - e.deltaY * 0.0012)));
        st.moveItem(st.hoverKey, { scale: +sc.toFixed(3) });
        return;
      }
      cam.current.dist = Math.max(1.0, Math.min(3.2, cam.current.dist * (1 + e.deltaY * 0.0012)));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    const leave = () => {
      el.style.cursor = '';
      if (useStore.getState().hoverKey) useStore.getState().set({ hoverKey: null });
    };
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointerleave', leave);
      cancelAnimationFrame(hoverRaf);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl, camera]);

  useFrame((_, dt) => {
    const c = cam.current;
    c.polar += (c.polarGoal - c.polar) * Math.min(1, dt * 6);
    const aspect = size.width / Math.max(1, size.height);
    const needed = 0.64 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
    const d = Math.max(c.dist, needed * (c.dist / BASE_DIST));
    camera.position.setFromSpherical(new THREE.Spherical(d, c.polar, 0.22)).add(target);
    camera.lookAt(target);
  });
  return null;
}

// ---------- recuadro de selección con esquinas (encima del visor) ----------
// Sigue al logo seleccionado sobre la tela (también en mangas) y se redibuja cada cuadro al girar.
const RING = []; // puntos del contorno en fracciones de la caja (-0.5..0.5), 4 por lado
for (let i = 0; i < 4; i++) RING.push([-0.5 + i / 4, -0.5]);
for (let i = 0; i < 4; i++) RING.push([0.5, -0.5 + i / 4]);
for (let i = 0; i < 4; i++) RING.push([0.5 - i / 4, 0.5]);
for (let i = 0; i < 4; i++) RING.push([-0.5, 0.5 - i / 4]);
const HANDLE_AT = { nw: 0, n: 2, ne: 4, e: 6, se: 8, s: 10, sw: 12, w: 14 };

function SelectionFrame() {
  const { camera, gl } = useThree();
  const cache = useRef({ sig: '', pts: null });
  const ray = useMemo(() => new THREE.Raycaster(), []);
  useFrame(() => {
    const svg = editor.svg;
    if (!svg) return;
    const st = useStore.getState();
    const g = garmentGroup.current;
    const garment = st.garment;
    const hide = () => {
      if (svg.style.display !== 'none') svg.style.display = 'none';
      if (editor.bar) editor.bar.style.display = 'none';
    };
    if (!st.selKey || st.step !== LOGOS_STEP || !g || !garment || garment.mapping !== 'projection') return hide();
    const dims = panelDims(garment.atlas, garment);
    const it = layoutItems(st, dims).find((x) => x.key === st.selKey);
    if (!it) return hide();
    const [W, H] = dims[it.panel];
    const sig = [it.key, it.panel, it.x, it.y, it.bw, it.bh, garment.height].join('|');
    if (cache.current.sig !== sig) {
      const pts = RING.map(([u, v]) => panelPoint(garment, it.panel, it.x + (u * it.bw) / W, it.y + (v * it.bh) / H, W / H));
      cache.current = { sig, pts };
    }
    const { pts } = cache.current;
    const rect = gl.domElement.getBoundingClientRect();
    const box = svg.getBoundingClientRect();
    const camDir = new THREE.Vector3();
    const scr = pts.map((p) => {
      if (!p) return null;
      const w = g.localToWorld(p.point.clone());
      const n = p.normal.clone().transformDirection(g.matrixWorld);
      const toCam = camera.position.clone().sub(w).normalize();
      const s2 = w.project(camera);
      return { x: rect.left - box.left + ((s2.x + 1) / 2) * rect.width, y: rect.top - box.top + ((1 - s2.y) / 2) * rect.height, vis: n.dot(toCam) > 0.05 };
    });
    void camDir;
    const ok = scr.filter((p) => p && p.vis).length;
    window.__sc1sel = { pts: pts.filter(Boolean).length, vis: ok };
    if (ok < 10) return hide();
    svg.style.display = '';
    const poly = svg.querySelector('.sel-line');
    poly.setAttribute('points', scr.map((p) => (p ? `${p.x.toFixed(1)},${p.y.toFixed(1)}` : '')).filter(Boolean).join(' '));
    for (const h of HANDLES) {
      const el = svg.querySelector(`[data-h="${h}"]`);
      const p = scr[HANDLE_AT[h]];
      if (!el) continue;
      if (!p || !p.vis) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      el.setAttribute('cx', p.x.toFixed(1));
      el.setAttribute('cy', p.y.toFixed(1));
    }
    if (editor.bar) {
      const ys = scr.filter(Boolean).map((p) => p.y);
      const xs = scr.filter(Boolean).map((p) => p.x);
      editor.bar.style.display = '';
      editor.bar.style.left = `${((Math.min(...xs) + Math.max(...xs)) / 2).toFixed(1)}px`;
      editor.bar.style.top = `${(Math.min(...ys) - 12).toFixed(1)}px`;
    }
  });
  return null;
}

// Si hay errores del renderer, los muestra para depurar
function Diagnostics() {
  const { gl, scene, size } = useThree();
  const frames = useRef(0);
  const done = useRef(false);
  useFrame((state) => {
    frames.current++;
    if (done.current || frames.current < 10 || state.clock.elapsedTime < 3) return;
    done.current = true;
    const ctx = gl.getContext();
    let meshes = 0;
    scene.traverse((o) => o.isMesh && meshes++);
    const ext = ctx.getExtension('WEBGL_debug_renderer_info');
    const errors = diagLog.filter((l) => l.startsWith('[error]') && /Shader Error|WebGLProgram|CONTEXT_LOST/.test(l));
    const info = {
      meshes,
      programs: gl.info.programs ? gl.info.programs.length : null,
      buffer: `${ctx.drawingBufferWidth}x${ctx.drawingBufferHeight} (css ${Math.round(size.width)}x${Math.round(size.height)})`,
      renderer: ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER),
      log: errors.slice(-8),
    };
    window.__sc1diag = info;
    if (errors.length) useStore.getState().set({ diag: info });
  });
  return null;
}

function Effects() {
  const quality = useStore((s) => s.quality);
  if (quality === 'baja') return null;
  return (
    <EffectComposer multisampling={0} disableNormalPass>
      <N8AO aoRadius={0.09} distanceFalloff={0.5} intensity={2.4} quality="medium" halfRes color="#05060a" />
      <Bloom intensity={0.32} luminanceThreshold={0.82} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette offset={0.35} darkness={0.45} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
  );
}

export default function Scene() {
  const quality = useStore((s) => s.quality);
  return (
    <Canvas
      className="gl"
      shadows="soft"
      dpr={quality === 'baja' ? [1, 1.25] : [1, 2]}
      camera={{ fov: 30, position: [0.4, 0.5, 1.9], near: 0.05, far: 20 }}
      gl={{ antialias: quality === 'baja', alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        glRef.current = gl;
      }}
    >
      <Backdrop />
      <hemisphereLight args={['#c9d3ff', '#15171f', 0.55]} />
      <directionalLight
        position={[1.1, 2.3, 2.0]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={6}
        shadow-camera-left={-0.7}
        shadow-camera-right={0.7}
        shadow-camera-top={0.9}
        shadow-camera-bottom={-0.3}
        shadow-camera-near={0.5}
        shadow-camera-far={6}
      />
      <spotLight position={[-1.5, 1.2, -1.6]} color="#3a6bff" intensity={14} angle={0.7} penumbra={1} />
      <spotLight position={[1.5, 1.2, -1.6]} color="#ffb62e" intensity={10} angle={0.7} penumbra={1} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 2.2, 3]} scale={[5, 2.5, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[4, 4, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#3a6bff" position={[-3, 1, -1.5]} rotation-y={Math.PI / 2.5} scale={[4, 2.5, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffb62e" position={[3, 1, -1.5]} rotation-y={-Math.PI / 2.5} scale={[4, 2.5, 1]} />
      </Environment>
      <Garment />
      <Floor />
      <ContactShadows position={[0, FLOOR_Y, 0]} opacity={0.75} scale={1.4} blur={2.6} far={0.9} resolution={512} color="#000000" />
      <Controls />
      <SelectionFrame />
      <Diagnostics />
      <Effects />
    </Canvas>
  );
}
