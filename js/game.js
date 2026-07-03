// Countertop King — main game logic.
(function () {
  const M = window.Models;
  const audio = window.GameAudio;

  // ---------- constants ----------
  const LANE_X = [-1.3, 0, 1.3];   // counter lanes
  const FLOOR_X = 3.4;             // floor "lane" to the right of the counter
  const COUNTER_TOP = 1.4;
  const CHUNK_LEN = 14;
  const GEN_AHEAD = 95;
  const GRAVITY = 34;
  const JUMP_V = 11.5;
  const CLIMB_V = 12.5;            // hop from floor back up to the counter
  const START_SPEED = 6.5;
  const MAX_SPEED = 22;
  const FLOOR_DRAIN = 3;           // points per second on the floor
  const SPRAY_PENALTY = 100;
  const KNOCK_POINTS = 25;

  const CAT_INFO = {
    kyle: { name: 'Kyle', palette: M.PALETTES.kyle },
    malcolm: { name: 'Malcolm', palette: M.PALETTES.malcolm }
  };

  // ---------- DOM ----------
  const el = (id) => document.getElementById(id);
  const ui = {
    select: el('select'), hud: el('hud'), gameover: el('gameover'), paused: el('paused'),
    score: el('score'), best: el('best'), meters: el('meters'),
    floorWarn: el('floor-warn'), popups: el('popups'), splash: el('splash-flash'),
    reason: el('reason'), finalScore: el('final-score'), finalMeters: el('final-meters'),
    finalBest: el('final-best'), newbest: el('newbest')
  };

  // ---------- three.js setup ----------
  const scene = new THREE.Scene();
  const BG = 0xf7e8d0;
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 30, 72);

  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 120);
  camera.position.set(0, 4, 8);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x9a8a78, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 45;
  scene.add(sun);
  scene.add(sun.target);

  // checkered kitchen floor — one big plane that follows the cat,
  // texture offset keeps the pattern fixed in world space
  function makeCheckerTexture() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    c.fillStyle = '#d9a878';
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#bf8d5a';
    c.fillRect(0, 0, 32, 32);
    c.fillRect(32, 32, 32, 32);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const floorTex = makeCheckerTexture();
  const FLOOR_LEN = 80;
  floorTex.repeat.set(5.6, FLOOR_LEN / 2); // one checker pair per 2 world units
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(11.2, FLOOR_LEN),
    new THREE.MeshLambertMaterial({ map: floorTex })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(3.05, 0, 0);
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ---------- state ----------
  let state = 'select';            // select | playing | paused | over
  let selectedCat = 'kyle';
  let catMesh = null;
  let best = Number(localStorage.getItem('countertop-king-best') || 0);
  ui.best.textContent = best;

  const sim = {};
  let chunks = [];
  let flying = [];
  let arm = null;
  const keys = {};
  let shake = 0;
  let animT = 0;
  let camY = 4;

  // ---------- world generation ----------
  function addCounterPiece(group, zNear, zFar) {
    const len = zNear - zFar;
    if (len <= 0.01) return;
    const cz = (zNear + zFar) / 2;
    const body = M.box(3.8, 1.26, len, 0x6e4f38);
    body.position.set(0, 0.63, cz);
    body.receiveShadow = true;
    group.add(body);
    const top = M.box(4.25, 0.14, len, 0xe9e4da);
    top.position.set(0, COUNTER_TOP - 0.07, cz);
    top.receiveShadow = true;
    group.add(top);
  }

  function addRoomPieces(group, zStart, zEnd) {
    const len = zStart - zEnd;
    const cz = (zStart + zEnd) / 2;
    const seed = Math.abs(Math.round(zStart / CHUNK_LEN));

    const wallL = M.box(0.25, 3.8, len, 0xead9c4);
    wallL.position.set(-2.55, 1.9, cz);
    wallL.receiveShadow = true;
    wallL.castShadow = false;
    group.add(wallL);

    if (seed % 2 === 0) {
      const cab = M.box(0.8, 1.1, len * 0.7, 0x7b5a40);
      cab.position.set(-2.02, 2.85, cz);
      group.add(cab);
    } else {
      const win = M.box(0.08, 1.4, 2.6, 0xa8d8ef);
      win.position.set(-2.4, 2.4, cz);
      win.castShadow = false;
      group.add(win);
    }

    const wallR = M.box(0.25, 3.8, len, 0xf1e6d2);
    wallR.position.set(8.6, 1.9, cz);
    wallR.receiveShadow = true;
    wallR.castShadow = false;
    group.add(wallR);

    if (seed % 3 === 0) {
      const fridge = M.box(1.5, 2.6, 1.3, 0xb8c0c8);
      fridge.position.set(7.6, 1.3, cz + (seed % 2 ? 2 : -2));
      group.add(fridge);
      const handleF = M.box(0.06, 0.8, 0.06, 0x888e96);
      handleF.position.set(6.82, 1.5, fridge.position.z - 0.5);
      group.add(handleF);
    } else if (seed % 3 === 1) {
      const pot = M.cyl(0.3, 0.22, 0.5, 0xb06a3a);
      pot.position.set(7.4, 0.25, cz - 2);
      group.add(pot);
      const leaves = M.sph(0.5, 0x4a8a3a);
      leaves.position.set(7.4, 0.9, cz - 2);
      group.add(leaves);
    }
  }

  function pickFood(safe) {
    const meats = M.FOODS.filter(f => f.meat);
    if (safe) return meats[Math.floor(Math.random() * meats.length)];
    if (Math.random() < 0.55) return meats[Math.floor(Math.random() * meats.length)];
    const produce = M.FOODS.filter(f => !f.meat);
    return produce[Math.floor(Math.random() * produce.length)];
  }

  function populateChunk(chunk, safe) {
    const meters = -chunk.zEnd;
    const diff = Math.min(1, Math.max(0, (meters - 40) / 500));
    const placed = [];
    const zMin = chunk.zEnd + 1.3;
    const zMax = chunk.zStart - 1.3;

    function nearGap(z, margin) {
      return chunk.gap && z < chunk.gap.z0 + margin && z > chunk.gap.z1 - margin;
    }

    function findSpot(kind, gapMargin) {
      for (let i = 0; i < 14; i++) {
        const lane = Math.floor(Math.random() * 3);
        const z = zMin + Math.random() * (zMax - zMin);
        if (nearGap(z, gapMargin)) continue;
        let ok = true;
        for (const p of placed) {
          const d = Math.abs(p.z - z);
          if (kind === 'obstacle' && p.kind === 'obstacle' && d < 2.4) { ok = false; break; }
          if (p.lane === lane && d < 1.4) { ok = false; break; }
        }
        if (ok) return { lane, z };
      }
      return null;
    }

    // obstacles: stoves & sinks
    let obsCount = 0;
    if (!safe) {
      if (Math.random() < 0.8) obsCount++;
      if (Math.random() < diff * 0.8) obsCount++;
    }
    for (let i = 0; i < obsCount; i++) {
      const spot = findSpot('obstacle', 3.0);
      if (!spot) continue;
      const def = M.OBSTACLES[Math.floor(Math.random() * M.OBSTACLES.length)];
      const mesh = def.build();
      mesh.position.set(LANE_X[spot.lane], COUNTER_TOP, spot.z);
      chunk.group.add(mesh);
      chunk.items.push({ kind: 'obstacle', type: def.type, lane: spot.lane, z: spot.z, x: LANE_X[spot.lane], height: def.height, mesh });
      placed.push({ kind: 'obstacle', lane: spot.lane, z: spot.z });
    }

    // foods
    let foodCount = 2 + Math.floor(Math.random() * 3);
    while (foodCount-- > 0) {
      const def = pickFood(safe);
      const spot = findSpot('food', 1.4);
      if (!spot) continue;
      const count = (!safe && def.meat && Math.random() < 0.3) ? 3 : 1;
      for (let t = 0; t < count; t++) {
        const z = spot.z - t * 1.15;
        if (z < zMin || nearGap(z, 1.2)) break;
        if (t > 0) {
          let blocked = false;
          for (const p of placed) {
            if (p.lane === spot.lane && Math.abs(p.z - z) < 1.0) { blocked = true; break; }
          }
          if (blocked) break;
        }
        const mesh = def.build();
        const x = LANE_X[spot.lane] + (Math.random() - 0.5) * 0.25;
        mesh.position.set(x, COUNTER_TOP, z);
        chunk.group.add(mesh);
        chunk.items.push({ kind: 'food', def, lane: spot.lane, z, x, mesh, baseY: COUNTER_TOP + 0.06, phase: Math.random() * 6 });
        placed.push({ kind: 'food', lane: spot.lane, z });
      }
    }

    // knockables
    let knockCount = (Math.random() < 0.75 ? 1 : 0) + (Math.random() < 0.35 ? 1 : 0);
    while (knockCount-- > 0) {
      const spot = findSpot('knock', 1.4);
      if (!spot) continue;
      const def = M.KNOCKABLES[Math.floor(Math.random() * M.KNOCKABLES.length)];
      const mesh = def.build();
      const x = LANE_X[spot.lane] + (Math.random() - 0.5) * 0.3;
      mesh.position.set(x, COUNTER_TOP, spot.z);
      chunk.group.add(mesh);
      chunk.items.push({ kind: 'knock', name: def.name, lane: spot.lane, z: spot.z, x, mesh });
      placed.push({ kind: 'knock', lane: spot.lane, z: spot.z });
    }
  }

  function spawnChunk() {
    const zStart = sim.nextChunkZ;
    const zEnd = zStart - CHUNK_LEN;
    sim.nextChunkZ = zEnd;
    const group = new THREE.Group();
    const chunk = { zStart, zEnd, group, gap: null, items: [] };
    const safe = zStart > -30;
    const meters = -zEnd;
    const diff = Math.min(1, Math.max(0, (meters - 40) / 500));

    if (!safe && !sim.lastChunkHadGap && Math.random() < 0.16 + diff * 0.22) {
      const gapLen = 2.4 + Math.random() * 0.9;
      chunk.gap = { z0: zStart - 1.5, z1: zStart - 1.5 - gapLen };
    }
    sim.lastChunkHadGap = !!chunk.gap;

    if (chunk.gap) {
      addCounterPiece(group, zStart, chunk.gap.z0);
      addCounterPiece(group, chunk.gap.z1, zEnd);
    } else {
      addCounterPiece(group, zStart, zEnd);
    }
    addRoomPieces(group, zStart, zEnd);
    populateChunk(chunk, safe);

    scene.add(group);
    chunks.push(chunk);
  }

  function disposeGroup(group) {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    scene.remove(group);
  }

  function ensureChunks() {
    while (sim.nextChunkZ > sim.z - GEN_AHEAD) spawnChunk();
    chunks = chunks.filter((c) => {
      if (c.zEnd > sim.z + 16) { disposeGroup(c.group); return false; }
      return true;
    });
  }

  function inGap(z) {
    for (const c of chunks) {
      if (c.gap && z < c.gap.z0 && z > c.gap.z1) return true;
    }
    return false;
  }

  // ---------- run lifecycle ----------
  function newRun() {
    // clear previous world
    for (const c of chunks) disposeGroup(c.group);
    chunks = [];
    for (const f of flying) scene.remove(f.mesh);
    flying = [];
    removeArm();
    if (catMesh) scene.remove(catMesh);
    ui.popups.innerHTML = '';

    Object.assign(sim, {
      z: 0, lane: 1, x: LANE_X[1], y: COUNTER_TOP, vy: 0,
      onGround: true, lastGroundT: 0, t: 0,
      score: 0, speed: START_SPEED,
      nextChunkZ: 30, lastChunkHadGap: false,
      sprayTimer: 11, dead: false, deathT: 0, deathReason: ''
    });

    catMesh = M.buildCat(CAT_INFO[selectedCat].palette);
    catMesh.position.set(sim.x, sim.y, sim.z);
    scene.add(catMesh);

    ensureChunks();
    camY = COUNTER_TOP + 2.7;

    ui.select.classList.add('hidden');
    ui.gameover.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ui.floorWarn.classList.add('hidden');
    state = 'playing';
    audio.meow();
  }

  function endRun(reason) {
    if (state !== 'playing') return;
    sim.dead = true;
    sim.deathT = 0;
    sim.deathReason = reason;
    state = 'over';
    shake = 0.5;
    audio.thud();
    setTimeout(() => audio.over(), 350);

    const score = Math.round(sim.score);
    const isBest = score > best;
    if (isBest) {
      best = score;
      localStorage.setItem('countertop-king-best', String(best));
      ui.best.textContent = best;
    }
    const name = CAT_INFO[selectedCat].name;
    const messages = {
      stove: name + ' face-planted into a hot stove! 🔥',
      sink: name + ' tumbled into the sink! 🛁',
      gap: name + ' fell into the gap between counters! 🕳️',
      broke: name + ' went bankrupt — score dropped below zero! 📉'
    };
    ui.reason.textContent = messages[reason] || (name + ' wiped out!');
    ui.finalScore.textContent = score;
    ui.finalMeters.textContent = Math.round(-sim.z) + ' m';
    ui.finalBest.textContent = best;
    ui.newbest.classList.toggle('hidden', !isBest);
    setTimeout(() => {
      if (state === 'over') {
        ui.gameover.classList.remove('hidden');
        ui.hud.classList.add('hidden');
        ui.floorWarn.classList.add('hidden');
      }
    }, 900);
  }

  // ---------- popups & effects ----------
  function popup(text, cls) {
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    d.style.marginLeft = (Math.random() * 120 - 60) + 'px';
    d.style.top = (36 + Math.random() * 10) + '%';
    ui.popups.appendChild(d);
    setTimeout(() => d.remove(), 1150);
  }

  function splashFlash() {
    ui.splash.classList.remove('active');
    void ui.splash.offsetWidth; // restart animation
    ui.splash.classList.add('active');
  }

  // ---------- scoring events ----------
  function collectFood(item) {
    item.dead = true;
    item.mesh.visible = false;
    sim.score += item.def.value;
    if (item.def.value > 0) {
      popup('+' + item.def.value + ' ' + item.def.emoji + ' ' + item.def.name + '!', 'good');
      audio.eat();
    } else {
      popup(item.def.value + ' ' + item.def.emoji + ' ' + item.def.name + '... yuck!', 'bad');
      audio.yuck();
    }
  }

  const KNOCK_WORDS = ['CRASH!', 'SMASH!', 'Oops!', 'Whoops!', 'Not the good china!'];
  function knockItem(item) {
    item.dead = true;
    sim.score += KNOCK_POINTS;
    popup('+' + KNOCK_POINTS + ' ' + KNOCK_WORDS[Math.floor(Math.random() * KNOCK_WORDS.length)], 'good');
    audio.knock();
    // reparent to scene (children already sit at world coords) and toss it off the counter
    item.mesh.parent.remove(item.mesh);
    scene.add(item.mesh);
    flying.push({
      mesh: item.mesh,
      vx: 2.5 + Math.random() * 2.5,
      vy: 2.5 + Math.random() * 1.5,
      vz: (Math.random() - 0.5) * 2,
      rx: Math.random() * 8 - 4,
      rz: Math.random() * 8 - 4,
      life: 2
    });
  }

  // ---------- spray arm ----------
  function spawnArm() {
    const lane = (sim.lane < 3 && Math.random() < 0.75) ? sim.lane : Math.floor(Math.random() * 3);
    const parts = M.buildSprayArm();
    const z = sim.z - 36;
    parts.group.position.set(LANE_X[lane] - 3.5, COUNTER_TOP + 0.55, z);
    scene.add(parts.group);
    arm = { parts, lane, z, phase: 'warn', t: 0, hit: false, targetX: LANE_X[lane] };
    audio.warn();
  }

  function removeArm() {
    if (!arm) return;
    disposeGroup(arm.parts.group);
    arm = null;
  }

  function updateArm(dt) {
    if (!arm) {
      sim.sprayTimer -= dt;
      if (sim.sprayTimer <= 0 && -sim.z > 60) spawnArm();
      return;
    }
    arm.t += dt;
    const g = arm.parts.group;

    if (arm.phase === 'warn') {
      const k = Math.min(1, arm.t / 0.35);
      g.position.x = arm.targetX - 3.5 * (1 - k * k);
      arm.parts.warn.visible = Math.sin(arm.t * 22) > -0.2;
      if (arm.t > 0.9) {
        arm.phase = 'spray';
        arm.parts.warn.visible = false;
        arm.parts.stream.visible = true;
        for (const d of arm.parts.drops) d.visible = true;
      }
    } else if (arm.phase === 'spray') {
      // animate droplets along the stream
      arm.parts.drops.forEach((d, i) => {
        const p = (arm.t * 1.8 + i / arm.parts.drops.length) % 1;
        d.position.set(
          Math.sin(p * 25 + i * 3) * 0.06,
          0.36 - p * p * 0.7,
          0.15 + p * 5.2
        );
      });
      // hit check
      if (!arm.hit && sim.lane === arm.lane && sim.lane < 3 &&
          sim.z < arm.z + 5.6 && sim.z > arm.z - 1.2 &&
          sim.y < COUNTER_TOP + 1.2) {
        arm.hit = true;
        sim.score -= SPRAY_PENALTY;
        popup('-' + SPRAY_PENALTY + ' 💦 SQUIRT!', 'bad big');
        splashFlash();
        audio.splash();
        shake = 0.35;
      }
      if (sim.z < arm.z - 5) {
        arm.phase = 'retract';
        arm.t = 0;
        arm.parts.stream.visible = false;
        for (const d of arm.parts.drops) d.visible = false;
      }
    } else { // retract
      g.position.x = arm.targetX - arm.t * 9;
      if (arm.t > 0.6) {
        removeArm();
        sim.sprayTimer = 9 + Math.random() * 7;
      }
    }
  }

  // ---------- input ----------
  function moveLane(dir) {
    if (dir < 0) {
      if (sim.lane === 3) {
        if (sim.onGround) {
          sim.lane = 2;
          sim.vy = CLIMB_V;
          sim.onGround = false;
          audio.jump();
        }
      } else if (sim.lane > 0) {
        sim.lane--;
      }
    } else {
      if (sim.lane === 2) {
        sim.lane = 3; // hop down off the counter
        if (sim.onGround) { sim.vy = 2; sim.onGround = false; }
      } else if (sim.lane < 2) {
        sim.lane++;
      }
    }
  }

  function jump() {
    if (sim.onGround || sim.t - sim.lastGroundT < 0.1) {
      sim.vy = JUMP_V;
      sim.onGround = false;
      sim.lastGroundT = -99;
      audio.jump();
    }
  }

  // one-shot fast-fall for a swipe-down (keyboard uses a held ArrowDown instead)
  function diveNow() {
    if (!sim.onGround) sim.vy = Math.min(sim.vy, -18);
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      ui.paused.classList.remove('hidden');
    } else if (state === 'paused') {
      state = 'playing';
      ui.paused.classList.add('hidden');
    }
  }

  function toggleMute() {
    const muted = audio.toggleMute();
    const btn = document.getElementById('mute-btn');
    if (btn) btn.textContent = muted ? '🔇' : '🔊';
    popup(muted ? '🔇 Muted' : '🔊 Sound on', 'good');
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    audio.unlock();
    keys[e.key] = true;
    const k = e.key.toLowerCase();

    if (k === 'm') {
      toggleMute();
      return;
    }

    if (state === 'select') {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        setSelected(selectedCat === 'kyle' ? 'malcolm' : 'kyle');
      } else if (e.key === 'Enter' || e.key === ' ') {
        newRun();
      }
    } else if (state === 'playing') {
      if (e.key === 'ArrowLeft' || k === 'a') moveLane(-1);
      else if (e.key === 'ArrowRight' || k === 'd') moveLane(1);
      else if (e.key === 'ArrowUp' || k === 'w') jump();
      else if (k === 'p' || e.key === 'Escape') {
        state = 'paused';
        ui.paused.classList.remove('hidden');
      }
    } else if (state === 'paused') {
      if (k === 'p' || e.key === 'Escape' || e.key === ' ') {
        state = 'playing';
        ui.paused.classList.add('hidden');
      }
    } else if (state === 'over' && !ui.gameover.classList.contains('hidden')) {
      if (e.key === ' ' || e.key === 'Enter') newRun();
      else if (k === 'c') {
        ui.gameover.classList.add('hidden');
        ui.select.classList.remove('hidden');
        state = 'select';
      }
    }
  });

  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') {
      state = 'paused';
      ui.paused.classList.remove('hidden');
    }
  });

  // ---------- touch / swipe input ----------
  const SWIPE_MIN = 26;   // px before a drag counts as a swipe
  let touchStart = null;

  function markTouch() {
    if (!document.body.classList.contains('touch')) {
      document.body.classList.add('touch');
    }
  }

  window.addEventListener('touchstart', (e) => {
    markTouch();
    audio.unlock();
    // let taps on real buttons / cards behave normally
    const tgt = e.target;
    if (tgt && tgt.closest && tgt.closest('button, .card')) { touchStart = null; return; }
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
    if (state === 'playing') e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (state === 'playing') e.preventDefault();  // block scroll / pull-to-refresh mid-run
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const isSwipe = Math.max(adx, ady) >= SWIPE_MIN;

    if (state === 'playing') {
      if (!isSwipe) { jump(); return; }             // tap = jump
      if (adx > ady) moveLane(dx > 0 ? 1 : -1);     // horizontal swipe = lanes
      else if (dy < 0) jump();                        // swipe up = jump
      else diveNow();                                 // swipe down = dive
    } else if (state === 'select') {
      if (isSwipe && adx > ady) {
        setSelected(selectedCat === 'kyle' ? 'malcolm' : 'kyle');
      }
    } else if (state === 'paused') {
      togglePause();                                  // tap anywhere to resume
    } else if (state === 'over' && !ui.gameover.classList.contains('hidden')) {
      newRun();                                        // tap to run again
    }
  });

  // on-screen buttons (touch, but clickable on desktop too)
  document.getElementById('pause-btn').addEventListener('click', () => { markTouch(); togglePause(); });
  document.getElementById('mute-btn').addEventListener('click', () => { markTouch(); audio.unlock(); toggleMute(); });
  document.getElementById('again-btn').addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); newRun(); });
  document.getElementById('change-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    ui.gameover.classList.add('hidden');
    ui.select.classList.remove('hidden');
    state = 'select';
  });

  // ---------- character select ----------
  function setSelected(id) {
    selectedCat = id;
    document.querySelectorAll('.card').forEach((c) => {
      c.classList.toggle('selected', c.dataset.cat === id);
    });
  }
  document.querySelectorAll('.card').forEach((c) => {
    c.addEventListener('click', () => {
      audio.unlock();
      setSelected(c.dataset.cat);
      newRun();
    });
  });
  setSelected('kyle');

  // ---------- main update ----------
  function updatePlaying(dt) {
    sim.t += dt;
    const meters = -sim.z;
    sim.speed = Math.min(MAX_SPEED, START_SPEED + meters * 0.012);
    sim.z -= sim.speed * dt;

    // lane position
    const targetX = sim.lane < 3 ? LANE_X[sim.lane] : FLOOR_X;
    sim.x += (targetX - sim.x) * Math.min(1, dt * 11);

    // vertical physics
    const prevY = sim.y;
    const overGap = sim.lane < 3 && inGap(sim.z);
    const groundY = sim.lane < 3 ? (overGap ? -999 : COUNTER_TOP) : 0;
    sim.vy -= GRAVITY * dt;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) sim.vy -= 60 * dt;
    sim.y += sim.vy * dt;

    if (sim.vy <= 0 && prevY >= groundY - 0.001 && sim.y <= groundY) {
      sim.y = groundY;
      sim.vy = 0;
      sim.onGround = true;
      sim.lastGroundT = sim.t;
    } else {
      sim.onGround = false;
    }

    // fell into a counter gap
    if (overGap && sim.y < COUNTER_TOP - 0.9) {
      endRun('gap');
      return;
    }

    // scoring: earn distance points only up on the counter; the floor is a
    // net loss (no distance points + a steady drain), so it can't be farmed.
    const onFloor = sim.lane === 3 && sim.y < 0.05;
    if (onFloor) sim.score -= FLOOR_DRAIN * dt;
    else sim.score += sim.speed * dt; // 1 point per meter run on the counter
    ui.floorWarn.classList.toggle('hidden', !onFloor);

    // world
    ensureChunks();
    updateArm(dt);

    // collisions & item animation
    for (const c of chunks) {
      for (const it of c.items) {
        if (it.dead) continue;
        if (it.kind !== 'obstacle' && it.z < sim.z + 8 && it.z > sim.z - 55) {
          it.mesh.position.y = (it.baseY || COUNTER_TOP) + (it.kind === 'food' ? Math.sin(sim.t * 3 + (it.phase || 0)) * 0.04 + 0.04 : 0);
          if (it.kind === 'food') it.mesh.rotation.y += dt * 1.6;
        }
        const zThresh = it.kind === 'obstacle' ? 0.8 : 0.55;
        if (Math.abs(it.z - sim.z) > zThresh) continue;
        if (Math.abs(it.x - sim.x) > (it.kind === 'obstacle' ? 0.7 : 0.6)) continue;
        if (sim.lane === 3) continue;
        if (it.kind === 'obstacle') {
          if (sim.y < COUNTER_TOP + it.height - 0.05) { endRun(it.type); return; }
        } else if (it.kind === 'food') {
          if (sim.y < COUNTER_TOP + 0.7) collectFood(it);
        } else if (it.kind === 'knock') {
          if (sim.y < COUNTER_TOP + 0.55) knockItem(it);
        }
      }
    }

    // going broke ends the run (e.g. lingering on the floor, or a bad spray hit)
    if (sim.score < 0) { endRun('broke'); return; }

    // HUD
    const score = Math.round(sim.score);
    ui.score.textContent = score;
    ui.score.classList.toggle('negative', score < 0);
    ui.meters.textContent = Math.round(meters);
  }

  function updateFlying(dt) {
    flying = flying.filter((f) => {
      f.life -= dt;
      f.vy -= GRAVITY * 0.6 * dt;
      f.mesh.position.x += f.vx * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.position.z += f.vz * dt;
      f.mesh.rotation.x += f.rx * dt;
      f.mesh.rotation.z += f.rz * dt;
      if (f.life <= 0 || f.mesh.position.y < -1) {
        scene.remove(f.mesh);
        return false;
      }
      return true;
    });
  }

  function animateCat(dt) {
    if (!catMesh) return;
    animT += dt;
    const u = catMesh.userData;

    if (sim.dead) {
      sim.deathT += dt;
      catMesh.rotation.z += 9 * dt;
      catMesh.position.y = Math.max(sim.y - sim.deathT * 1.5, -0.6);
      return;
    }

    catMesh.position.set(sim.x, sim.y, sim.z);
    catMesh.rotation.z = 0;

    if (sim.onGround) {
      const run = Math.sin(animT * sim.speed * 1.5);
      u.legs[0].rotation.x = run * 0.75;
      u.legs[1].rotation.x = -run * 0.75;
      u.legs[2].rotation.x = -run * 0.75;
      u.legs[3].rotation.x = run * 0.75;
      u.body.position.y = 0.52 + Math.abs(run) * 0.04;
      u.head.position.y = 0.88 + Math.abs(run) * 0.03;
    } else {
      // stretched jump pose
      u.legs[0].rotation.x = 0.7;
      u.legs[1].rotation.x = 0.7;
      u.legs[2].rotation.x = -0.7;
      u.legs[3].rotation.x = -0.7;
    }
    u.tail.forEach((seg, i) => {
      seg.rotation.z = Math.sin(animT * 4 + i * 1.2) * 0.28;
    });
  }

  function updateCamera(dt) {
    const followY = sim.dead ? camY : (sim.lane < 3 ? COUNTER_TOP : 0) + 2.4 + sim.y * 0.25;
    camY += (followY - camY) * Math.min(1, dt * 4);
    shake = Math.max(0, shake - dt * 1.4);
    const sx = (Math.random() - 0.5) * shake * 0.5;
    const sy = (Math.random() - 0.5) * shake * 0.5;
    camera.position.set(sim.x * 0.55 + sx, camY + sy, sim.z + 6.6);
    camera.lookAt(sim.x * 0.75, camY - 1.55, sim.z - 6);

    sun.position.set(6, 12, sim.z + 6);
    sun.target.position.set(0, 0, sim.z - 8);

    floorMesh.position.z = sim.z - 25;
    floorTex.offset.y = -floorMesh.position.z / 2;
  }

  // ---------- main loop ----------
  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (state === 'playing') updatePlaying(dt);
    if (state !== 'paused') {
      updateFlying(dt);
      animateCat(dt);
      updateCamera(dt);
    }
    renderer.render(scene, camera);
  }

  // initial world so the select screen has a backdrop
  Object.assign(sim, { z: 0, x: 0, y: COUNTER_TOP, lane: 1, nextChunkZ: 30, lastChunkHadGap: false, t: 0, speed: 0, score: 0 });
  ensureChunks();
  loop();
})();
