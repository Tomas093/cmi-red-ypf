/* =========================================================================
   app.js · Render, cámara por diapositiva, transiciones y navegación.
   Teclas: flechas / espacio / clic avanzan · F pantalla completa · L modo liviano
   ========================================================================= */
(async function () {
  const SHOT = /shot/.test(location.search);
  if (SHOT) document.documentElement.classList.add('shot');
  let LITE = /lite/.test(location.search);

  /* ---------- render ---------- */
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.86;
  renderer.shadowMap.enabled = !LITE;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const HORIZON = new THREE.Color('#dfe9ef').convertSRGBToLinear();
  scene.fog = new THREE.Fog(HORIZON, 260, 1300);
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.3, 3000);

  // cielo: degradé de horizonte claro a cenit celeste
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#5d97cf') }, mid: { value: new THREE.Color('#a8cbe6') }, bot: { value: new THREE.Color('#dde8ee') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = max(vP.y, 0.0); vec3 c = mix(bot, mid, smoothstep(0.0, 0.12, h)); c = mix(c, top, smoothstep(0.12, 0.7, h)); gl_FragColor = vec4(c, 1.0); }',
  }));
  scene.add(sky);

  // luz: cielo + sol de media mañana + reflejos suaves de ambiente
  scene.add(new THREE.HemisphereLight(0xd6e8ff, 0x6f8a52, 0.42));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -72, right: 72, top: 72, bottom: -72, near: 1, far: 400 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const SUN_DIR = new THREE.Vector3(-0.45, 0.78, 0.43).normalize();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;

  /* ---------- mundo ---------- */
  await Promise.all([
    document.fonts.load('800 40px "Barlow Condensed"'), document.fonts.load('700 40px "Barlow Condensed"'),
    document.fonts.load('600 30px "Barlow"'), document.fonts.load('700 30px "Barlow"'),
    WORLD.loadImages(),
  ]).catch(() => {});
  WORLD.build(scene);

  /* ---------- puntos de vista ----------
     El panel de texto ocupa la izquierda: cada encuadre deja el tema en la
     mitad derecha. pos = cámara, look = adónde mira. */
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const SHOTS = {
    portada:    { pos: V(-72, 22, 72),   look: V(-28, 1, -8) },
    estacion:   { pos: V(225, 55, 110),  look: V(0, 0, 8) },
    fuerzas:    { pos: V(-24, 158, -418.5), look: V(-24, 0, -419.5), still: true },
    estrategia: { pos: V(-50, 7, 52),    look: V(-14, 3, 8) },
    refiplus:   { pos: V(-62, 4.2, 52),  look: V(-93, 3, 13) },
    nucleo:     { pos: V(40, 3.8, 38),   look: V(-8, 3, 6) },
    black:      { pos: V(157, 3.6, 39),  look: V(115, 3.5, 2) },
    rivales:    { pos: V(-352, 5, 104),  look: V(-352, 8.5, 12) },
    full:       { pos: V(-20.6, 2.2, -7.0), look: V(-6, 1.3, -16.5) },
    full2:      { pos: V(-1.5, 2.1, -8.0), look: V(-18, 1.4, -18) },
    carga:      { pos: V(4.8, 2.1, 9.4), look: V(-2.4, 0.95, 8.6) },
    cenital:    { pos: V(40, 36, 52),    look: V(-6, 0, 2) },
    chequeo:    { pos: V(14.2, 2.2, -8.6), look: V(13.2, 2.4, -22) },
    salida:     { pos: V(-72, 22, 72),   look: V(-28, 1, -8) },
  };
  // interiores: se entra y se sale por la puerta (FULL) o por el portón (Boxes)
  const DOOR = WORLD.spots.fullDoors;
  const ROOMS = {
    // a la FULL se llega por el costado libre de la playa (sin cruzar islas) y se entra por la puerta
    full:  { keys: ['full', 'full2'], path: [V(-13.6, 2.6, 32), V(-13.6, 2.2, 14), V(DOOR.x, 1.8, DOOR.z + 9), V(DOOR.x, 1.75, DOOR.z + 1.5), V(DOOR.x, 1.75, DOOR.z - 2.5)] },
    // a Boxes se entra por la bahía libre, desde el costado este
    boxes: { keys: ['chequeo'],       path: [V(32, 3, -1), V(18, 2.6, -1.5), V(18, 2.4, -8)] },
    // al pico se llega por el carril, desde el este
    carga: { keys: ['carga'],         path: [V(20, 7, 12.5), V(9, 1.9, 8.4)] },
  };
  const roomOf = (k) => Object.keys(ROOMS).find((r) => ROOMS[r].keys.includes(k)) || null;

  /* ---------- transición ---------- */
  let key = null, curve = null, t0 = 0, dur = 2500, arrived = 0;
  const look = V(0, 0, 0), lookA = V(0, 0, 0), lookB = V(0, 0, 0);
  function go(k, instant) {
    const s = SHOTS[k], prev = key; key = k;
    if (instant || !prev) { camera.position.copy(s.pos); look.copy(s.look); curve = null; arrived = performance.now(); return; }
    const pts = [camera.position.clone()];
    const ra = roomOf(prev), rb = roomOf(k), change = ra !== rb;
    if (change && ra) pts.push(...ROOMS[ra].path.slice().reverse());
    const target = change && rb ? ROOMS[rb].path[0] : s.pos;
    // vuelo largo: sube como una grúa para no atravesar nada
    const a = pts[pts.length - 1], dist = a.distanceTo(target);
    if (dist > 25) { const m = a.clone().lerp(target, 0.5); m.y = Math.max(a.y, target.y, 18 + dist * 0.12); pts.push(m); }
    if (change && rb) pts.push(...ROOMS[rb].path);
    pts.push(s.pos.clone());
    // sin puntos repetidos (rompen la curva)
    const clean = pts.filter((q, i) => i === 0 || q.distanceTo(pts[i - 1]) > 0.05);
    if (clean.length < 2) { camera.position.copy(s.pos); look.copy(s.look); curve = null; arrived = performance.now(); return; }
    curve = new THREE.CatmullRomCurve3(clean, false, 'catmullrom', 0.5);
    lookA.copy(look); lookB.copy(s.look);
    const len = curve.getLength();
    dur = Number.isFinite(len) ? THREE.MathUtils.clamp(len * 7, 1900, 3200) : 2400;
    t0 = performance.now();
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- tamaño ---------- */
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(LITE ? 1 : Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    // mantener el campo horizontal de 16:9 aunque la pantalla sea 16:10 o 4:3
    camera.aspect = w / h;
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(38) / 2) * (16 / 9));
    camera.fov = Math.max(38, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / camera.aspect)));
    camera.updateProjectionMatrix();
    document.getElementById('stage').style.transform = `translate(-50%,-50%) scale(${Math.min(w / 1920, h / 1080)})`;
  }
  addEventListener('resize', resize); resize();

  /* ---------- bucle ---------- */
  let last = performance.now(), lastFrame = 0, clock = 0;
  const tmp = V(0, 0, 0), focus = V(0, 0, 0);
  function frame(now) {
    lastFrame = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    if (curve) {
      const t = THREE.MathUtils.clamp((now - t0) / dur, 0, 1), e = ease(t);
      camera.position.copy(curve.getPoint(e));
      // durante el vuelo, mirar un poco hacia adelante en el recorrido
      const ahead = curve.getPoint(Math.min(1, e + 0.12));
      ahead.y = THREE.MathUtils.lerp(lookA.y, lookB.y, e);   // no mirar al cielo al subir
      const blend = Math.sin(Math.PI * e) * 0.55;
      look.lerpVectors(lookA, lookB, e).lerp(ahead, blend);
      if (t >= 1) { curve = null; arrived = now; look.copy(lookB); }
    } else if (key) {
      const s = SHOTS[key], k = (now - arrived) / 1000;
      // respiración mínima de la cámara, casi imperceptible
      if (s.still) tmp.set(0, 0, 0); else tmp.set(Math.sin(k * 0.21) * 0.06, Math.sin(k * 0.33) * 0.03, Math.cos(k * 0.17) * 0.06);
      camera.position.copy(s.pos).add(tmp); look.copy(s.look);
    }
    camera.lookAt(look);
    // puertas automáticas de la FULL
    const near = Math.hypot(camera.position.x - DOOR.x, camera.position.z - DOOR.z) < 7;
    const target = near ? 1.15 : 0;
    const o = DOOR.doorL.userData.o = (DOOR.doorL.userData.o || 0) + (target - (DOOR.doorL.userData.o || 0)) * Math.min(1, dt * 5);
    DOOR.doorL.position.x = DOOR.x - 0.6 - o; DOOR.doorR.position.x = DOOR.x + 0.6 + o;
    // la sombra sigue a lo que se mira
    focus.copy(look); focus.y = 0;
    sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(SUN_DIR, 160);
    for (const f of WORLD.anim) f(clock, dt);
    renderer.render(scene, camera);
  }
  function loop(now) { frame(now); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  // respaldo: si el navegador pausa requestAnimationFrame, seguir dibujando
  setInterval(() => { if (performance.now() - lastFrame > 150) frame(performance.now()); }, 33);

  /* ---------- navegación ---------- */
  const slides = [...document.querySelectorAll('.slide')];
  const parts = [...document.querySelectorAll('#prog span')];
  const counter = document.getElementById('counter');
  const N = slides.length; let cur = -1;
  function show(i, instant) {
    i = Math.max(0, Math.min(N - 1, i)); if (i === cur) return;
    slides.forEach((s, k) => s.classList.toggle('active', k === i));
    parts.forEach((p) => p.classList.toggle('on', p.dataset.p === slides[i].dataset.part));
    counter.textContent = `${i + 1} / ${N}`;
    go(slides[i].dataset.cam, instant || SHOT);
    cur = i; history.replaceState(null, '', location.pathname + location.search + '#' + (i + 1));
  }
  addEventListener('keydown', (e) => {
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); show(cur + 1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); show(cur - 1); }
    else if (e.key === 'Home') show(0); else if (e.key === 'End') show(N - 1);
    else if (e.key === 'f' || e.key === 'F') { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); }
    else if (e.key === 'l' || e.key === 'L') { LITE = !LITE; renderer.shadowMap.enabled = !LITE; scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); }); resize(); }
  });
  addEventListener('click', (e) => { if (e.clientX < innerWidth * 0.2) show(cur - 1); else show(cur + 1); });
  const start = parseInt((location.hash || '').slice(1), 10);
  show(isNaN(start) ? 0 : start - 1, true);
  window.__ready = true;
  window.APP = { camera, SHOTS, show, get key() { return key; } };
})();
