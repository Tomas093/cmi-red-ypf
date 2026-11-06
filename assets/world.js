/* =========================================================================
   world.js · La pampa, la ruta y las estaciones (maqueta 3D).
   Unidades: metros. X corre a lo largo de la ruta; Z crece hacia el norte.
   La ruta (RN) va en z = 40. Todo lo de YPF queda al sur (z < 34).

   Ubicaciones (x):
     YPF Núcleo con FULL y Boxes ....... 0
     Refiplus .......................... -170
     YPF Black + McDonald's ............ +175
     Competencia (Shell, Axion, Puma,
     estación blanca) .................. -300 a -405
   ========================================================================= */
(function () {
  const W = (window.WORLD = { anim: [], spots: {} });
  const ROAD_Z = 40;
  let SEED = 20261105;
  const rnd = () => { SEED = (SEED + 0x6d2b79f5) | 0; let t = Math.imul(SEED ^ (SEED >>> 15), 1 | SEED); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* ---------- color y materiales ---------- */
  const C = (h) => new THREE.Color(h).convertSRGBToLinear();
  const mats = new Map();
  function M(hex, o = {}) {
    const key = hex + JSON.stringify(o);
    if (mats.has(key)) return mats.get(key);
    const m = new THREE.MeshStandardMaterial({
      color: C(hex),
      roughness: o.r ?? 0.75,
      metalness: o.m ?? 0,
      envMapIntensity: o.env ?? 0.9,
      transparent: !!o.op,
      opacity: o.op ?? 1,
      side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
    });
    if (o.e) { m.emissive = C(o.e); m.emissiveIntensity = o.ei ?? 1; }
    if (o.op) m.depthWrite = false;
    mats.set(key, m);
    return m;
  }
  W.M = M; W.C = C;

  /* ---------- geometría ---------- */
  const geos = new Map();
  function G(key, make) { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); }
  function put(mesh, x, y, z, p, sh = true) {
    mesh.position.set(x, y, z);
    mesh.castShadow = sh; mesh.receiveShadow = true;
    (p || W.scene).add(mesh);
    return mesh;
  }
  // caja; r > 0 redondea los bordes
  function box(w, h, d, mat, x, y, z, p, r = 0, sh = true) {
    const g = r > 0
      ? G(`rb${w},${h},${d},${r}`, () => new THREE.RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)))
      : G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
    return put(new THREE.Mesh(g, mat), x, y, z, p, sh);
  }
  function cyl(rt, rb, h, mat, x, y, z, p, seg = 16, sh = true) {
    const g = G(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
    return put(new THREE.Mesh(g, mat), x, y, z, p, sh);
  }
  function sph(r, mat, x, y, z, p, seg = 16) {
    const g = G(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75)));
    return put(new THREE.Mesh(g, mat), x, y, z, p);
  }
  function plane(w, h, mat, x, y, z, ry = 0, p, sh = false) {
    const m = put(new THREE.Mesh(G(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h)), mat), x, y, z, p, sh);
    m.rotation.y = ry; return m;
  }
  function floor(w, d, mat, x, y, z, p) {
    const m = put(new THREE.Mesh(G(`p${w},${d}`, () => new THREE.PlaneGeometry(w, d)), mat), x, y, z, p, false);
    m.rotation.x = -Math.PI / 2; return m;
  }
  W.box = box; W.cyl = cyl;

  /* ---------- texturas dibujadas en canvas ---------- */
  function tex(w, h, draw, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  function texMat(t, o = {}) {
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: o.r ?? 0.7, metalness: o.m ?? 0, transparent: !!o.alpha, side: o.ds ? THREE.DoubleSide : THREE.FrontSide });
    if (o.glow) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = t; m.emissiveIntensity = o.glow * 0.45; }
    return m;
  }
  const IMG = {};
  W.loadImages = () => Promise.all(Object.entries(window.LOGOS).map(([k, src]) => new Promise((res) => {
    const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = res; im.src = src;
  })));
  function fitImage(g, im, x, y, w, h) {
    if (!im) return;
    const s = Math.min(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s;
    g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }
  const FONT = (wt, px, cond = true) => `${wt} ${px}px "${cond ? 'Barlow Condensed' : 'Barlow'}", Arial, sans-serif`;
  function signTex(w, h, bg, draw) { return tex(w, h, (g, W2, H2) => { g.fillStyle = bg; g.fillRect(0, 0, W2, H2); draw(g, W2, H2); }); }
  function textSign(text, bg, fg, w = 512, h = 128, font) {
    return signTex(w, h, bg, (g, W2, H2) => { g.fillStyle = fg; g.font = font || FONT(800, H2 * 0.62); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W2 / 2, H2 * 0.54); });
  }
  function logoSign(key, bg, w = 512, h = 256, pad = 0.12) {
    return signTex(w, h, bg, (g, W2, H2) => fitImage(g, IMG[key], W2 * pad, H2 * pad, W2 * (1 - 2 * pad), H2 * (1 - 2 * pad)));
  }
  W.tex = tex; W.texMat = texMat; W.textSign = textSign; W.logoSign = logoSign;

  /* ---------- materiales comunes ---------- */
  let MAT;
  function commonMats() {
    MAT = {
      concrete: M('#b9bbbb', { r: 0.92 }),
      curb: M('#d9d9d4', { r: 0.9 }),
      white: M('#f4f5f5', { r: 0.55 }),
      offwhite: M('#e9ebec', { r: 0.6 }),
      silver: M('#c9ccd0', { r: 0.35, m: 0.6 }),
      steel: M('#d8dbde', { r: 0.28, m: 0.85 }),
      darkMetal: M('#2b2f36', { r: 0.45, m: 0.5 }),
      charcoal: M('#1e2126', { r: 0.6, m: 0.2 }),
      ypf: M('#0a4686', { r: 0.45 }),
      ypfBright: M('#2e66c6', { r: 0.4 }),
      navy: M('#1b2433', { r: 0.5 }),
      glass: M('#a9c9de', { r: 0.05, m: 0.1, op: 0.32, env: 1.4 }),
      glassDark: M('#2a3640', { r: 0.08, m: 0.2, op: 0.55, env: 1.5 }),
      rubber: M('#17191c', { r: 0.9 }),
      hose: M('#141518', { r: 0.6 }),
      wood: M('#9a7350', { r: 0.8 }),
      woodLight: M('#c89b6a', { r: 0.7 }),
      grass: M('#6f9f47', { r: 1 }),
      asphalt: M('#3c3f43', { r: 0.95 }),
      yellow: M('#f2c500', { r: 0.6 }),
      red: M('#c8352c', { r: 0.55 }),
      warmLight: M('#fff4dc', { e: '#fff1d6', ei: 1.2 }),
      coolLight: M('#ffffff', { e: '#f5fbff', ei: 1.3 }),
    };
    W.MAT = MAT;
  }

  /* =========================================================================
     PERSONAS Y AUTOS
     ========================================================================= */
  const SKINS = ['#e8c4a2', '#c99872', '#a8754e', '#f0d2b6'];
  // pose: 'stand' | 'pump' (brazo derecho estirado hacia adelante) | 'walk' | 'sit' | 'tablet'
  function person({ shirt = '#3d6fb0', sleeve, pants = '#2f3540', skin = SKINS[0], hair = '#2a2018', cap, pose = 'stand', scale = 1 } = {}, p) {
    const g = new THREE.Group();
    const sk = M(skin, { r: 0.7 }), sh = M(shirt, { r: 0.85 }), sl = M(sleeve || shirt, { r: 0.85 }), pa = M(pants, { r: 0.9 });
    const sit = pose === 'sit';
    // piernas
    if (sit) {
      box(0.16, 0.16, 0.5, pa, -0.1, 0.47, 0.18, g, 0.06); box(0.16, 0.16, 0.5, pa, 0.1, 0.47, 0.18, g, 0.06);
      box(0.15, 0.45, 0.16, pa, -0.1, 0.22, 0.42, g, 0.06); box(0.15, 0.45, 0.16, pa, 0.1, 0.22, 0.42, g, 0.06);
    } else {
      const sw = pose === 'walk' ? 0.25 : 0;
      const l1 = box(0.16, 0.86, 0.17, pa, -0.1, 0.43, 0, g, 0.06), l2 = box(0.16, 0.86, 0.17, pa, 0.1, 0.43, 0, g, 0.06);
      l1.rotation.x = sw; l2.rotation.x = -sw;
      box(0.17, 0.08, 0.27, M('#1e1f22'), -0.1, 0.04, 0.04, g, 0.03); box(0.17, 0.08, 0.27, M('#1e1f22'), 0.1, 0.04, 0.04, g, 0.03);
    }
    const hip = sit ? 0.5 : 0.86;
    box(0.42, 0.62, 0.24, sh, 0, hip + 0.31, 0, g, 0.1);          // torso
    box(0.16, 0.1, 0.16, sk, 0, hip + 0.66, 0, g, 0.05);          // cuello
    sph(0.13, sk, 0, hip + 0.83, 0, g, 18);                         // cabeza
    const hr = sph(0.135, M(hair, { r: 0.9 }), 0, hip + 0.87, -0.015, g, 18); hr.scale.set(1, 0.72, 1);
    if (cap) { const c = cyl(0.14, 0.145, 0.09, M(cap), 0, hip + 0.93, 0, g, 18); box(0.2, 0.025, 0.14, M(cap), 0, hip + 0.9, 0.12, g); c.rotation.x = -0.08; }
    // brazos (pivote en el hombro)
    function arm(side, rx, rz) {
      const a = new THREE.Group(); a.position.set(side * 0.27, hip + 0.58, 0); g.add(a);
      box(0.13, 0.58, 0.14, sl, 0, -0.29, 0, a, 0.06);
      sph(0.065, sk, 0, -0.6, 0, a, 12);
      a.rotation.set(rx, 0, rz); return a;
    }
    if (pose === 'pump') { arm(1, -1.15, 0.05); arm(-1, -0.2, -0.05); }
    else if (pose === 'nozzle') { arm(1, -0.55, 0.08); arm(-1, -0.12, -0.05); }
    else if (pose === 'tablet') { arm(1, -0.95, 0.35); arm(-1, -0.95, -0.35); box(0.3, 0.02, 0.22, M('#20242a'), 0, hip + 0.38, 0.38, g).rotation.x = -0.9; }
    else if (pose === 'walk') { arm(1, 0.3, 0.06); arm(-1, -0.3, -0.06); }
    else if (sit) { arm(1, -0.9, 0.05); arm(-1, -0.9, -0.05); }
    else { arm(1, 0.02, 0.07); arm(-1, 0.02, -0.07); }
    g.scale.setScalar(scale);
    (p || W.scene).add(g);
    return g;
  }
  W.person = person;
  // uniformes
  const PLAYERO = { shirt: '#8e979f', sleeve: '#0a4686', pants: '#3a3f46', cap: '#0a4686' };
  const MECANICO = { shirt: '#0a4686', sleeve: '#2c3138', pants: '#2c3138' };

  /* auto: perfil lateral extruido, con habitáculo, vidrios, ruedas y luces.
     El auto mira hacia +x; su lado derecho queda en +z. */
  function carProfile(len, kind) {
    const s = new THREE.Shape(), L = len / 2;
    if (kind === 'pickup') {
      s.moveTo(-L, 0.32); s.lineTo(-L, 0.98); s.lineTo(L - 0.95, 1.0); s.lineTo(L - 0.25, 0.86); s.lineTo(L, 0.62); s.lineTo(L, 0.32);
    } else {
      s.moveTo(-L, 0.32); s.lineTo(-L + 0.05, 0.84); s.quadraticCurveTo(-L + 0.2, 0.95, -L + 0.6, 0.96);
      s.lineTo(L - 0.7, 0.92); s.quadraticCurveTo(L - 0.1, 0.84, L, 0.62); s.lineTo(L, 0.32);
    }
    // pasaruedas
    const wx = L - 0.78;
    s.lineTo(wx + 0.42, 0.32); s.absarc(wx, 0.32, 0.42, 0, Math.PI, false);
    s.lineTo(-wx + 0.42, 0.32); s.absarc(-wx, 0.32, 0.42, 0, Math.PI, false);
    s.lineTo(-L, 0.32);
    return s;
  }
  function cabinProfile(len, kind) {
    const s = new THREE.Shape(), L = len / 2;
    if (kind === 'pickup') { s.moveTo(-0.55, 0.98); s.lineTo(-0.45, 1.68); s.lineTo(0.75, 1.68); s.lineTo(1.25, 0.99); }
    else if (kind === 'suv') { s.moveTo(-L + 0.25, 0.95); s.lineTo(-L + 0.35, 1.68); s.lineTo(0.55, 1.7); s.lineTo(1.25, 0.93); }
    else { s.moveTo(-L + 0.55, 0.95); s.quadraticCurveTo(-L + 0.75, 1.42, -0.2, 1.46); s.lineTo(0.35, 1.46); s.quadraticCurveTo(0.8, 1.42, 1.3, 0.92); }
    s.closePath(); return s;
  }
  // perfiles laterales (x hacia adelante) de modelos reales, simplificados
  const MODELS = {
    yaris: { len: 4.0, wid: 1.82, r: 0.33, wx: 1.25, ar: 0.42,
      body: [[-1.98, 0.34], [-2.0, 0.64], [-1.93, 0.96], [-1.63, 1.36], [-0.6, 1.46], [0.2, 1.44], [0.44, 1.39], [1.13, 0.99], [1.86, 0.84], [2.0, 0.63], [1.98, 0.34]],
      win: [[-1.52, 1.0], [-1.43, 1.3], [-0.55, 1.39], [0.36, 1.36], [1.0, 1.0]], pillar: -0.42, shield: [[0.44, 1.39], [1.13, 0.99]], rear: [[-1.63, 1.36], [-1.93, 0.96]] },
    amarok: { len: 5.25, wid: 1.95, r: 0.4, wx: 1.65, ar: 0.5,
      body: [[-2.6, 0.45], [-2.62, 1.14], [-0.97, 1.14], [-0.93, 1.84], [0.4, 1.86], [0.62, 1.82], [1.36, 1.2], [2.45, 1.1], [2.62, 0.95], [2.6, 0.45]],
      win: [[-0.84, 1.22], [-0.8, 1.73], [0.5, 1.75], [1.24, 1.22]], pillar: 0.12, shield: [[0.62, 1.82], [1.36, 1.2]], rear: null, bed: true },
  };
  function carV2(color, kind, p) {
    const S = MODELS[kind], g = new THREE.Group();
    const paint = M(color, { r: 0.25, m: 0.5, env: 1.3 }), glass = M('#18222b', { r: 0.05, m: 0.5, env: 1.8 }), glassDS = M('#18222b', { r: 0.05, m: 0.5, env: 1.8, ds: true }), trim = M('#16181b', { r: 0.6 });
    const body = new THREE.Mesh(G('v2' + kind, () => {
      const sh = new THREE.Shape(); S.body.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
      // pasaruedas
      const yb = S.body[0][1];
      sh.lineTo(S.wx + S.ar, yb); sh.absarc(S.wx, yb, S.ar, 0, Math.PI, false);
      sh.lineTo(-S.wx + S.ar, yb); sh.absarc(-S.wx, yb, S.ar, 0, Math.PI, false); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: S.wid - 0.24, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 5, curveSegments: 14 });
      geo.translate(0, 0, -(S.wid - 0.24) / 2); return geo;
    }), paint);
    put(body, 0, 0, 0, g);
    const zs = S.wid / 2 + 0.004;
    // ventanillas laterales con parante
    const wg = G('w2' + kind, () => { const sh = new THREE.Shape(); S.win.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath(); return new THREE.ShapeGeometry(sh); });
    for (const sd of [1, -1]) {
      const w = new THREE.Mesh(wg, glass); w.position.z = sd * zs; if (sd < 0) { w.rotation.y = Math.PI; w.scale.x = -1; } g.add(w);
      box(0.09, 0.42, 0.01, paint, S.pillar, 1.18 + (kind === 'amarok' ? 0.28 : 0), sd * (zs + 0.003), g, 0, false);
      box(1.1, 0.012, 0.01, trim, S.pillar + 0.45, 0.9 + (kind === 'amarok' ? 0.12 : 0), sd * (zs + 0.003), g, 0, false);   // línea de puerta
      box(0.012, 0.5, 0.01, trim, S.pillar + 1.0, 0.68 + (kind === 'amarok' ? 0.2 : 0), sd * (zs + 0.003), g, 0, false);
      const mir = box(0.16, 0.12, 0.2, kind === 'yaris' ? trim : paint, S.shield[1][0] - 0.1, S.shield[1][1] + 0.06, sd * (zs + 0.09), g, 0.03);
    }
    // parabrisas y luneta como planos inclinados
    const slope = ([[x1, y1], [x2, y2]]) => { const geo = new THREE.PlaneGeometry(Math.hypot(x2 - x1, y2 - y1), S.wid - 0.34); geo.rotateX(-Math.PI / 2); geo.rotateZ(Math.atan2(y2 - y1, x2 - x1)); geo.translate((x1 + x2) / 2, (y1 + y2) / 2 + 0.012, 0); g.add(new THREE.Mesh(geo, glassDS)); };
    slope(S.shield); if (S.rear) slope(S.rear);
    const L = S.len / 2;
    // frente: parrilla, faros; cola: ópticas
    const fy = kind === 'amarok' ? 0.8 : 0.5;
    box(0.06, kind === 'amarok' ? 0.4 : 0.22, S.wid * 0.5, trim, L + 0.06, fy, 0, g, 0.02);
    if (kind === 'amarok') { box(0.05, 0.06, S.wid * 0.62, M('#d6d9dc', { m: 0.9, r: 0.2 }), L + 0.09, 0.86, 0, g); box(0.2, 0.08, S.wid * 0.9, trim, L - 0.05, 0.5, 0, g); }
    for (const sd of [1, -1]) {
      const hl = box(0.06, 0.1, 0.36, M('#f4f7fa', { e: '#ffffff', ei: 0.6, r: 0.1 }), L + 0.03, fy + (kind === 'amarok' ? 0.14 : 0.2), sd * (S.wid / 2 - 0.3), g, 0.02, false); hl.rotation.y = sd * 0.25;
      box(0.06, kind === 'amarok' ? 0.42 : 0.1, kind === 'amarok' ? 0.14 : 0.34, M('#b5181c', { e: '#8a0b0e', ei: 0.7 }), -L - 0.04, kind === 'amarok' ? 0.85 : 0.84, sd * (S.wid / 2 - 0.2), g, 0.02, false);
    }
    box(0.03, 0.12, 0.46, MAT.white, L + 0.08, kind === 'amarok' ? 0.55 : 0.4, 0, g, 0, false);
    if (kind === 'yaris') {
      box(0.32, 0.04, S.wid - 0.4, trim, -1.68, 1.39, 0, g, 0.02);                          // alerón
      for (const wx of [S.wx, -S.wx]) for (const sd of [1, -1]) { const f = box(0.95, 0.12, 0.08, trim, wx, 0.78, sd * (zs + 0.02), g, 0.03); }   // guardabarros ensanchados
      for (const sd of [1, -1]) box(0.28, 0.07, 0.07, M('#c9ccd0', { m: 0.9, r: 0.2 }), -L - 0.02, 0.42, sd * 0.35, g);   // escapes
    }
    if (S.bed) { box(1.55, 0.05, S.wid - 0.3, trim, -1.78, 1.1, 0, g); box(1.3, 0.08, 0.08, MAT.silver, -0.82, 1.9, 0, g); for (const sd of [1, -1]) box(1.8, 0.06, 0.18, trim, 0.2, 0.5, sd * (zs + 0.06), g, 0.02); }
    // ruedas con llanta de 5 rayos
    const rimM = M(kind === 'yaris' ? '#2a2c30' : '#c9ccd0', { m: 0.8, r: 0.3 });
    for (const wx of [S.wx, -S.wx]) for (const sd of [1, -1]) {
      const wg2 = new THREE.Group(); wg2.position.set(wx, S.r, sd * (S.wid / 2 - 0.13)); g.add(wg2);
      const t = cyl(S.r, S.r, 0.26, MAT.rubber, 0, 0, 0, wg2, 28); t.rotation.x = Math.PI / 2;
      const rm = cyl(S.r * 0.64, S.r * 0.64, 0.27, rimM, 0, 0, 0, wg2, 24); rm.rotation.x = Math.PI / 2;
      for (let k = 0; k < 5; k++) { const sp = box(S.r * 1.2, 0.06, 0.02, rimM, 0, 0, sd * 0.14, wg2, 0, false); sp.rotation.z = (k / 5) * Math.PI * 2; }
      const hub = cyl(0.05, 0.05, 0.28, M('#b9bec3', { m: 0.9 }), 0, 0, 0, wg2, 10); hub.rotation.x = Math.PI / 2;
    }
    g.userData = { len: S.len, wid: S.wid };
    (p || W.scene).add(g); return g;
  }
  function car(color = '#b8bec6', kind = 'sedan', p) {
    if (kind === 'pickup') kind = 'amarok';
    if (MODELS[kind]) return carV2(color, kind, p);
    const g = new THREE.Group();
    const len = kind === 'pickup' ? 5.2 : kind === 'suv' ? 4.6 : 4.3, wid = kind === 'sedan' ? 1.78 : 1.86;
    const paint = M(color, { r: 0.28, m: 0.45, env: 1.2 });
    const body = new THREE.Mesh(G(`car${kind}`, () => {
      const geo = new THREE.ExtrudeGeometry(carProfile(len, kind), { depth: wid - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3, steps: 1, curveSegments: 10 });
      geo.translate(0, 0, -(wid - 0.16) / 2); return geo;
    }), paint);
    put(body, 0, 0, 0, g);
    const cab = new THREE.Mesh(G(`cab${kind}`, () => {
      const geo = new THREE.ExtrudeGeometry(cabinProfile(len, kind), { depth: wid - 0.36, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 8 });
      geo.translate(0, 0, -(wid - 0.36) / 2); return geo;
    }), M('#1f2a33', { r: 0.08, m: 0.4, env: 1.6 }));
    put(cab, 0, 0, 0, g);
    // techo en color de carrocería (deja ver los vidrios abajo)
    const roofLen = kind === 'pickup' ? 1.1 : kind === 'suv' ? 1.9 : 1.15;
    const roofX = kind === 'pickup' ? 0.15 : kind === 'suv' ? -0.45 : 0.05;
    box(roofLen, 0.07, wid - 0.42, paint, roofX, kind === 'sedan' ? 1.47 : 1.71, 0, g, 0.03);
    if (kind === 'pickup') box(1.75, 0.08, wid - 0.2, M('#2a2d31', { r: 0.8 }), -1.55, 0.9, 0, g);
    // ruedas
    const wx = len / 2 - 0.78;
    for (const [x, z] of [[wx, 1], [-wx, 1], [wx, -1], [-wx, -1]]) {
      const tire = cyl(0.36, 0.36, 0.24, MAT.rubber, x, 0.36, z * (wid / 2 - 0.08), g, 20); tire.rotation.x = Math.PI / 2;
      const rim = cyl(0.22, 0.22, 0.25, MAT.silver, x, 0.36, z * (wid / 2 - 0.07), g, 14, false); rim.rotation.x = Math.PI / 2;
    }
    // luces y patente
    box(0.06, 0.12, 0.36, M('#fffaf0', { e: '#fff7e8', ei: 0.5 }), len / 2 + 0.02, 0.7, wid / 2 - 0.32, g, 0, false);
    box(0.06, 0.12, 0.36, M('#fffaf0', { e: '#fff7e8', ei: 0.5 }), len / 2 + 0.02, 0.7, -wid / 2 + 0.32, g, 0, false);
    box(0.06, 0.12, 0.34, M('#b5181c', { e: '#8a0b0e', ei: 0.6 }), -len / 2 - 0.02, 0.78, wid / 2 - 0.3, g, 0, false);
    box(0.06, 0.12, 0.34, M('#b5181c', { e: '#8a0b0e', ei: 0.6 }), -len / 2 - 0.02, 0.78, -wid / 2 + 0.3, g, 0, false);
    box(0.04, 0.13, 0.5, MAT.white, len / 2 + 0.03, 0.46, 0, g, 0, false);
    box(0.04, 0.13, 0.5, MAT.white, -len / 2 - 0.03, 0.5, 0, g, 0, false);
    // espejos
    box(0.12, 0.1, 0.18, paint, 0.95, 1.02, wid / 2 + 0.05, g, 0.03); box(0.12, 0.1, 0.18, paint, 0.95, 1.02, -wid / 2 - 0.05, g, 0.03);
    g.userData = { len, wid };
    (p || W.scene).add(g);
    return g;
  }
  W.car = car;
  function placeCar(color, kind, x, z, ry, p) { const c = car(color, kind, p); c.position.set(x, 0, z); c.rotation.y = ry; return c; }

  // camión con acoplado (muy de ruta argentina)
  function truck(color = '#d9d9d9', p) {
    const g = new THREE.Group();
    box(2.2, 2.3, 2.45, M(color, { r: 0.4, m: 0.3 }), 6.2, 1.85, 0, g, 0.12);
    box(0.1, 0.9, 2.1, M('#26323c', { r: 0.1, m: 0.4 }), 7.32, 2.35, 0, g, 0.02);
    box(13, 2.7, 2.5, M('#f2f2f0', { r: 0.6 }), -1.6, 2.15, 0, g, 0.08);
    box(13.1, 0.25, 2.55, M('#2b6cb3'), -1.6, 0.85, 0, g);
    box(15, 0.3, 1.2, MAT.darkMetal, -0.6, 0.62, 0, g);
    for (const x of [6.4, 4.4, -4.5, -5.8, -7.1]) for (const z of [1.08, -1.08]) { const t = cyl(0.5, 0.5, 0.36, MAT.rubber, x, 0.5, z, g, 18); t.rotation.x = Math.PI / 2; }
    (p || W.scene).add(g); return g;
  }

  /* vacas: Angus negras y Hereford (coloradas de cara blanca) */
  function cow(kind, x, z, ry) {
    const g = new THREE.Group();
    const coat = kind === 'angus' ? M('#1c1b1a', { r: 0.95 }) : M('#8b3a1e', { r: 0.95 });
    box(1.9, 0.85, 0.82, coat, 0, 1.0, 0, g, 0.3);
    const head = box(0.62, 0.5, 0.5, coat, 1.15, 1.13, 0, g, 0.16); head.rotation.z = -0.35;
    if (kind !== 'angus') { const f = box(0.06, 0.42, 0.36, M('#efe9df', { r: 0.95 }), 1.45, 1.03, 0, g, 0.02); f.rotation.z = -0.35; box(0.5, 0.18, 0.5, M('#efe9df', { r: 0.95 }), 0.2, 0.62, 0, g, 0.08); }
    box(0.25, 0.24, 0.44, M('#2a2522', { r: 0.9 }), 1.43, 0.94, 0, g, 0.08);
    for (const [lx, lz] of [[0.65, 0.26], [0.65, -0.26], [-0.65, 0.26], [-0.65, -0.26]]) box(0.17, 0.66, 0.17, coat, lx, 0.33, lz, g, 0.06);
    box(0.08, 0.6, 0.08, coat, -0.98, 0.85, 0, g).rotation.z = 0.25;
    g.position.set(x, 0, z); g.rotation.y = ry; W.scene.add(g); return g;
  }

  /* =========================================================================
     PAISAJE: campo llano, alambrados, eucaliptos, silos, molino, rollos
     ========================================================================= */
  function landscape() {
    const sc = W.scene;
    // suelo de pasto con leve variación
    const grassT = tex(512, 512, (g, w, h) => {
      g.fillStyle = '#7aa94f'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? 'rgba(70,110,40,0.10)' : 'rgba(190,210,120,0.10)'; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2 + rnd() * 3); }
    }, [1500, 1500]);
    floor(9000, 9000, texMat(grassT, { r: 1 }), 0, -0.2, 0);

    // potreros: siembras con surcos y rastrojo, lejos de la ruta
    const rowsT = (base, line) => tex(256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = line; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 7); });
    const soja = rowsT('#6f9a3d', '#5d8732'), trigo = rowsT('#cdb878', '#bfa765'), maiz = rowsT('#7da44a', '#6a913d');
    const plots = [
      [-560, 150, 260, 150, soja], [-260, 215, 300, 160, trigo], [80, 170, 280, 170, soja], [420, 150, 300, 140, maiz],
      [-640, -130, 300, 160, trigo], [-300, -150, 260, 150, maiz], [520, -140, 320, 170, soja], [260, -170, 180, 120, trigo],
    ];
    for (const [x, z, w, d, t] of plots) {
      const tt = t.clone(); tt.needsUpdate = true; tt.repeat.set(w / 6, d / 6);
      const m = floor(w, d, texMat(tt, { r: 1 }), x, -0.1, z); m.receiveShadow = true;
    }

    // banquina de ripio y verde junto a la ruta
    const gravelT = tex(256, 256, (g, w, h) => { g.fillStyle = '#b3a687'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(90,80,60,.25)' : 'rgba(230,220,200,.25)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); } }, [900, 1]);
    floor(3600, 2.6, texMat(gravelT, { r: 1 }), 0, 0.0, ROAD_Z - 5.0);
    floor(3600, 2.6, texMat(gravelT, { r: 1 }), 0, 0.0, ROAD_Z + 5.0);

    // asfalto con líneas: borde blanco y eje amarillo discontinuo
    const roadT = tex(1024, 128, (g, w, h) => {
      g.fillStyle = '#404347'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.05)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
      g.fillStyle = '#f1f1ea'; g.fillRect(0, 6, w, 5); g.fillRect(0, h - 11, w, 5);
      g.fillStyle = '#e8b81c'; for (let x = 0; x < w; x += 128) g.fillRect(x, h / 2 - 3, 52, 6);
    }, [180, 1]);
    floor(3600, 7.6, texMat(roadT, { r: 0.92 }), 0, 0.03, ROAD_Z);

    // alambrado de 5 hilos con postes de madera (con cortes frente a las estaciones)
    const postGeo = new THREE.CylinderGeometry(0.07, 0.08, 1.35, 7);
    const posts = [];
    const wires = [];
    function fence(z, x0, x1, gaps) {
      let segStart = x0;
      const inGap = (x) => gaps.some(([a, b]) => x > a && x < b);
      for (let x = x0; x <= x1; x += 5) {
        if (inGap(x)) { if (segStart !== null && x - segStart > 5) wires.push([segStart, x - 5, z]); segStart = null; continue; }
        if (segStart === null) segStart = x;
        posts.push([x, z]);
      }
      if (segStart !== null && x1 - segStart > 5) wires.push([segStart, x1, z]);
    }
    // sólo del lado del campo (norte); cortes frente a la estación rival y al terreno en obra
    fence(ROAD_Z + 13, -1200, 1200, [[18, 63], [64, 96]]);
    const postInst = new THREE.InstancedMesh(postGeo, MAT.wood, posts.length);
    const m4 = new THREE.Matrix4();
    posts.forEach(([x, z], i) => { m4.makeTranslation(x, 0.67, z); postInst.setMatrixAt(i, m4); });
    postInst.castShadow = true; sc.add(postInst);
    const wireMat = M('#9aa0a6', { r: 0.4, m: 0.7 });
    for (const [a, b, z] of wires) for (let k = 0; k < 5; k++) {
      const w = box(b - a, 0.012, 0.012, wireMat, (a + b) / 2, 0.3 + k * 0.22, z, null, 0, false);
    }

    // cortinas de eucaliptos (instanciadas)
    const trees = [];
    const row = (x0, x1, z, step, jit) => { for (let x = x0; x <= x1; x += step) trees.push([x + (rnd() - 0.5) * jit, z + (rnd() - 0.5) * jit, 0.85 + rnd() * 0.4]); };
    row(-900, 900, -250, 7, 3); row(-900, 900, 255, 7, 3);
    row(-250, -120, 75, 8, 2); row(260, 620, 70, 8, 2);
    row(-120, 120, -60, 6, 2);                  // detrás de la YPF
    row(150, 220, -40, 9, 2);
    for (let i = 0; i < 40; i++) trees.push([-900 + rnd() * 1800, 300 + rnd() * 300, 0.8 + rnd() * 0.5]);
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 1, 7); trunkGeo.translate(0, 0.5, 0);
    const leafGeo = new THREE.IcosahedronGeometry(1, 1);
    const trunks = new THREE.InstancedMesh(trunkGeo, M('#b9a88f', { r: 0.85 }), trees.length);
    const leaves = new THREE.InstancedMesh(leafGeo, M('#4d6b4a', { r: 0.95 }), trees.length * 4);
    const leaves2 = new THREE.InstancedMesh(leafGeo, M('#5c7a55', { r: 0.95 }), trees.length * 2);
    const q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    trees.forEach(([x, z, s], i) => {
      const H = 18 * s;
      m4.compose(pv.set(x, 0, z), q.identity(), sv.set(s, H * 0.75, s)); trunks.setMatrixAt(i, m4);
      for (let k = 0; k < 4; k++) {
        const y = H * (0.5 + k * 0.13), r = (2.4 - k * 0.35) * s;
        m4.compose(pv.set(x + (rnd() - 0.5) * 1.5, y, z + (rnd() - 0.5) * 1.5), q.setFromAxisAngle(sv.set(0, 1, 0), rnd() * 6), sv.set(r, r * 1.6, r));
        leaves.setMatrixAt(i * 4 + k, m4);
      }
      for (let k = 0; k < 2; k++) {
        const r = 2 * s; m4.compose(pv.set(x + (rnd() - 0.5) * 3, H * (0.7 + k * 0.15), z + (rnd() - 0.5) * 3), q.identity(), sv.set(r, r, r)); leaves2.setMatrixAt(i * 2 + k, m4);
      }
    });
    for (const im of [trunks, leaves, leaves2]) { im.castShadow = true; im.receiveShadow = true; sc.add(im); }

    // silos
    const silo = M('#cfd3d6', { r: 0.35, m: 0.7 });
    for (let i = 0; i < 4; i++) { const x = 330 + i * 8.5; cyl(3.6, 3.6, 13, silo, x, 6.5, 120, null, 28); const c = new THREE.Mesh(new THREE.ConeGeometry(3.7, 2.4, 28), silo); put(c, x, 14.2, 120); }
    box(2.2, 22, 2.2, M('#9aa2a8', { m: 0.5, r: 0.5 }), 360, 11, 114);
    box(30, 3.5, 10, M('#b8bec2', { r: 0.6, m: 0.4 }), 345, 1.75, 108);

    // molino con tanque australiano
    (function windmill(x, z) {
      const g = new THREE.Group(); g.position.set(x, 0, z); sc.add(g);
      const iron = M('#7b8288', { r: 0.5, m: 0.6 });
      for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const l = cyl(0.06, 0.06, 11, iron, a * 0.85, 5.5, b * 0.85, g, 6); l.rotation.z = -a * 0.075; l.rotation.x = b * 0.075; }
      for (let y = 1.5; y < 10; y += 2.2) box(1.9 - y * 0.15, 0.05, 0.05, iron, 0, y, 0, g);
      const hub = new THREE.Group(); hub.position.set(0, 11.2, 0.5); g.add(hub);
      for (let i = 0; i < 18; i++) { const b = box(0.32, 1.5, 0.03, M('#c7ccd0', { m: 0.6, r: 0.4 }), 0, 0.95, 0, hub); const piv = new THREE.Group(); piv.add(b); piv.rotation.z = (i / 18) * Math.PI * 2; b.rotation.y = 0.35; hub.add(piv); }
      box(0.1, 0.9, 2.2, M('#c7ccd0', { m: 0.6 }), 0, 11.2, -1.4, g);
      W.anim.push((t) => { hub.rotation.z = t * 1.6; });
      const tank = cyl(4.2, 4.2, 1.4, M('#a9b0b5', { r: 0.4, m: 0.6 }), 8, 0.7, 2, g, 32);
      cyl(4.0, 4.0, 0.05, M('#5f8ca8', { r: 0.1, m: 0.2 }), 8, 1.35, 2, g, 32);
    })(-70, 92);

    // rollos de pasto
    const roll = M('#c9a35a', { r: 1 });
    for (const [x, z] of [[-150, 110], [-142, 116], [-158, 121], [60, 98], [70, 104], [210, -95], [222, -100], [-470, 98]]) { const r = cyl(0.8, 0.8, 1.2, roll, x, 0.8, z, null, 18); r.rotation.x = Math.PI / 2; r.rotation.z = rnd(); }

    // vacas
    const herds = [[-110, 92, 9], [-20, 112, 8], [-260, 100, 6], [150, 104, 7], [260, 98, 6]];
    const placed = [];
    for (const [hx, hz, n] of herds) for (let i = 0, tries = 0; i < n && tries < 200; tries++) {
      const x = hx + (rnd() - 0.5) * 34, z = hz + (rnd() - 0.5) * 22;
      if (placed.some(([a, b]) => Math.hypot(a - x, b - z) < 3.2)) continue;
      placed.push([x, z]); cow(rnd() < 0.6 ? 'angus' : 'hereford', x, z, rnd() * 6.28); i++;
    }

    // postes de luz a lo largo de la ruta
    const clear = [[-420, -270], [-120, 60], [80, 180]];
    for (let x = -1100; x <= 1100; x += 60) {
      if (clear.some(([a, b]) => x > a && x < b)) continue;
      cyl(0.12, 0.16, 9, MAT.silver, x, 4.5, ROAD_Z - 7.2, null, 8);
      const a = box(2.2, 0.1, 0.12, MAT.silver, x, 8.9, ROAD_Z - 6.2); a.rotation.y = Math.PI / 2;
      box(0.6, 0.12, 0.3, MAT.offwhite, x, 8.85, ROAD_Z - 5.1);
    }
  }

  /* =========================================================================
     PIEZAS DE ESTACIÓN
     ========================================================================= */
  // isla de surtidores: cordón con bolardos en las puntas. Larga en x.
  function island(x, z, p, len = 6) {
    box(len, 0.2, 1.2, MAT.curb, x, 0.1, z, p, 0.05);
    for (const s of [-1, 1]) { cyl(0.12, 0.12, 1, M('#8e959b', { r: 0.4, m: 0.5 }), x + s * (len / 2 - 0.25), 0.7, z, p, 12); }
  }
  // surtidor YPF actual: columna gris oscura, cabezal azul con logo, pantalla en cada cara (caras miran a ±z)
  let ypfHeadTex, screenTex;
  function pumpYPF(x, z, p, opts = {}) {
    const g = new THREE.Group(); g.position.set(x, 0.2, z); (p || W.scene).add(g);
    box(0.95, 0.15, 0.55, MAT.darkMetal, 0, 0.08, 0, g);
    box(0.9, 1.95, 0.5, MAT.darkMetal, 0, 1.1, 0, g, 0.05);
    box(0.92, 0.36, 0.52, MAT.ypf, 0, 2.2, 0, g, 0.04);
    for (const s of [1, -1]) {
      plane(0.7, 0.3, texMat(ypfHeadTex, { glow: 0.35 }), 0, 2.2, s * 0.262, s > 0 ? 0 : Math.PI, g);
      plane(0.5, 0.36, texMat(screenTex, { glow: 0.7 }), 0, 1.55, s * 0.252, s > 0 ? 0 : Math.PI, g);
      // picos de colores
      [[-0.3, '#f2c500'], [0, '#2a8a3c'], [0.3, '#151515']].forEach(([dx, c]) => box(0.11, 0.24, 0.09, M(c, { r: 0.5 }), dx, 1.02, s * 0.29, g, 0.02));
    }
    return g;
  }
  // pico de carga: caño, fuelle, cuerpo, gatillo y empuñadura. Apunta hacia -z (dentro del auto).
  function nozzle(color, p) {
    const g = new THREE.Group(); (p || W.scene).add(g);
    const metal = M('#b9bec3', { r: 0.25, m: 0.9 }), body = M(color, { r: 0.45 }), black = M('#1a1b1e', { r: 0.6 });
    const spout = cyl(0.016, 0.019, 0.22, metal, 0, 0, -0.04, g, 14); spout.rotation.x = Math.PI / 2 + 0.25;
    const boot = cyl(0.034, 0.03, 0.09, black, 0, 0.02, 0.1, g, 14); boot.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.006, 6, 16), black); put(r, 0, 0.02, 0.07 + i * 0.03, g); }
    box(0.075, 0.1, 0.2, body, 0, 0.04, 0.24, g, 0.025);
    box(0.06, 0.05, 0.12, M('#e6e8ea', { r: 0.4 }), 0, 0.1, 0.25, g, 0.02);           // etiqueta del producto
    const grip = box(0.055, 0.2, 0.06, black, 0, -0.04, 0.37, g, 0.025); grip.rotation.x = -0.45;
    const trig = box(0.03, 0.12, 0.025, metal, 0, -0.04, 0.28, g, 0.01); trig.rotation.x = -0.3;
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 18, Math.PI), metal); guard.rotation.set(0, Math.PI / 2, Math.PI); put(guard, 0, -0.02, 0.3, g);
    cyl(0.026, 0.026, 0.1, black, 0, 0.07, 0.44, g, 12).rotation.x = Math.PI / 2;     // ingreso de manguera
    return g;
  }
  W.nozzle = nozzle;
  // manguera desde el surtidor hasta un punto (la boca de carga del auto)
  function hose(from, to, p) {
    const mid = from.clone().lerp(to, 0.5); mid.y = Math.min(from.y, to.y) - 0.45;
    const curve = new THREE.CatmullRomCurve3([from, from.clone().add(new THREE.Vector3(0, -0.4, 0)), mid, to]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.025, 8), MAT.hose);
    m.castShadow = true; (p || W.scene).add(m); return m;
  }

  // canopy con fascia en tres franjas (blanco · azul YPF · plata) y cielorraso con LED
  function canopyYPF(x, z, w, d, h, p) {
    const fasciaT = tex(64, 128, (g, W2, H2) => { g.fillStyle = '#e6e8ea'; g.fillRect(0, 0, W2, H2); g.fillStyle = '#0a4686'; g.fillRect(0, H2 * 0.18, W2, H2 * 0.62); g.fillStyle = '#c9ccd0'; g.fillRect(0, H2 * 0.86, W2, H2 * 0.14); });
    const ceilT = tex(256, 256, (g, W2, H2) => { g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, W2, H2); g.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < W2; i += 16) g.fillRect(i, 0, 2, H2); g.fillStyle = '#ffffff'; for (let y = 40; y < H2; y += 64) g.fillRect(20, y, W2 - 40, 8); }, [w / 8, d / 8]);
    const fM = texMat(fasciaT, { r: 0.5 }), cM = texMat(ceilT, { r: 0.6, glow: 0.25 });
    const roofM = M('#d3d6d8', { r: 0.7 });
    const geo = new THREE.BoxGeometry(w, 1.15, d);
    const canopy = new THREE.Mesh(geo, [fM, fM, roofM, cM, fM, fM]);
    put(canopy, x, h + 0.575, z, p);
    return canopy;
  }

  // tótem de precios YPF (navy, logo arriba, "full", 4 filas LED)
  let totemTex;
  function totemYPF(x, z, ry, p, hgt = 8) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; (p || W.scene).add(g);
    box(1.9, 0.5, 0.7, MAT.concrete, 0, 0.25, 0, g);
    box(1.7, hgt, 0.42, MAT.navy, 0, hgt / 2 + 0.5, 0, g, 0.04);
    for (const s of [1, -1]) plane(1.5, hgt - 0.4, texMat(totemTex, { glow: 0.5 }), 0, hgt / 2 + 0.55, s * 0.215, s > 0 ? 0 : Math.PI, g);
    return g;
  }

  function lampPost(x, z, p) {
    cyl(0.09, 0.12, 7, MAT.silver, x, 3.5, z, p, 8);
    box(0.5, 0.12, 0.25, MAT.offwhite, x, 7.05, z, p);
  }
  function bush(x, z, s = 1, p) {
    const g = sph(0.9 * s, M('#58894a', { r: 1 }), x, 0.55 * s, z, p, 10); g.scale.y = 0.7;
  }
  function planterTree(x, z, p) {
    cyl(0.18, 0.25, 4, M('#8d7a5f'), x, 2, z, p, 7);
    const a = sph(1.8, M('#5d8a4e', { r: 1 }), x, 5, z, p, 10); a.scale.y = 1.15;
    sph(1.3, M('#6c9a5a', { r: 1 }), x + 0.7, 5.8, z + 0.3, p, 10);
  }

  /* =========================================================================
     YPF NÚCLEO (estación principal) en x = 0
     Playa paralela a la ruta; FULL detrás; Boxes al costado.
     ========================================================================= */
  function stationNucleo() {
    const p = new THREE.Group(); W.scene.add(p);
    // playón de hormigón con juntas
    const slabT = tex(512, 512, (g, w, h) => { g.fillStyle = '#c3c5c5'; g.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.05)'; g.fillRect(rnd() * w, rnd() * h, 3, 3); } g.fillStyle = 'rgba(80,80,80,.35)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h); }, [18, 13]);
    floor(90, 62, texMat(slabT, { r: 0.95 }), -2, 0.04, 3, p);
    // canteros de pasto y cordones
    for (const [x, z, w, d] of [[-44, 3, 4, 62], [40, 12, 4, 44], [-30, 30, 10, 4], [26, 30, 10, 4]]) { box(w, 0.18, d, MAT.curb, x, 0.09, z, p); floor(w - 0.4, d - 0.4, MAT.grass, x, 0.19, z, p); }

    // canopy 30 × 14 a 5,2 m, con 3 + 3 islas paralelas a la ruta
    const CZ = 13;
    canopyYPF(0, CZ, 30, 14, 5.2, p);
    // cubo del logo, saliente en el frente que mira a la ruta (y atrás)
    const logoT = signTex(530, 230, '#0a4686', (g, w, h) => fitImage(g, IMG.ypf, 30, 25, w - 60, h - 50));
    for (const s of [1, -1]) { box(3.4, 1.5, 0.5, MAT.ypf, 0, 5.8, CZ + s * 7.2, p, 0.05); plane(3.2, 1.36, texMat(logoT, { glow: 0.45 }), 0, 5.8, CZ + s * 7.46, s > 0 ? 0 : Math.PI, p); }
    const islands = [];
    for (const iz of [CZ - 3, CZ + 3]) for (const ix of [-9.5, 0, 9.5]) {
      island(ix, iz, p);
      cyl(0.3, 0.3, 5.0, MAT.steel, ix, 2.7, iz, p, 24);
      const a = pumpYPF(ix - 1.7, iz, p), b = pumpYPF(ix + 1.7, iz, p);
      islands.push({ x: ix, z: iz, pumps: [a, b] });
    }
    // carriles: z = 7.4 · 13 · 18.6  (los autos se paran paralelos a la isla)
    const fuel = placeCar('#c4161c', 'yaris', -1.0, CZ - 5.6, 0, p);           // el auto que carga (lado derecho hacia la isla)
    const fuelPort = new THREE.Vector3(-2.4, 0.95, CZ - 4.68);
    
    // tapa de combustible abierta y pico enganchado
    const flap = box(0.03, 0.2, 0.2, M('#c4161c', { r: 0.25, m: 0.5 }), fuelPort.x - 0.16, fuelPort.y, fuelPort.z + 0.02, p, 0.01); flap.rotation.y = -1.0;
    cyl(0.07, 0.07, 0.02, M('#15171a'), fuelPort.x, fuelPort.y, fuelPort.z - 0.005, p, 20).rotation.x = Math.PI / 2;
    const nz = nozzle('#2a8a3c', p); nz.position.copy(fuelPort); nz.rotation.y = 0.15;
    W.spots.nozzle = nz;
    {
      // manguera: sale de la torre del surtidor y entra por atrás del pico
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.15);
      const inlet = fuelPort.clone().add(new THREE.Vector3(0, 0.07, 0.49).applyQuaternion(q));
      const before = fuelPort.clone().add(new THREE.Vector3(0, 0.07, 0.75).applyQuaternion(q));
      const outlet = new THREE.Vector3(-1.4, 2.15, CZ - 3.27);
      box(0.12, 0.16, 0.08, MAT.darkMetal, outlet.x, outlet.y + 0.02, outlet.z + 0.02, p, 0.02);
      const c = new THREE.CatmullRomCurve3([outlet, outlet.clone().add(new THREE.Vector3(-0.05, -0.35, -0.12)), new THREE.Vector3(-1.85, 0.62, CZ - 3.75), before, inlet]);
      const m = new THREE.Mesh(new THREE.TubeGeometry(c, 64, 0.022, 10), MAT.hose); m.castShadow = true; p.add(m);
    }
    const play = person({ ...PLAYERO, pose: 'nozzle' }, p); play.position.set(-2.1, 0.05, CZ - 4.02); play.rotation.y = Math.PI;
    const driver = person({ shirt: '#e7e2d6', pants: '#41506a', skin: SKINS[1], hair: '#3b2a1e', pose: 'stand' }, p); driver.position.set(0.4, 0.2, CZ - 7.2); driver.rotation.y = -0.6;
    placeCar('#e3e5e7', 'suv', 9.0, CZ - 5.6, Math.PI, p);
    placeCar('#30343a', 'pickup', -9.0, CZ, 0, p);
    placeCar('#6f8fae', 'sedan', 10.0, CZ + 5.6, Math.PI, p);
    const play2 = person({ ...PLAYERO, pose: 'pump' }, p); play2.position.set(8.1, 0.2, CZ + 3.95); play2.rotation.y = 0;
    hose(new THREE.Vector3(7.8, 1.25, CZ + 3.29), new THREE.Vector3(8.9, 0.95, CZ + 4.66), p);
    W.spots.fuelCar = fuel; W.spots.playero = play;
    W.spots.pump = islands[1].pumps[0];
    {
      const pg = W.spots.pump;                                   // cara que mira al auto (-z)
      plane(0.62, 0.22, texMat(signTex(256, 90, '#0e1a26', (g2, w, h) => { g2.fillStyle = '#ffb21a'; g2.font = FONT(800, 46); g2.fillText('INFINIA', 14, 62); }), { glow: 0.6 }), 0, 1.92, -0.253, Math.PI, pg);
      for (const [dx, col] of [[-0.3, '#f2c500'], [0.0, '#151515']]) {
        const hn = nozzle(col, pg); hn.position.set(dx, 1.0, -0.34); hn.rotation.set(-Math.PI / 2, Math.PI, 0); hn.scale.setScalar(0.95);
        const top = new THREE.Vector3(dx, 1.95, -0.27), inl = new THREE.Vector3(dx, 1.0 + 0.47, -0.27);
        const c = new THREE.CatmullRomCurve3([top, new THREE.Vector3(dx - 0.05, 1.75, -0.5), new THREE.Vector3(dx, 1.25, -0.62), new THREE.Vector3(dx, 1.38, -0.4), inl]);
        const m = new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.02, 8), MAT.hose); pg.add(m);
      }
    }

    // tótem de precios junto a la ruta
    totemYPF(-34, 30, 0.35, p);
    // luminarias y verde
    lampPost(-38, 33, p);
    for (const [x, z] of [[-41, 18], [-41, -8], [37, 22], [36, -10]]) planterTree(x, z, p);
    for (const [x, z] of [[-29, 30.5], [-26, 30.5], [23, 30.5], [26, 30.5], [29, 30.5]]) bush(x, z, 0.8, p);

    buildFULL(p);
    buildBoxes(p);
    W.spots.nucleo = p;
  }

  /* ---------- FULL: caja gris oscura, banda blanca con "full", vidriera ---------- */
  function buildFULL(p) {
    const X0 = -22, X1 = 2, Z0 = -22, Z1 = -6, H = 4.8;     // 24 × 16
    const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2, w = X1 - X0, d = Z1 - Z0;
    const wall = M('#3a3d42', { r: 0.8 });
    box(w, 0.3, d, M('#2d3034'), cx, H + 0.15, cz, p);                         // techo
    box(w, H, 0.3, wall, cx, H / 2, Z0, p);                                    // fondo
    box(0.3, H, d, wall, X0, H / 2, cz, p); box(0.3, H, d, wall, X1, H / 2, cz, p);
    // banda blanca retroiluminada con ondas y "full"
    const bandT = signTex(1536, 128, '#f6f7f7', (g, W2, H2) => {
      g.strokeStyle = 'rgba(31,79,168,.13)'; g.lineWidth = 6;
      for (let k = 0; k < 4; k++) { g.beginPath(); for (let x = 0; x <= W2; x += 8) g.lineTo(x, H2 * 0.5 + Math.sin(x / 70 + k) * 30 + (k - 1.5) * 14); g.stroke(); }
      g.fillStyle = '#2b2e33'; g.font = FONT(800, 92); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('full', W2 * 0.5, H2 * 0.54);
    });
    box(w + 0.3, 1.35, 0.4, M('#f6f7f7', { e: '#ffffff', ei: 0.15 }), cx, H - 0.6, Z1, p);
    plane(w, 1.25, texMat(bandT, { glow: 0.55 }), cx, H - 0.6, Z1 + 0.205, 0, p);
    // vidriera con parantes (deja la puerta en x = -10)
    const DOOR = -10;
    for (let x = X0 + 0.15; x < X1; x += 3) box(0.1, 3.2, 0.12, MAT.darkMetal, x, 1.65, Z1, p);
    box(w, 0.12, 0.14, MAT.darkMetal, cx, 3.27, Z1, p);
    box(w, 0.25, 0.3, wall, cx, 0.12, Z1, p);
    for (const [a, b] of [[X0, DOOR - 1.2], [DOOR + 1.2, X1]]) {
      const gl = box(b - a, 3.0, 0.04, MAT.glass, (a + b) / 2, 1.75, Z1, p, 0, false); gl.renderOrder = 2;
    }
    // puertas automáticas (se abren cuando entra la cámara)
    const doorL = box(1.2, 3.0, 0.05, MAT.glass, DOOR - 0.6, 1.75, Z1 + 0.04, p, 0, false);
    const doorR = box(1.2, 3.0, 0.05, MAT.glass, DOOR + 0.6, 1.75, Z1 + 0.04, p, 0, false);
    W.spots.fullDoors = { doorL, doorR, x: DOOR, z: Z1 };
    // alero sobre la entrada
    box(5, 0.18, 1.6, MAT.charcoal, DOOR, 3.45, Z1 + 0.8, p);

    // ---- interior ----
    const tileT = tex(256, 256, (g, W2, H2) => { g.fillStyle = '#d9d6d0'; g.fillRect(0, 0, W2, H2); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 0, W2, 3); g.fillRect(0, 0, 3, H2); }, [w / 1.2, d / 1.2]);
    floor(w - 0.3, d - 0.3, texMat(tileT, { r: 0.5 }), cx, 0.05, cz, p);
    // cielorraso con paneles de luz
    plane(w - 0.3, d - 0.3, M('#f2f2f0', { r: 0.9 }), cx, H - 0.02, cz, 0, p).rotation.x = Math.PI / 2;
    for (let x = X0 + 3; x < X1 - 1; x += 4.5) for (let z = Z0 + 3; z < Z1 - 1; z += 4) box(1.2, 0.04, 1.2, MAT.coolLight, x, H - 0.05, z, p, 0, false);
    // pared de listones de madera clara (fondo)
    const slatT = tex(256, 256, (g, W2, H2) => { g.fillStyle = '#c89b6a'; g.fillRect(0, 0, W2, H2); for (let x = 0; x < W2; x += 16) { g.fillStyle = 'rgba(70,40,15,.28)'; g.fillRect(x, 0, 3, H2); g.fillStyle = 'rgba(255,240,220,.12)'; g.fillRect(x + 3, 0, 4, H2); } }, [8, 1]);
    plane(w - 0.4, H - 0.1, texMat(slatT, { r: 0.7 }), cx, H / 2, Z0 + 0.16, 0, p);
    // revestimiento claro en las paredes laterales
    plane(d - 0.4, H - 0.1, M('#efece6', { r: 0.9 }), X0 + 0.16, H / 2, cz, Math.PI / 2, p);
    plane(d - 0.4, H - 0.1, M('#efece6', { r: 0.9 }), X1 - 0.16, H / 2, cz, -Math.PI / 2, p);
    // heladeras de vidrio contra la pared del fondo, a la izquierda
    const fridgeT = tex(256, 512, (g, W2, H2) => {
      g.fillStyle = '#e9f2f7'; g.fillRect(0, 0, W2, H2);
      const cols = ['#d23c33', '#0a4686', '#f2c500', '#2a8a3c', '#e57f2c', '#7a3fa0', '#ffffff'];
      for (let y = 30; y < H2 - 20; y += 92) { g.fillStyle = '#c6d4dc'; g.fillRect(8, y + 72, W2 - 16, 6); for (let x = 14; x < W2 - 22; x += 22) { g.fillStyle = cols[(x * 7 + y) % cols.length]; g.fillRect(x, y + 20, 16, 52); } }
      g.fillStyle = 'rgba(40,50,60,.9)'; g.fillRect(0, 0, 8, H2); g.fillRect(W2 - 8, 0, 8, H2); g.fillRect(0, 0, W2, 10);
    });
    for (let i = 0; i < 6; i++) { const x = X0 + 1.4 + i * 1.3; box(1.25, 2.4, 0.8, M('#d7dadc', { r: 0.4, m: 0.4 }), x, 1.2, Z0 + 0.6, p); plane(1.1, 2.2, texMat(fridgeT, { glow: 0.6, r: 0.2 }), x, 1.25, Z0 + 1.02, 0, p); }
    // góndolas bajas con productos
    const prodT = tex(1024, 256, (g, W2, H2) => { g.fillStyle = '#eceae6'; g.fillRect(0, 0, W2, H2); const cols = ['#b8423a', '#2c5aa0', '#d9b23a', '#3f7d4a', '#cf7a3a', '#6b4a36', '#f1f0ec', '#a24f7a', '#e5e1d6']; for (let r = 0; r < 5; r++) { const y0 = 6 + r * 50; let x = 6; while (x < W2 - 16) { const bw = 10 + rnd() * 16, bh = 22 + rnd() * 18; g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.fillRect(x, y0 + 40 - bh, bw, bh); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 2, y0 + 44 - bh, bw - 4, 4); x += bw + 2; } g.fillStyle = '#c3c7ca'; g.fillRect(0, y0 + 40, W2, 6); } });
    for (const gz of [-17.5, -13.5]) for (const gx of [-18.5, -12]) {
      box(5, 1.5, 1.0, MAT.white, gx, 0.75, gz, p, 0.03);
      for (const s of [1, -1]) plane(4.8, 1.3, texMat(prodT, { r: 0.8 }), gx, 0.82, gz + s * 0.51, s > 0 ? 0 : Math.PI, p);
    }
    // barra de café con vitrina de pastelería
    box(6.5, 1.1, 1.0, MAT.woodLight, -3.5, 0.55, -15, p, 0.03);
    box(6.7, 0.06, 1.15, MAT.white, -3.5, 1.13, -15, p);
    box(1.6, 0.55, 0.85, M('#e9eef0', { op: 0.45, r: 0.05 }), -5.5, 1.43, -15, p);
    for (let i = 0; i < 6; i++) sph(0.09, M(['#c98c4a', '#a5612f', '#e3c27a'][i % 3]), -6.1 + i * 0.25, 1.24, -15, p, 10);
    box(0.65, 0.6, 0.5, M('#b8bdc1', { m: 0.8, r: 0.3 }), -2.3, 1.45, -15.15, p, 0.04);
    box(0.65, 0.6, 0.5, M('#b8bdc1', { m: 0.8, r: 0.3 }), -1.3, 1.45, -15.15, p, 0.04);
    // pizarra del café sobre la barra
    const menuT = signTex(768, 256, '#1b2433', (g, W2, H2) => { g.fillStyle = '#ffffff'; g.font = FONT(800, 70); g.fillText('full café', 30, 82); g.fillStyle = '#9fb3c6'; g.font = FONT(600, 34, false); ['Café · Cortado · Lágrima', 'Medialunas · Tostados', 'Combos con la carga'].forEach((t, i) => g.fillText(t, 32, 140 + i * 40)); });
    plane(4.5, 1.5, texMat(menuT, { glow: 0.6 }), -3.5, 3.3, Z0 + 0.2, 0, p);
    const barista = person({ shirt: '#1b2433', pants: '#1b2433', skin: SKINS[2], hair: '#1b130d', pose: 'stand' }, p); barista.position.set(-3.8, 0.05, -16.0);
    // ---- detalle del café ----
    // pared azul de marca detrás de la barra, con ondas y "full"
    const brandWall = signTex(1024, 512, '#0a4686', (g, W2, H2) => {
      g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 10;
      for (let k = 0; k < 7; k++) { g.beginPath(); for (let x = 0; x <= W2; x += 8) g.lineTo(x, H2 * 0.15 + k * 60 + Math.sin(x / 90 + k) * 26); g.stroke(); }
      g.fillStyle = '#fff'; g.font = FONT(800, 210); g.textBaseline = 'middle'; g.fillText('full', 60, H2 * 0.78);
    });
    plane(9.4, H - 0.2, texMat(brandWall, { glow: 0.25 }), -3.5, H / 2, Z0 + 0.19, 0, p);
    // tres carteles de menú retroiluminados sobre la barra
    [['Café', '#c98c4a'], ['Medialunas', '#e3c27a'], ['Combos', '#c8352c']].forEach(([t, c], i) => {
      const mt = signTex(512, 300, '#13243a', (g, W2, H2) => { g.fillStyle = c; g.fillRect(24, 24, W2 - 48, 150); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(W2 / 2, 100, 52, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = FONT(800, 64); g.textAlign = 'center'; g.fillText(t, W2 / 2, 250); });
      plane(2.2, 1.3, texMat(mt, { glow: 0.7 }), -6.3 + i * 2.8, 3.55, Z0 + 0.25, 0, p);
    });
    // cafetera de espresso con grupos
    box(1.5, 0.55, 0.55, M('#2a2d31', { m: 0.6, r: 0.3 }), -1.6, 1.43, -15.2, p, 0.05);
    for (let i = 0; i < 2; i++) cyl(0.07, 0.07, 0.14, M('#c9ccd0', { m: 0.9, r: 0.2 }), -1.95 + i * 0.7, 1.1, -14.95, p, 12);
    // banquetas frente a la barra y lámparas colgantes
    for (let i = 0; i < 4; i++) { const x = -6 + i * 1.6; cyl(0.22, 0.22, 0.06, MAT.woodLight, x, 0.78, -13.9, p, 18); cyl(0.03, 0.03, 0.75, MAT.darkMetal, x, 0.39, -13.9, p, 8); cyl(0.2, 0.22, 0.03, MAT.darkMetal, x, 0.03, -13.9, p, 16); }
    for (let i = 0; i < 3; i++) { const x = -5.8 + i * 2.3; cyl(0.006, 0.006, 1.5, MAT.darkMetal, x, H - 0.75, -14.8, p, 4); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 0.32, 20, 1, true), M('#0a4686', { ds: true, r: 0.5 })); put(sh, x, H - 1.6, -14.8, p); sph(0.07, MAT.warmLight, x, H - 1.72, -14.8, p, 8); }
    // heladeras: marcos y manijas; freezer de helados
    for (let i = 0; i < 6; i++) { const x = X0 + 1.4 + i * 1.3; box(0.04, 2.25, 0.04, MAT.darkMetal, x + 0.5, 1.25, Z0 + 1.06, p); box(1.15, 0.05, 0.05, MAT.darkMetal, x, 2.35, Z0 + 1.06, p); }
    box(2.2, 0.9, 0.9, MAT.white, -8.2, 0.45, -20.6, p, 0.05);
    floor(2, 0.7, texMat(tex(256, 96, (g, W2, H2) => { g.fillStyle = '#dff1fb'; g.fillRect(0, 0, W2, H2); ['#f2c3d0', '#f7e2a3', '#b8e0c2', '#c9b6e8', '#f5b48c'].forEach((c, k) => { g.fillStyle = c; g.fillRect(10 + k * 48, 20, 40, 56); }); }), { glow: 0.4 }), -8.2, 0.91, -20.6, p);
    // exhibidor de lubricantes Elaion (cajas azules) en la cabecera de góndola
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) box(0.28, 0.32, 0.18, M(k % 2 ? '#0a4686' : '#f2c500', { r: 0.5 }), -21.0 + k * 0.32, 0.25 + r * 0.42, -15.5, p, 0.02);
    box(1.4, 1.3, 0.5, MAT.white, -20.5, 0.65, -15.5, p, 0.03);
    // cartel colgante de promo
    cyl(0.005, 0.005, 0.8, MAT.darkMetal, -15.2, H - 0.4, -15.5, p, 4);
    const promo = signTex(768, 256, '#f2c500', (g, W2, H2) => { g.fillStyle = '#0a4686'; g.font = FONT(800, 110); g.textAlign = 'center'; g.fillText('COMBO CARGA', W2 / 2, 140); g.font = FONT(600, 48, false); g.fillText('café + medialuna', W2 / 2, 215); });
    for (const sd of [1, -1]) plane(2.4, 0.8, texMat(promo, { glow: 0.5 }), -15.2, H - 1.2, -15.5 + sd * 0.01, sd > 0 ? 0 : Math.PI, p);
    // clientes en los pasillos
    const sh1 = person({ shirt: '#7a3fa0', pants: '#2b2d33', skin: SKINS[3], hair: '#4a3020', pose: 'stand' }, p); sh1.position.set(-15.3, 0.05, -11.8); sh1.rotation.y = Math.PI;
    const sh2 = person({ shirt: '#d9a441', pants: '#3a3f46', skin: SKINS[1], hair: '#1e1611', pose: 'walk' }, p); sh2.position.set(-9.2, 0.05, -18.2); sh2.rotation.y = -Math.PI / 2;
    const sh3 = person({ shirt: '#3e7d6a', pants: '#2b2d33', skin: SKINS[0], hair: '#2a2018', pose: 'stand' }, p); sh3.position.set(-11.5, 0.05, -12.6); sh3.rotation.y = Math.PI;
    // caja
    box(2.4, 1.05, 0.8, MAT.woodLight, -12.8, 0.53, -10.6, p, 0.03); box(2.5, 0.05, 0.9, MAT.white, -12.8, 1.08, -10.6, p); const scr = box(0.42, 0.3, 0.04, M('#20242a'), -12.3, 1.32, -10.6, p); scr.rotation.y = 0.4;
    // marca FULL en la pared lateral
    plane(6, 1.6, texMat(signTex(768, 205, '#0a4686', (g, W2, H2) => { g.fillStyle = '#fff'; g.font = FONT(800, 150); g.textBaseline = 'middle'; g.fillText('full', 40, H2 * 0.55); g.font = FONT(600, 46, false); g.fillText('tienda · café', 330, H2 * 0.58); }), { glow: 0.5 }), X0 + 0.2, 3.1, -14, Math.PI / 2, p);
    // mesas blancas junto a la vidriera, sillas de madera
    for (const [tx, tz] of [[-19, -8.2], [-15.5, -8.2], [-3, -8.2], [0, -9.6]]) {
      cyl(0.45, 0.45, 0.04, MAT.white, tx, 0.75, tz, p, 24); cyl(0.04, 0.04, 0.73, MAT.darkMetal, tx, 0.37, tz, p, 8);
      for (const s of [-1, 1]) { box(0.42, 0.05, 0.42, MAT.woodLight, tx + s * 0.75, 0.46, tz, p); box(0.04, 0.46, 0.38, MAT.woodLight, tx + s * 0.95, 0.7, tz, p); }
    }
    const seated2 = person({ shirt: '#3e7d6a', pants: '#2b2d33', skin: SKINS[3], hair: '#1e1611', pose: 'sit' }, p); seated2.position.set(-2.1, 0.05, -8.2); seated2.rotation.y = -Math.PI / 2;
    // lámparas colgantes y plantas
    for (const [lx, lz] of [[-19, -8.2], [-15.5, -8.2], [-3, -8.2], [0, -9.6], [-3.5, -15]]) { cyl(0.006, 0.006, 1.6, MAT.darkMetal, lx, H - 0.8, lz, p, 4); const sh = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 20, 1, true), M('#ffffff', { ds: true })); put(sh, lx, H - 1.7, lz, p); sph(0.08, MAT.warmLight, lx, H - 1.78, lz, p, 8); }
    for (const [px, pz] of [[1.2, -7], [-21.2, -7], [-8, -20.8]]) { cyl(0.28, 0.22, 0.55, M('#e9e6df'), px, 0.28, pz, p, 14); sph(0.55, M('#4e7f45', { r: 1 }), px, 1.0, pz, p, 10); }
    // luz cálida interior
    for (const [lx, lz] of [[-16, -13], [-5, -13], [-10, -9]]) { const l = new THREE.PointLight(0xffe6c4, 1.25, 20, 2); l.position.set(lx, H - 0.5, lz); p.add(l); }
    // clientes entrando / estacionamiento frente a la vidriera
    const walker = person({ shirt: '#2f6f9f', pants: '#2b2d33', skin: SKINS[1], hair: '#2a2018', pose: 'walk' }, p); walker.position.set(-8.4, 0.05, -3.6); walker.rotation.y = Math.PI;
    for (const [x, c, k] of [[-18, '#e8e8e8', 'sedan'], [-15, '#2c3e58', 'suv'], [-3, '#9aa3ab', 'sedan']]) placeCar(c, k, x, -2.6, Math.PI / 2, p);
    // líneas de estacionamiento
    for (let x = -19.5; x <= 0; x += 3) floor(0.12, 4.8, MAT.white, x, 0.06, -2.6, p);
    W.spots.full = { X0, X1, Z0, Z1, H };
  }

  /* ---------- Boxes: dos bahías abiertas, marco blanco, cartel azul ---------- */
  function buildBoxes(p) {
    const X0 = 6, X1 = 22, Z0 = -22, Z1 = -6, H = 5.2;
    const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2, w = X1 - X0, d = Z1 - Z0;
    const wallW = M('#f2f3f4', { r: 0.8 });
    box(w, 0.3, d, M('#d9dcde'), cx, H + 0.15, cz, p);
    box(w, H, 0.3, wallW, cx, H / 2, Z0, p);
    box(0.3, H, d, wallW, X0, H / 2, cz, p); box(0.3, H, d, wallW, X1, H / 2, cz, p);
    box(0.4, H, 0.6, wallW, cx, H / 2, Z1, p);                                     // parante central
    box(w + 0.4, 1.2, 0.5, MAT.ypf, cx, H - 0.45, Z1, p);                           // dintel azul
    const signT = signTex(1024, 128, '#0a4686', (g, W2, H2) => { fitImage(g, IMG.ypf, 24, 18, 230, 92); g.fillStyle = '#fff'; g.font = FONT(800, 92); g.textBaseline = 'middle'; g.fillText('BOXES', 290, H2 * 0.55); });
    plane(w - 2, 1.0, texMat(signT, { glow: 0.5 }), cx, H - 0.45, Z1 + 0.26, 0, p);
    // tótem "YPF BOXES" vertical
    box(1.2, 5.5, 0.35, MAT.ypf, X1 + 2.2, 2.75, Z1 + 1.5, p, 0.04);
    const tt = signTex(128, 512, '#0a4686', (g, W2, H2) => { fitImage(g, IMG.ypf, 10, 20, W2 - 20, 60); g.save(); g.translate(W2 / 2 + 22, H2 * 0.62); g.rotate(-Math.PI / 2); g.fillStyle = '#fff'; g.font = FONT(800, 72); g.textAlign = 'center'; g.fillText('BOXES', 0, 0); g.restore(); });
    plane(1.1, 5.2, texMat(tt, { glow: 0.45 }), X1 + 2.2, 2.75, Z1 + 1.68, 0, p);
    // interior: piso epoxi, franja azul, líneas amarillas
    floor(w - 0.3, d - 0.3, M('#9ea6ad', { r: 0.45, m: 0.1 }), cx, 0.05, cz, p);
    for (const x of [X0 + 4, cx + 4]) { floor(0.15, d - 2, MAT.yellow, x - 3, 0.06, cz, p); floor(0.15, d - 2, MAT.yellow, x + 3, 0.06, cz, p); }
    box(w - 0.4, 0.5, 0.05, MAT.ypf, cx, 1.3, Z0 + 0.18, p, 0, false);
    for (const x of [X0 + 0.18, X1 - 0.18]) box(0.05, 0.5, d - 0.4, MAT.ypf, x, 1.3, cz, p, 0, false);
    for (let x = X0 + 3; x < X1 - 1; x += 5) box(3, 0.05, 0.4, MAT.coolLight, x, H - 0.05, cz, p, 0, false);
    // bahía 1: elevador con rampas amarillas y auto arriba, capó abierto
    const B1 = X0 + 4;
    for (const s of [-1, 1]) for (const zz of [Z0 + 3, Z1 - 3]) box(0.35, 3.0, 0.35, M('#2c62b8', { r: 0.5, m: 0.4 }), B1 + s * 1.7, 1.5, zz, p);
    const liftY = 1.7;
    for (const s of [-1, 1]) box(0.55, 0.18, d - 6.5, MAT.yellow, B1 + s * 0.8, liftY, cz, p);
    const lifted = placeCar('#d8dadd', 'sedan', B1, cz, -Math.PI / 2, p); lifted.position.y = liftY + 0.09;
    const hood = box(1.25, 0.06, 1.55, M('#d8dadd', { r: 0.28, m: 0.45 }), 0, 0, 0, lifted); hood.position.set(1.55, 1.25, 0); hood.rotation.z = 1.05;
    box(1.05, 0.48, 1.1, M('#3a4048', { m: 0.4 }), 1.45, 0.82, 0, lifted, 0.05);
    box(0.4, 0.22, 0.4, M('#c8352c'), 1.2, 1.15, 0.25, lifted, 0.03);
    W.spots.lifted = lifted;
    const mech1 = person({ ...MECANICO, skin: SKINS[1], pose: 'stand' }, p); mech1.position.set(B1 + 1.8, 0.05, Z1 - 1.8); mech1.rotation.y = Math.PI + 0.6;
    // bahía 2: auto en el piso, mecánico con tablet
    const B2 = cx + 4;
    const mech2 = person({ ...MECANICO, skin: SKINS[0], hair: '#3a2a1e', pose: 'tablet' }, p); mech2.position.set(B2 + 1.6, 0.05, Z1 - 2.6); mech2.rotation.y = -2.5;
    W.spots.mech2 = mech2;
    // tambores de lubricante, gomas, tablero de herramientas, pizarra de chequeo
    const drum = M('#0a4686', { r: 0.4, m: 0.3 });
    for (let i = 0; i < 4; i++) { cyl(0.3, 0.3, 0.9, drum, X1 - 0.6 - (i % 2) * 0.65, 0.45, Z0 + 1 + Math.floor(i / 2) * 0.65, p, 20); cyl(0.305, 0.305, 0.08, MAT.white, X1 - 0.6 - (i % 2) * 0.65, 0.55, Z0 + 1 + Math.floor(i / 2) * 0.65, p, 20); }
    for (let i = 0; i < 6; i++) { const t = cyl(0.34, 0.34, 0.22, MAT.rubber, X0 + 0.6, 0.35 + i * 0.24, Z0 + 3 + (i % 2) * 0.05, p, 18); }
    box(1.6, 1.1, 0.6, M('#c8352c', { r: 0.5, m: 0.3 }), cx - 1.5, 0.55, Z0 + 0.55, p, 0.04);
    const pegT = tex(512, 256, (g, W2, H2) => { g.fillStyle = '#d8dde2'; g.fillRect(0, 0, W2, H2); g.fillStyle = '#b4bcc4'; for (let x = 12; x < W2; x += 24) for (let y = 12; y < H2; y += 24) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } g.fillStyle = '#c8352c'; g.fillRect(60, 60, 18, 140); g.fillStyle = '#2a2f35'; g.fillRect(110, 50, 12, 150); g.fillRect(150, 70, 60, 12); g.fillStyle = '#f2c200'; g.fillRect(250, 60, 22, 130); g.fillStyle = '#0a4686'; g.fillRect(310, 80, 120, 18); });
    plane(4, 2, texMat(pegT), cx - 1.5, 2.6, Z0 + 0.17, 0, p);
    const chkT = signTex(512, 640, '#ffffff', (g, W2, H2) => { g.fillStyle = '#0a4686'; g.fillRect(0, 0, W2, 90); g.fillStyle = '#fff'; g.font = FONT(800, 58); g.fillText('CHEQUEO · 10 PUNTOS', 26, 66); for (let i = 0; i < 10; i++) { const y = 140 + i * 50; g.fillStyle = '#23804a'; g.beginPath(); g.arc(44, y, 15, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.moveTo(36, y); g.lineTo(42, y + 7); g.lineTo(53, y - 7); g.stroke(); g.fillStyle = '#2c3a48'; g.font = FONT(600, 30, false); g.fillText(['Precio vigente', 'Volumen', 'Horas en playa', 'Id. de boca', 'Precio competencia', 'Paridad', 'Cliente único', 'Formato de boca', 'Línea de factura', 'Costos'][i], 80, y + 10); } });
    box(2.3, 2.9, 0.08, MAT.darkMetal, cx + 1.7, 2.6, Z0 + 0.2, p);
    plane(2.2, 2.75, texMat(chkT, { glow: 0.35 }), cx + 1.7, 2.6, Z0 + 0.25, 0, p);
    const l = new THREE.PointLight(0xffffff, 0.7, 20, 2); l.position.set(cx, H - 0.6, cz); p.add(l);
    W.spots.boxes = { X0, X1, Z0, Z1, H, B1, B2 };
  }

  /* =========================================================================
     REFIPLUS en x = -170: techo blanco con filete verde, panel verde oscuro,
     surtidores grafito con verde lima, tienda chica, autodespacho.
     ========================================================================= */
  function stationRefiplus() {
    const p = new THREE.Group(); p.position.set(-80, 0, 0); W.scene.add(p);
    floor(46, 30, MAT.concrete, 0, 0.04, 16, p);
    const green = M('#3dae2b', { r: 0.5 }), dgreen = M('#0f3b2a', { r: 0.5 });
    const fT = tex(64, 64, (g, W2, H2) => { g.fillStyle = '#f4f5f5'; g.fillRect(0, 0, W2, H2); g.fillStyle = '#3dae2b'; g.fillRect(0, H2 * 0.72, W2, H2 * 0.16); });
    const fM = texMat(fT, { r: 0.5 });
    put(new THREE.Mesh(new THREE.BoxGeometry(20, 0.7, 11), [fM, fM, M('#e1e3e4'), M('#eceeee', { e: '#ffffff', ei: 0.08 }), fM, fM]), 0, 5.35, 17, p);
    const logo = signTex(768, 256, '#0f3b2a', (g, W2, H2) => { g.fillStyle = '#fff'; g.font = FONT(800, 120); g.textBaseline = 'middle'; g.fillText('refiplus', 40, H2 * 0.45); g.fillStyle = '#3dae2b'; g.font = FONT(700, 44); g.fillText('ENERGÍA YPF', 44, H2 * 0.82); });
    box(4.4, 1.5, 0.4, dgreen, 0, 5.6, 22.75, p, 0.04);
    plane(4.2, 1.4, texMat(logo, { glow: 0.45 }), 0, 5.6, 22.96, 0, p);
    const pumpT = signTex(128, 256, '#2e3236', (g, W2, H2) => { g.fillStyle = '#9be03d'; g.fillRect(0, 30, W2, 10); g.fillRect(0, 200, W2, 10); g.fillStyle = '#d8f5ff'; g.fillRect(24, 70, 80, 60); });
    for (const iz of [14, 20]) {
      island(0, iz, p, 7);
      cyl(0.22, 0.22, 4.9, MAT.white, 0, 2.65, iz, p, 16);
      for (const ix of [-2, 2]) {
        const g = new THREE.Group(); g.position.set(ix, 0.2, iz); p.add(g);
        box(0.8, 2.0, 0.5, M('#2e3236', { r: 0.5, m: 0.3 }), 0, 1.0, 0, g, 0.04);
        for (const s of [1, -1]) plane(0.7, 1.4, texMat(pumpT, { glow: 0.3 }), 0, 1.15, s * 0.255, s > 0 ? 0 : Math.PI, g);
      }
    }
    placeCar('#f0f0ee', 'sedan', -1, 11.4, 0, p);
    placeCar('#5a6b45', 'pickup', 1.5, 22.6, Math.PI, p);
    const self = person({ shirt: '#d3b07a', pants: '#3a3f46', skin: SKINS[2], hair: '#2a2018', pose: 'pump' }, p); self.position.set(-2.1, 0.2, 12.7); self.rotation.y = Math.PI;
    // tienda reducida
    box(8, 3.4, 6, MAT.white, 15, 1.7, 5, p, 0.05);
    box(8.2, 0.6, 6.2, green, 15, 3.5, 5, p);
    box(6, 2.2, 0.05, MAT.glass, 15, 1.3, 8.02, p, 0, false);
    plane(5, 0.5, texMat(textSign('TIENDA', '#3dae2b', '#ffffff', 512, 64), { glow: 0.4 }), 15, 3.5, 8.12, 0, p);
    // tótem gris con borde verde y flechas de color por producto
    const tT = signTex(256, 640, '#3a3f44', (g, W2, H2) => { g.strokeStyle = '#3dae2b'; g.lineWidth = 12; g.strokeRect(6, 6, W2 - 12, H2 - 12); g.fillStyle = '#fff'; g.font = FONT(800, 58); g.textAlign = 'center'; g.fillText('refiplus', W2 / 2, 80); [['#2e66c6', 'SUPER'], ['#2e66c6', 'PREMIUM'], ['#3dae2b', 'DIESEL'], ['#f2c500', 'GNC']].forEach(([c, t], i) => { const y = 150 + i * 110; g.fillStyle = c; g.beginPath(); g.moveTo(26, y); g.lineTo(56, y + 30); g.lineTo(26, y + 60); g.fill(); g.fillStyle = '#e6edf2'; g.font = FONT(700, 40); g.textAlign = 'left'; g.fillText(t, 70, y + 44); }); });
    box(1.5, 6.5, 0.4, M('#3a3f44'), -18, 3.75, 29, p, 0.04);
    for (const s of [1, -1]) plane(1.4, 6.2, texMat(tT, { glow: 0.4 }), -18, 3.8, 29 + s * 0.205, s > 0 ? 0 : Math.PI, p);
    W.spots.refiplus = p;
  }

  /* =========================================================================
     YPF BLACK en x = +175 (con McDonald's): un solo techo carbón largo y fino
     sobre playa y tienda, viga con LED azul, columnas finas oscuras,
     surtidores negros con pantallas grandes, tienda con parasoles verticales.
     ========================================================================= */
  function stationBlack() {
    const p = new THREE.Group(); p.position.set(125, 0, 0); W.scene.add(p);
    floor(70, 50, M('#8f9396', { r: 0.85 }), 0, 0.04, 6, p);
    const roof = M('#1e2126', { r: 0.55, m: 0.25 });
    box(48, 0.55, 30, roof, 0, 6.2, 5, p);
    plane(47.6, 29.6, M('#2a2e34', { r: 0.6, e: '#141820', ei: 0.3 }), 0, 5.91, 5, 0, p).rotation.x = Math.PI / 2;
    for (let x = -21; x <= 21; x += 3) box(0.4, 0.04, 28, M('#ffffff', { e: '#dfe9ff', ei: 1.1 }), x, 5.9, 5, p, 0, false);
    // viga colgada con LED azul y "YPF"
    box(30, 1.1, 0.5, roof, 0, 5.4, 19.9, p);
    const ledT = signTex(2048, 96, '#0d1a5c', (g, W2, H2) => { for (let x = 0; x < W2; x += 10) for (let y = 4; y < H2; y += 10) { g.fillStyle = `rgba(45,91,255,${0.55 + 0.45 * Math.sin(x / 90)})`; g.fillRect(x, y, 7, 7); } g.fillStyle = '#fff'; g.font = FONT(800, 84); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('YPF  BLACK', W2 / 2, H2 / 2 + 4); });
    plane(29.6, 0.95, texMat(ledT, { glow: 1.0 }), 0, 5.4, 20.16, 0, p);
    // columnas finas
    for (let x = -21; x <= 21; x += 6) for (const z of [-7, 4, 16]) cyl(0.12, 0.12, 6, M('#2a2d33', { m: 0.6, r: 0.35 }), x, 3, z, p, 12);
    // islas y surtidores negros con pantallas horizontales grandes
    const scrT = signTex(512, 160, '#06080d', (g, W2, H2) => { const gr = g.createLinearGradient(0, 0, W2, 0); gr.addColorStop(0, '#2d5bff'); gr.addColorStop(1, '#7f9bff'); g.fillStyle = gr; g.fillRect(12, 12, W2 - 24, H2 - 24); g.fillStyle = '#fff'; g.font = FONT(800, 70); g.textBaseline = 'middle'; g.fillText('INFINIA', 34, H2 / 2 + 3); });
    for (const iz of [8, 14]) for (const ix of [-12, 0, 12]) {
      box(6, 0.2, 1.2, M('#3a3d42'), ix, 0.1, iz, p);
      for (const dx of [-1.6, 1.6]) {
        const g = new THREE.Group(); g.position.set(ix + dx, 0.2, iz); p.add(g);
        box(0.85, 2.3, 0.5, M('#111214', { r: 0.35, m: 0.4 }), 0, 1.15, 0, g, 0.05);
        box(1.3, 0.45, 0.12, M('#111214'), 0, 2.6, 0, g, 0.03);
        for (const s of [1, -1]) plane(1.2, 0.38, texMat(scrT, { glow: 0.9 }), 0, 2.6, s * 0.065, s > 0 ? 0 : Math.PI, g);
      }
    }
    placeCar('#16181c', 'suv', -12, 5.4, 0, p);
    placeCar('#e9eaec', 'suv', 0.5, 11, Math.PI, p);
    placeCar('#4b4f55', 'sedan', 12, 16.6, Math.PI, p);
    const att = person({ shirt: '#15171b', sleeve: '#15171b', pants: '#15171b', skin: SKINS[1], pose: 'pump', cap: '#15171b' }, p); att.position.set(-12.9, 0.2, 7.0); att.rotation.y = Math.PI;
    // tienda bajo el mismo techo: parasoles verticales oscuros + vidrio cálido
    const SZ = -9;
    box(40, 5.9, 8, M('#1a1c20', { r: 0.6 }), 0, 2.95, SZ - 4, p);
    box(36, 3.6, 0.05, M('#f2b872', { e: '#f2b872', ei: 0.55, r: 0.2 }), -2, 2.0, SZ + 0.02, p, 0, false);
    for (let x = -19.5; x <= 19.5; x += 0.9) box(0.12, 4.4, 0.45, M('#25282d', { r: 0.5, m: 0.3 }), x, 2.6, SZ + 0.3, p);
    plane(10, 1.4, texMat(textSign('FULL', '#1a1c20', '#ffffff', 1024, 144), { glow: 0.6 }), -10, 5.1, SZ + 0.56, 0, p);
    // McDonald's: panel rojo con los arcos dorados oficiales
    const mcT = signTex(512, 256, '#c41f12', (g, W2, H2) => fitImage(g, IMG.mcd, 40, 26, W2 - 80, H2 - 52));
    box(5.2, 2.7, 0.3, M('#da291c'), 12, 4.3, SZ + 0.6, p, 0.04);
    plane(5, 2.5, texMat(mcT, { glow: 0.15 }), 12, 4.3, SZ + 0.77, 0, p);
    // tótem negro alto con corona de LED azul y pantalla
    const tT = signTex(256, 1280, '#0b0c0f', (g, W2, H2) => { for (let x = 10; x < W2; x += 16) for (let y = 10; y < 160; y += 16) { g.fillStyle = `rgba(45,91,255,${0.4 + rnd() * 0.6})`; g.fillRect(x, y, 10, 10); } fitImage(g, IMG.ypf, 30, 190, W2 - 60, 90); g.fillStyle = '#fff'; g.font = FONT(800, 66); g.textAlign = 'center'; g.fillText('BLACK', W2 / 2, 360); const gr = g.createLinearGradient(0, 400, 0, H2); gr.addColorStop(0, '#1d3fd8'); gr.addColorStop(1, '#0a1240'); g.fillStyle = gr; g.fillRect(24, 400, W2 - 48, H2 - 430); g.fillStyle = 'rgba(255,255,255,.85)'; g.font = FONT(700, 46); ['INFINIA', 'INFINIA', 'DIESEL', 'FULL', 'PIT STOP'].forEach((t, i) => g.fillText(t, W2 / 2, 500 + i * 150)); });
    box(2, 13, 0.5, M('#0b0c0f', { r: 0.4, m: 0.3 }), -27, 6.5, 26, p, 0.05);
    for (const s of [1, -1]) plane(1.85, 12.7, texMat(tT, { glow: 0.65 }), -27, 6.5, 26 + s * 0.26, s > 0 ? 0 : Math.PI, p);
    for (const x of [-30, 30]) lampPost(x, 30, p);
    W.spots.black = p;
  }

  /* =========================================================================
     COMPETENCIA al sur de la ruta, en fila: Shell, Axion, Puma, blanca
     ========================================================================= */
  function forecourt(p, w = 30, d = 30) { floor(w, d, MAT.concrete, 0, 0.04, 16, p); }
  function brandPumps(p, body, accent) {
    for (const iz of [14, 20]) for (const ix of [-4.5, 4.5]) {
      island(ix, iz, p, 5);
      const g = new THREE.Group(); g.position.set(ix, 0.2, iz); p.add(g);
      box(0.9, 2.0, 0.5, M(body, { r: 0.5 }), 0, 1.0, 0, g, 0.04);
      box(0.92, 0.35, 0.52, M(accent, { r: 0.5 }), 0, 2.15, 0, g, 0.04);
    }
  }
  function brandTotem(p, x, z, bg, key, h = 12) {
    // pilón alto: cabezal blanco con el logo grande y filas de precios abajo
    cyl(0.25, 0.25, h - 4, M('#9aa0a6', { m: 0.5, r: 0.4 }), x, (h - 4) / 2, z, p, 12);
    box(4.4, 4.4, 0.5, M(bg), x, h - 1.6, z, p, 0.05);
    const head = signTex(512, 512, '#ffffff', (g, W2, H2) => fitImage(g, IMG[key], 30, 30, W2 - 60, H2 - 60));
    for (const s of [1, -1]) plane(4.1, 4.1, texMat(head, { glow: 0.5 }), x, h - 1.6, z + s * 0.26, s > 0 ? 0 : Math.PI, p);
    const rows = signTex(256, 256, '#0b1522', (g, W2, H2) => { for (let i = 0; i < 3; i++) { g.fillStyle = '#ffb21a'; g.fillRect(40, 30 + i * 76, 176, 40); } });
    box(2.2, 2.2, 0.4, M(bg), x, h - 4.9, z, p, 0.04);
    for (const s of [1, -1]) plane(2, 2, texMat(rows, { glow: 0.5 }), x, h - 4.9, z + s * 0.21, s > 0 ? 0 : Math.PI, p);
  }
  function stationShell(x, z = 0, ry = 0) {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; W.scene.add(p); forecourt(p);
    const fT = tex(64, 128, (g, W2, H2) => { g.fillStyle = '#fbce07'; g.fillRect(0, 0, W2, H2); g.fillStyle = '#dd1d21'; g.fillRect(0, H2 * 0.74, W2, H2 * 0.26); });
    const fM = texMat(fT, { r: 0.5 });
    put(new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 12), [fM, fM, M('#e5e5e2'), M('#f4f4f2', { e: '#ffffff', ei: 0.06 }), fM, fM]), 0, 5.8, 17, p);
    const lg = signTex(512, 512, '#ffffff', (g, W2, H2) => fitImage(g, IMG.shell, 40, 40, W2 - 80, H2 - 80));
    box(3.6, 3.6, 0.4, MAT.white, 0, 6.6, 23.25, p, 0.06); plane(3.4, 3.4, texMat(lg, { glow: 0.4 }), 0, 6.6, 23.46, 0, p);
    for (const ix of [-4.5, 4.5]) for (const iz of [14, 20]) cyl(0.25, 0.25, 5.2, MAT.white, ix, 2.8, iz, p, 16);
    brandPumps(p, '#f4f4f2', '#dd1d21');
    box(12, 4, 8, M('#3b3631'), 0, 2, 2, p, 0.05); box(12.2, 0.8, 8.2, M('#fbce07'), 0, 4.2, 2, p);
    box(9, 2.4, 0.05, M('#f2b872', { e: '#f2b872', ei: 0.35 }), 0, 1.5, 6.03, p, 0, false);
    plane(5, 0.6, texMat(textSign('Shell Select', '#fbce07', '#dd1d21', 640, 80, FONT(800, 58, false)), { glow: 0.3 }), 0, 4.2, 6.12, 0, p);
    brandTotem(p, -10, 30, '#fbce07', 'shell');
    placeCar('#cfd3d8', 'sedan', -4, 11.4, 0, p); placeCar('#283544', 'pickup', 4.6, 22.6, Math.PI, p);
    W.spots.shell = p;
  }
  function stationAxion(x, z = 0, ry = 0) {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; W.scene.add(p); forecourt(p);
    // techo blanco en "ala" curva, con el borde levantado
    const s = new THREE.Shape(); s.moveTo(-6.5, 0); s.quadraticCurveTo(0, -0.7, 6.5, 0.9); s.lineTo(6.5, 1.2); s.quadraticCurveTo(0, -0.35, -6.5, 0.35); s.closePath();
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 22, bevelEnabled: false, curveSegments: 24 }), M('#f6f6f6', { r: 0.4 }));
    wing.rotation.y = Math.PI / 2; put(wing, -11, 5.3, 17, p);
    const lg = signTex(768, 256, '#ffffff', (g, W2, H2) => fitImage(g, IMG.axion, 30, 20, W2 - 60, H2 - 40));
    box(6.4, 2.2, 0.5, MAT.white, 0, 7.6, 22.6, p, 0.05); plane(6.2, 2.1, texMat(lg, { glow: 0.4 }), 0, 7.6, 22.86, 0, p);
    for (const ix of [-4.5, 4.5]) for (const iz of [14, 20]) cyl(0.22, 0.22, 5.1, MAT.white, ix, 2.7, iz, p, 16);
    brandPumps(p, '#f4f4f6', '#1f2a6e');
    box(12, 4, 8, MAT.white, 0, 2, 2, p, 0.05); box(12.2, 0.7, 8.2, M('#1f2a6e'), 0, 4.15, 2, p);
    box(9, 2.4, 0.05, MAT.glass, 0, 1.5, 6.03, p, 0, false);
    plane(3, 0.55, texMat(textSign('spot!', '#1f2a6e', '#ffffff', 384, 72, FONT(800, 56, false)), { glow: 0.3 }), 0, 4.15, 6.12, 0, p);
    brandTotem(p, -10, 30, '#1f2a6e', 'axion');
    placeCar('#7a1e2b', 'suv', 4, 11.4, 0, p);
    W.spots.axion = p;
  }
  function stationPuma(x, z = 0, ry = 0) {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; W.scene.add(p); forecourt(p);
    // techo blanco con borde rojo en cuña
    const s = new THREE.Shape(); s.moveTo(-6, -0.35); s.lineTo(6, -0.35); s.lineTo(6.4, 0.75); s.lineTo(-6, 0.45); s.closePath();
    const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 22, bevelEnabled: false }), [M('#d71920', { r: 0.5 }), M('#f4f4f4', { r: 0.6 })]);
    wedge.rotation.y = Math.PI / 2; put(wedge, -11, 5.6, 17, p);
    const lg = signTex(1024, 192, '#ffffff', (g, W2, H2) => fitImage(g, IMG.puma, 20, 16, W2 - 40, H2 - 32));
    box(8, 1.5, 0.4, MAT.white, 0, 7.0, 23.4, p, 0.04); plane(7.8, 1.4, texMat(lg, { glow: 0.4 }), 0, 7.0, 23.61, 0, p);
    for (const ix of [-4.5, 4.5]) for (const iz of [14, 20]) cyl(0.25, 0.25, 5.3, M('#d71920'), ix, 2.85, iz, p, 16);
    brandPumps(p, '#f4f4f4', '#d71920');
    box(10, 3.8, 7, MAT.white, 0, 1.9, 2.5, p, 0.05); box(10.2, 0.6, 7.2, M('#1e7a3c'), 0, 3.9, 2.5, p);
    box(7.5, 2.3, 0.05, MAT.glass, 0, 1.45, 6.03, p, 0, false);
    brandTotem(p, -10, 30, '#d71920', 'puma');
    placeCar('#d6d0c4', 'sedan', 4.5, 22.6, Math.PI, p);
    W.spots.puma = p;
  }
  function stationBlanca(x, z = 0, ry = 0) {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; W.scene.add(p); forecourt(p, 26, 28);
    box(16, 0.7, 10, M('#eceae6', { r: 0.8 }), 0, 5.0, 17, p);
    plane(10, 0.55, texMat(textSign('ESTACIÓN  SAN MARTÍN', '#eceae6', '#5c6670', 1024, 64, FONT(700, 46)), { glow: 0.1 }), 0, 5.0, 22.06, 0, p);
    for (const ix of [-4, 4]) for (const iz of [14, 20]) cyl(0.2, 0.2, 4.7, M('#bfc3c6'), ix, 2.5, iz, p, 12);
    for (const iz of [14, 20]) { island(0, iz, p, 5); for (const ix of [-1.4, 1.4]) { box(0.85, 1.7, 0.55, M('#d9d6cf', { r: 0.7 }), ix, 1.05, iz, p, 0.03); box(0.87, 0.3, 0.57, M('#7b8a96'), ix, 1.95, iz, p, 0.03); } }
    box(7, 3.2, 5, M('#e7e2d8'), 0, 1.6, 4, p, 0.03); box(2, 2.2, 0.05, MAT.glassDark, 2, 1.1, 6.53, p, 0, false);
    // cartel de chapa con números cambiables
    const t = signTex(256, 384, '#f1efe9', (g, W2, H2) => { g.fillStyle = '#5c6670'; g.font = FONT(800, 48); g.textAlign = 'center'; g.fillText('NAFTA', W2 / 2, 70); g.fillText('GASOIL', W2 / 2, 220); g.fillStyle = '#20262c'; g.fillRect(40, 90, W2 - 80, 80); g.fillRect(40, 240, W2 - 80, 80); });
    box(1.8, 0.3, 0.3, M('#9aa0a6'), -11, 4.2, 28, p);
    cyl(0.1, 0.1, 4.2, M('#9aa0a6'), -11.7, 2.1, 28, p); cyl(0.1, 0.1, 4.2, M('#9aa0a6'), -10.3, 2.1, 28, p);
    box(1.9, 2.8, 0.12, M('#f1efe9'), -11, 5.6, 28, p);
    plane(1.8, 2.7, texMat(t), -11, 5.6, 28.07, 0, p);
    placeCar('#a1462d', 'pickup', -1.4, 11.4, 0, p);
    W.spots.blanca = p;
  }

  /* =========================================================================
     LAS CINCO FUERZAS EN ESCENA (alrededor de la Núcleo)
     proveedores: cisterna YPF descargando · sustitutos: auto eléctrico cargando
     rivalidad: la Shell de enfrente · nuevos ingresos: terreno con cartel de obra
     ========================================================================= */
  function cisterna(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; W.scene.add(g);
    box(2.4, 2.4, 2.5, M('#f4f5f5', { r: 0.4, m: 0.2 }), 5.0, 1.9, 0, g, 0.15);
    box(0.08, 0.95, 2.1, M('#26323c', { r: 0.1, m: 0.4 }), 6.22, 2.4, 0, g, 0.02);
    box(2.42, 0.3, 2.52, MAT.ypf, 5.0, 1.0, 0, g);
    const tank = cyl(1.25, 1.25, 8.6, M('#eef0f1', { r: 0.25, m: 0.55, env: 1.3 }), -0.9, 2.15, 0, g, 32); tank.rotation.z = Math.PI / 2;
    for (const dx of [-5.2, 3.4]) { const c = cyl(1.26, 1.26, 0.12, MAT.silver, -0.9 + dx * 0.98, 2.15, 0, g, 32); c.rotation.z = Math.PI / 2; }
    const band = cyl(1.27, 1.27, 2.4, MAT.ypf, -0.9, 2.15, 0, g, 32); band.rotation.z = Math.PI / 2;
    const lg = signTex(530, 206, '#ffffff', (gg, w, h) => fitImage(gg, IMG.ypf, 0, 0, w, h));
    for (const sd of [1, -1]) { const pl = plane(1.9, 0.74, texMat(lg, { glow: 0.3 }), -0.9, 2.15, sd * 1.28, sd > 0 ? 0 : Math.PI, g); }
    box(10.5, 0.3, 1.2, MAT.darkMetal, 0.5, 0.65, 0, g);
    for (const wx of [5.2, -2.6, -3.8, -5.0]) for (const sd of [1, -1]) { const t = cyl(0.5, 0.5, 0.34, MAT.rubber, wx, 0.5, sd * 1.05, g, 18); t.rotation.x = Math.PI / 2; }
    // mangueras de descarga hacia las bocas de tanque
    for (const k of [0, 1]) { const from = new THREE.Vector3(-2.2 - k * 1.2, 1.0, 1.15), to = new THREE.Vector3(-2.6 - k * 1.2, 0.06, 4.2); const c = new THREE.CatmullRomCurve3([from, new THREE.Vector3(from.x, 0.2, 2.2), to]); const m = new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.05, 8), M('#2c2f33', { r: 0.7 })); g.add(m); cyl(0.3, 0.3, 0.06, M(k ? '#2a8a3c' : '#2e66c6'), to.x, 0.06, to.z, g, 18); }
    for (const sx of [-6, 6.6]) { const cn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 14), M('#ff6a1a')); put(cn, sx, 0.3, 1.9, g); }
    const drv = person({ shirt: '#2a3b52', pants: '#2a2d33', skin: SKINS[1], cap: '#0a4686', pose: 'stand' }, g); drv.position.set(-3.2, 0, 2.6); drv.rotation.y = 0.3;
    return g;
  }
  function evCharge(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); W.scene.add(g);
    floor(6.4, 5.4, M('#3f8f5a', { r: 0.9 }), 0, 0.05, -2.2, g);
    for (const dx of [-1.6, 1.6]) {
      box(0.7, 1.8, 0.45, M('#f4f5f5', { r: 0.4 }), dx, 0.95, 0.4, g, 0.08);
      box(0.72, 0.25, 0.47, M('#3dae5b', { r: 0.4 }), dx, 1.9, 0.4, g, 0.06);
      plane(0.45, 0.32, texMat(signTex(128, 96, '#0d2a1a', (gg, w, h) => { gg.fillStyle = '#7dffb0'; gg.font = FONT(800, 44); gg.textAlign = 'center'; gg.fillText('EV', w / 2, 62); }), { glow: 0.8 }), dx, 1.35, 0.17, Math.PI, g);
    }
    const ev = car('#f2f4f6', 'suv', g); ev.position.set(-1.6, 0, -2.4); ev.rotation.y = Math.PI / 2;
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.6, 1.1, 0.16), new THREE.Vector3(-1.4, 0.25, -0.2), new THREE.Vector3(-0.75, 0.8, -1.2)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.03, 8), MAT.hose));
    plane(2.2, 0.5, texMat(textSign('CARGA ELÉCTRICA', '#3dae5b', '#ffffff', 512, 112, FONT(800, 64)), { glow: 0.4 }), 0, 2.6, 0.5, Math.PI, g);
    box(2.3, 0.6, 0.1, M('#3dae5b'), 0, 2.6, 0.56, g); cyl(0.06, 0.06, 2.4, MAT.silver, -1.05, 1.2, 0.6, g, 8); cyl(0.06, 0.06, 2.4, MAT.silver, 1.05, 1.2, 0.6, g, 8);
    return g;
  }
  function obra(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); W.scene.add(g);
    floor(30, 24, M('#b49a73', { r: 1 }), 0, 0.02, 0, g);
    for (let i = 0; i < 12; i++) { const st = box(0.08, 0.9, 0.08, M('#d2b48c'), -14 + (i % 6) * 5.6, 0.45, i < 6 ? -11.5 : 11.5, g); }
    for (const [cx, cz] of [[-6, 6], [-4.5, 6.8], [5, -3]]) { const cn = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 14), M('#ff6a1a')); put(cn, cx, 0.35, cz, g); }
    const mound = sph(3, M('#a4875f', { r: 1 }), 6, -0.8, 4, g, 12); mound.scale.set(1.4, 0.55, 1);
    // cartel de obra mirando a la ruta (-z)
    for (const dx of [-3, 3]) cyl(0.15, 0.15, 4.6, M('#8a6b4a'), dx, 2.3, -9, g, 8);
    box(7.6, 3.6, 0.2, MAT.white, 0, 5.6, -9, g);
    plane(7.4, 3.4, texMat(signTex(1024, 470, '#ffffff', (gg, w, h) => { gg.fillStyle = '#c4372c'; gg.fillRect(0, 0, w, 120); gg.fillStyle = '#fff'; gg.font = FONT(800, 92); gg.textAlign = 'center'; gg.fillText('PRÓXIMA APERTURA', w / 2, 92); gg.fillStyle = '#14263b'; gg.font = FONT(800, 120); gg.fillText('ESTACIÓN DE', w / 2, 270); gg.fillText('SERVICIO', w / 2, 400); }), { glow: 0.35 }), 0, 5.6, -9.11, Math.PI, g);
    return g;
  }

  /* =========================================================================
     MATRIZ DE PORTER vista desde arriba (lejos de todo, en z = -420)
     Cruz: rivalidad al centro, nuevos ingresos arriba, sustitutos abajo,
     proveedores a la izquierda, compradores a la derecha.
     ========================================================================= */
  function porter(PX, PZ) {
    const g = new THREE.Group(); g.position.set(PX, 0, PZ); W.scene.add(g);
    const pad = (x, z, w = 30, d = 20, col = '#c7c9c9') => { const m = floor(w, d, M(col, { r: 0.95 }), x, 0.06, z, g); return m; };
    const label = (x, z, name, lvl, col, sub) => {
      // cartel en el piso: nombre de la fuerza + nivel + qué la explica
      const ms = document.createElement('canvas').getContext('2d');
      ms.font = FONT(800, 130); const nw = ms.measureText(name).width; ms.font = FONT(800, 78); const lw = ms.measureText(lvl).width + 56;
      ms.font = FONT(600, 76, false); const sw = ms.measureText(sub).width;
      const CW = Math.ceil(Math.max(nw + lw + 130, sw + 80)), CH = 330, PXM = 32;
      const t = signTex(CW, CH, '#0c2038', (gg, W2, H2) => {
        gg.fillStyle = '#ffffff'; gg.font = FONT(800, 130); gg.textBaseline = 'middle'; gg.fillText(name, 40, 112);
        gg.fillStyle = col; gg.fillRect(nw + 74, 112 - 52, lw, 104);
        gg.fillStyle = '#fff'; gg.font = FONT(800, 78); gg.textAlign = 'center'; gg.fillText(lvl, nw + 74 + lw / 2, 116);
        gg.textAlign = 'left'; gg.fillStyle = '#c9d6e3'; gg.font = FONT(600, 76, false); gg.fillText(sub, 40, 250);
      });
      return floor(CW / PXM, CH / PXM, new THREE.MeshBasicMaterial({ map: t, toneMapped: false }), x, 0.09, z, g);
    };
    const arrow = (x, z, rot) => { const sh = new THREE.Shape(); sh.moveTo(-1.6, 2.4); sh.lineTo(1.6, 2.4); sh.lineTo(1.6, -0.6); sh.lineTo(3.4, -0.6); sh.lineTo(0, -4); sh.lineTo(-3.4, -0.6); sh.lineTo(-1.6, -0.6); sh.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), M('#0f5da8', { r: 0.6 })); m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(x, 0.1, z); g.add(m); };
    const roofTex = (bg, key) => signTex(512, 360, bg, (gg, W2, H2) => { gg.fillStyle = '#ffffff'; gg.fillRect(40, 60, W2 - 80, H2 - 120); fitImage(gg, IMG[key], 60, 80, W2 - 120, H2 - 160); });
    const miniCanopy = (x, z, bg, key) => {
      const top = texMat(roofTex(bg, key), { glow: 0.25 }), side = M(bg, { r: 0.5 });
      const c = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 5.6), [side, side, top, M('#e8eaeb'), side, side]); put(c, x, 4.2, z, g);
      for (const [cx, cz] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) cyl(0.15, 0.15, 4, MAT.white, x + cx, 2, z + cz, g, 8);
    };
    // RIVALIDAD (centro): tres marcas peleando el mismo cliente
    pad(0, 0, 40, 20);
    miniCanopy(-14.5, -1.5, '#0a4686', 'ypf'); miniCanopy(-4.8, -1.5, '#fbce07', 'shell'); miniCanopy(4.8, -1.5, '#1f2a6e', 'axion'); miniCanopy(14.5, -1.5, '#d71920', 'puma');
    for (const [x, c] of [[-14.5, '#c8352c'], [-4.8, '#e8e8e8'], [4.8, '#30343a'], [14.5, '#6f8fae']]) { const k = car(c, 'sedan', g); k.position.set(x, 0, 4.6); }
    label(0, 15, 'Rivalidad', 'ALTA', '#c4372c', '4 empresas, más del 90% del mercado');
    // NUEVOS INGRESOS (arriba): terreno en obra
    pad(0, -33, 30, 16, '#b49a73');
    const mound = sph(3.2, M('#a4875f', { r: 1 }), 6, -1, -36, g, 12); mound.scale.set(1.5, 0.6, 1);
    const exc = new THREE.Group(); exc.position.set(-6, 0, -37); g.add(exc);
    box(3, 1.2, 2, M('#f2c500'), 0, 1.2, 0, exc, 0.1); box(1.4, 1.4, 1.4, M('#f2c500'), -0.5, 2.4, 0, exc, 0.1); const arm = box(3.6, 0.35, 0.35, M('#e0b400'), 2.2, 2.6, 0, exc); arm.rotation.z = -0.5;
    box(3.2, 0.5, 2.4, MAT.rubber, 0, 0.3, 0, exc, 0.1);
    for (const [cx, cz] of [[-12, -42], [-9, -42], [12, -30], [9, -30]]) { const cn = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 14), M('#ff6a1a')); put(cn, cx, 0.5, cz, g); }
    label(43, -33, 'Nuevos ingresos', 'BAJA', '#23804a', 'Se entra comprando redes');
    arrow(0, -21, 0);
    // PROVEEDORES (izquierda): refinería y cisternas
    pad(-46, 0, 32, 22);
    for (const [x, z] of [[-54, -5], [-46, -6], [-54, 4]]) { cyl(3.2, 3.2, 4, M('#eef0f1', { r: 0.3, m: 0.5 }), x, 2, z, g, 32); const lt = floor(5, 1.95, texMat(signTex(530, 206, '#ffffff', (gg, w, h) => fitImage(gg, IMG.ypf, 0, 0, w, h)), { glow: 0.3 }), x, 4.05, z, g); }
    const t1 = cisterna(PX - 38, PZ + 5, 0); t1.scale.setScalar(0.85);
    label(-48, 16.5, 'Proveedores', 'MEDIA-BAJA', '#4b7a27', 'Refinación propia, al tope');
    arrow(-27, 0, Math.PI / 2);
    // COMPRADORES (derecha): gente cargando
    pad(48, 0, 32, 22);
    for (const iz of [-4, 4]) { box(10, 0.2, 1.2, MAT.curb, 48, 0.1, iz, g); for (const ix of [44, 52]) pumpYPF(ix, iz, g); }
    [[44, -6.4, '#c8352c', 'yaris'], [52, -6.4, '#e3e5e7', 'suv'], [44, 1.6, '#30343a', 'amarok'], [52, 6.4, '#6f8fae', 'sedan']].forEach(([x, z, c, k]) => { const o = car(c, k, g); o.position.set(x, 0, z); });
    for (const [x, z] of [[42.5, -4.9], [50.5, -4.9], [42.5, 2.9], [53.5, 4.9]]) { const pp = person({ shirt: ['#2f6f9f', '#c96f3d', '#3e7d6a', '#7a3fa0'][Math.floor(Math.abs(x + z)) % 4], pants: '#2f3540', skin: SKINS[Math.floor(Math.abs(x)) % 4], pose: 'pump' }, g); pp.position.set(x, 0.05, z); pp.rotation.y = z < 0 ? Math.PI : 0; }
    label(48, 16.5, 'Compradores', 'MEDIA', '#93600a', 'Sensibles al precio; cambiar es gratis');
    arrow(27, 0, -Math.PI / 2);
    // SUSTITUTOS (abajo): autos eléctricos cargando
    pad(0, 37, 34, 18, '#3f8f5a');
    floor(10, 10, texMat(signTex(400, 400, '#3f8f5a', (gg, w, h) => { gg.fillStyle = '#ffffff'; gg.fillRect(150, 60, 100, 200); gg.fillRect(160, 20, 22, 60); gg.fillRect(218, 20, 22, 60); gg.fillRect(188, 260, 24, 120); gg.fillStyle = '#3f8f5a'; gg.beginPath(); gg.moveTo(212, 90); gg.lineTo(175, 170); gg.lineTo(205, 170); gg.lineTo(188, 235); gg.lineTo(228, 150); gg.lineTo(198, 150); gg.closePath(); gg.fill(); }), { glow: 0.2 }), 0, 0.09, 37, g);
    const e1 = evCharge(PX - 11, PZ + 39); const e2 = evCharge(PX + 11, PZ + 39);
    label(42, 38, 'Sustitutos', 'MEDIA-BAJA', '#4b7a27', 'Eléctricos: 0,5% del parque');
    arrow(0, 24.5, Math.PI);
    return g;
  }

  /* =========================================================================
     TRÁNSITO en la ruta
     ========================================================================= */
  function traffic() {
    const list = [
      ['#c7ccd2', 'sedan', 1, 22], ['#0a4686', 'suv', -1, 19], ['#8e1d26', 'sedan', 1, 25], ['#f2f2f2', 'pickup', -1, 21],
      ['#2b2f36', 'sedan', 1, 23], ['#6f8a6a', 'suv', -1, 24],
    ];
    list.forEach(([c, k, dir, v], i) => {
      const o = car(c, k); const z = ROAD_Z + (dir > 0 ? -1.85 : 1.85);
      o.position.set(-900 + i * 300, 0.03, z); o.rotation.y = dir > 0 ? 0 : Math.PI;
      W.anim.push((t, dt) => { o.position.x += dir * v * dt; if (o.position.x > 1000) o.position.x = -1000; if (o.position.x < -1000) o.position.x = 1000; });
    });
    for (const [x0, dir] of [[-200, 1], [500, -1]]) {
      const tr = truck(dir > 0 ? '#e8e8e8' : '#c23a2b'); const z = ROAD_Z + (dir > 0 ? -1.85 : 1.85);
      tr.position.set(x0, 0.03, z); tr.rotation.y = dir > 0 ? 0 : Math.PI;
      W.anim.push((t, dt) => { tr.position.x += dir * 17 * dt; if (tr.position.x > 1000) tr.position.x = -1000; if (tr.position.x < -1000) tr.position.x = 1000; });
    }
  }

  /* =========================================================================
     CONSTRUCCIÓN
     ========================================================================= */
  W.build = function (scene) {
    W.scene = scene;
    commonMats();
    ypfHeadTex = signTex(256, 110, '#0a4686', (g, w, h) => fitImage(g, IMG.ypf, 30, 12, w - 60, h - 24));
    screenTex = signTex(160, 120, '#0e1a26', (g, w, h) => { g.fillStyle = '#7fd4ff'; g.font = FONT(700, 30); g.fillText('$ ----', 14, 44); g.fillStyle = '#ffb21a'; g.fillText('L  --,--', 14, 92); });
    totemTex = signTex(256, 1280, '#1b2433', (g, w, h) => {
      g.fillStyle = '#0a4686'; g.fillRect(14, 14, w - 28, 210); fitImage(g, IMG.ypf, 30, 40, w - 60, 160);
      g.fillStyle = '#f6f7f7'; g.fillRect(14, 240, w - 28, 120); g.fillStyle = '#2b2e33'; g.font = FONT(800, 92); g.textAlign = 'center'; g.fillText('full', w / 2, 330);
      ['SÚPER', 'INFINIA', 'INF. DIESEL', 'DIESEL 500'].forEach((t, i) => { const y = 390 + i * 170; g.fillStyle = '#0b1522'; g.fillRect(14, y, w - 28, 150); g.fillStyle = '#d7e3ef'; g.font = FONT(700, 40); g.fillText(t, w / 2, y + 50); g.fillStyle = '#ffb21a'; g.font = FONT(800, 66); g.fillText('- - - -', w / 2, y + 120); });
      g.fillStyle = '#0a4686'; g.fillRect(14, h - 200, w - 28, 186); g.fillStyle = '#fff'; g.font = FONT(800, 64); g.fillText('INFINIA', w / 2, h - 90);
    });
    landscape();
    stationNucleo();
    stationRefiplus();
    stationBlack();
    stationShell(40, 80, Math.PI); W.spots.rivalNorte = W.spots.shell;   // la Shell de enfrente (rivalidad)
    stationShell(-357); stationAxion(-338); stationPuma(-319); stationBlanca(-300);
    // la competencia, a escala 0,8 para que las cuatro entren juntas en cuadro
    for (const k of ['shell', 'axion', 'puma', 'blanca']) W.spots[k].scale.setScalar(0.8);
    W.spots.cisterna = cisterna(31, 7, Math.PI);
    W.spots.ev = evCharge(31, 23);
    W.spots.obra = obra(80, 62);
    W.spots.porter = porter(0, -420);
    traffic();
  };
})();
