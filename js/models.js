// 3D asset builders for Countertop King (low-poly, no textures).
window.Models = (function () {
  const matCache = {};

  function mat(color, opts) {
    const key = color + '|' + JSON.stringify(opts || {});
    if (!matCache[key]) {
      matCache[key] = new THREE.MeshLambertMaterial(Object.assign({ color: color }, opts || {}));
    }
    return matCache[key];
  }

  function box(w, h, d, color, opts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
    m.castShadow = true;
    return m;
  }

  function cyl(rTop, rBot, h, color, seg, opts) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg || 10), mat(color, opts));
    m.castShadow = true;
    return m;
  }

  function sph(r, color, opts) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(color, opts));
    m.castShadow = true;
    return m;
  }

  function cone(r, h, color, seg) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 6), mat(color));
    m.castShadow = true;
    return m;
  }

  // ---------------- Cats ----------------
  // palette: { body, chest, muzzle, paws, eye }
  function buildCat(p) {
    const cat = new THREE.Group();

    const body = box(0.55, 0.42, 0.95, p.body);
    body.position.y = 0.52;
    cat.add(body);

    if (p.chest !== p.body) {
      const chest = box(0.42, 0.32, 0.18, p.chest);
      chest.position.set(0, 0.45, -0.42);
      cat.add(chest);
    }

    // head
    const head = new THREE.Group();
    head.position.set(0, 0.88, -0.5);
    const skull = box(0.44, 0.38, 0.38, p.body);
    head.add(skull);
    const muzzle = box(0.22, 0.15, 0.1, p.muzzle);
    muzzle.position.set(0, -0.08, -0.22);
    head.add(muzzle);
    const nose = box(0.07, 0.05, 0.04, 0xe07a8a);
    nose.position.set(0, -0.03, -0.26);
    head.add(nose);
    const eyeMat = new THREE.MeshBasicMaterial({ color: p.eye });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), eyeMat);
      eye.position.set(s * 0.12, 0.05, -0.2);
      head.add(eye);
      const ear = cone(0.09, 0.18, p.body, 4);
      ear.position.set(s * 0.14, 0.26, 0.02);
      head.add(ear);
    }
    cat.add(head);

    // tail — chain of 3 pivoting segments
    const tailSegs = [];
    let parent = cat;
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      if (i === 0) {
        g.position.set(0, 0.66, 0.46);
        g.rotation.x = 0.85; // sweep up-and-back
      } else {
        g.position.set(0, 0.26, 0);
        g.rotation.x = -0.25;
      }
      const geo = new THREE.CylinderGeometry(0.045, 0.06, 0.3, 8);
      geo.translate(0, 0.15, 0);
      const seg = new THREE.Mesh(geo, mat(i === 2 ? p.paws : p.body));
      seg.castShadow = true;
      g.add(seg);
      parent.add(g);
      parent = g;
      tailSegs.push(g);
    }

    // legs — pivot at hip so they swing when running
    const legs = [];
    const hips = [
      [-0.19, -0.34], [0.19, -0.34],  // front (toward -z)
      [-0.19, 0.34], [0.19, 0.34]     // back
    ];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      g.position.set(hips[i][0], 0.5, hips[i][1]);
      const geo = new THREE.BoxGeometry(0.14, 0.44, 0.14);
      geo.translate(0, -0.2, 0);
      const leg = new THREE.Mesh(geo, mat(p.body));
      leg.castShadow = true;
      g.add(leg);
      if (p.paws !== p.body) {
        const pawGeo = new THREE.BoxGeometry(0.15, 0.1, 0.16);
        pawGeo.translate(0, -0.38, -0.01);
        const paw = new THREE.Mesh(pawGeo, mat(p.paws));
        g.add(paw);
      }
      cat.add(g);
      legs.push(g);
    }

    cat.userData = { legs: legs, tail: tailSegs, head: head, body: body };
    cat.traverse(function (o) { o.castShadow = true; });
    return cat;
  }

  const PALETTES = {
    kyle:    { body: 0xe6873c, chest: 0xfff6ea, muzzle: 0xfff6ea, paws: 0xfff6ea, eye: 0x59b551 },
    malcolm: { body: 0x26262b, chest: 0x26262b, muzzle: 0x26262b, paws: 0x26262b, eye: 0xf2c437 }
  };

  // ---------------- Foods ----------------
  function chickenLeg() {
    const g = new THREE.Group();
    const meat = sph(0.13, 0x9c5a2d);
    meat.scale.set(1, 0.85, 1.25);
    meat.position.set(0, 0.12, 0.05);
    g.add(meat);
    const bone = cyl(0.028, 0.028, 0.16, 0xf5efe0);
    bone.rotation.x = Math.PI / 2;
    bone.position.set(0, 0.1, -0.2);
    g.add(bone);
    const knob = sph(0.045, 0xf5efe0);
    knob.position.set(0, 0.1, -0.28);
    g.add(knob);
    return g;
  }

  function steak() {
    const g = new THREE.Group();
    const slab = box(0.34, 0.1, 0.26, 0x9e3030);
    slab.position.y = 0.06;
    g.add(slab);
    const fat = box(0.34, 0.03, 0.06, 0xf3e3d3);
    fat.position.set(0, 0.12, -0.1);
    g.add(fat);
    return g;
  }

  function fish() {
    const g = new THREE.Group();
    const bodyM = sph(0.12, 0x7f9fb5);
    bodyM.scale.set(1, 0.6, 2.0);
    bodyM.position.set(0, 0.1, 0);
    g.add(bodyM);
    const tail = cone(0.09, 0.14, 0x6b8aa0, 4);
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, 0.1, 0.3);
    g.add(tail);
    const eye = sph(0.02, 0x222222);
    eye.position.set(0.08, 0.13, -0.14);
    g.add(eye);
    return g;
  }

  function bacon() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const strip = box(0.4, 0.025, 0.09, i === 1 ? 0xe8c8a8 : 0xb04a3a);
      strip.position.set((i - 1) * 0.03, 0.03 + i * 0.035, (i - 1) * 0.02);
      strip.rotation.y = (i - 1) * 0.2;
      g.add(strip);
    }
    return g;
  }

  function broccoli() {
    const g = new THREE.Group();
    const stem = cyl(0.04, 0.06, 0.14, 0xa8c98a);
    stem.position.y = 0.07;
    g.add(stem);
    const spots = [[0, 0.2, 0, 0.1], [0.08, 0.16, 0.04, 0.07], [-0.08, 0.16, 0.03, 0.07], [0, 0.16, -0.08, 0.07]];
    for (const s of spots) {
      const bud = sph(s[3], 0x3e7d33);
      bud.position.set(s[0], s[1], s[2]);
      g.add(bud);
    }
    return g;
  }

  function apple() {
    const g = new THREE.Group();
    const a = sph(0.13, 0xd0342c);
    a.scale.y = 0.92;
    a.position.y = 0.12;
    g.add(a);
    const stem = cyl(0.012, 0.012, 0.08, 0x6b4a2a);
    stem.position.y = 0.27;
    g.add(stem);
    const leaf = box(0.07, 0.02, 0.04, 0x4a8a3a);
    leaf.position.set(0.05, 0.28, 0);
    g.add(leaf);
    return g;
  }

  function carrot() {
    const g = new THREE.Group();
    const c = cone(0.07, 0.32, 0xe0752e, 8);
    c.rotation.x = -Math.PI / 2; // lying down, point forward
    c.position.set(0, 0.07, 0);
    g.add(c);
    for (let i = 0; i < 3; i++) {
      const top = cone(0.025, 0.12, 0x4a8a3a, 5);
      top.rotation.x = -0.5 + i * 0.5;
      top.position.set((i - 1) * 0.03, 0.12, 0.18);
      g.add(top);
    }
    return g;
  }

  function banana() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.05, 6, 10, Math.PI), mat(0xf0d038));
    b.castShadow = true;
    b.rotation.z = Math.PI; // arch downward -> ends up, like a smile? flip: arch up
    b.position.y = 0.16;
    g.add(b);
    return g;
  }

  const FOODS = [
    { name: 'Chicken Leg', emoji: '🍗', value: 60,  meat: true,  build: chickenLeg },
    { name: 'Steak',       emoji: '🥩', value: 70,  meat: true,  build: steak },
    { name: 'Fish',        emoji: '🐟', value: 65,  meat: true,  build: fish },
    { name: 'Bacon',       emoji: '🥓', value: 50,  meat: true,  build: bacon },
    { name: 'Broccoli',    emoji: '🥦', value: -30, meat: false, build: broccoli },
    { name: 'Apple',       emoji: '🍎', value: -25, meat: false, build: apple },
    { name: 'Carrot',      emoji: '🥕', value: -20, meat: false, build: carrot },
    { name: 'Banana',      emoji: '🍌', value: -25, meat: false, build: banana }
  ];

  // ---------------- Knockables ----------------
  const MUG_COLORS = [0xd04040, 0x4070c0, 0x40a060, 0xe0a030, 0x9060c0];

  function mug() {
    const g = new THREE.Group();
    const body = cyl(0.09, 0.08, 0.17, MUG_COLORS[Math.floor(Math.random() * MUG_COLORS.length)]);
    body.position.y = 0.09;
    g.add(body);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 6, 10, Math.PI), body.material);
    handle.position.set(0.1, 0.09, 0);
    handle.rotation.z = -Math.PI / 2;
    handle.castShadow = true;
    g.add(handle);
    return g;
  }

  function glass() {
    const g = new THREE.Group();
    const c = cyl(0.065, 0.05, 0.22, 0xbfd8e8, 10, { transparent: true, opacity: 0.5 });
    c.position.y = 0.11;
    g.add(c);
    return g;
  }

  function plates() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const p = cyl(0.16, 0.13, 0.025, 0xf2efe8);
      p.position.set((Math.random() - 0.5) * 0.03, 0.02 + i * 0.03, (Math.random() - 0.5) * 0.03);
      g.add(p);
    }
    return g;
  }

  function vase() {
    const g = new THREE.Group();
    const body = cyl(0.055, 0.09, 0.26, 0x3f6fae);
    body.position.y = 0.13;
    g.add(body);
    const rim = cyl(0.07, 0.055, 0.05, 0x3f6fae);
    rim.position.y = 0.28;
    g.add(rim);
    const flower = sph(0.05, 0xe06090);
    flower.position.y = 0.4;
    g.add(flower);
    const stem = cyl(0.012, 0.012, 0.14, 0x4a8a3a);
    stem.position.y = 0.32;
    g.add(stem);
    return g;
  }

  const KNOCKABLES = [
    { name: 'Mug', build: mug },
    { name: 'Glass', build: glass },
    { name: 'Plates', build: plates },
    { name: 'Vase', build: vase }
  ];

  // ---------------- Obstacles ----------------
  function stove() {
    const g = new THREE.Group();
    const base = box(1.05, 0.1, 0.95, 0x2e2e33);
    base.position.y = 0.05;
    g.add(base);
    for (const s of [-1, 1]) {
      const burner = cyl(0.16, 0.16, 0.025, 0x141416);
      burner.position.set(s * 0.24, 0.11, 0.18);
      g.add(burner);
    }
    // pot on the front burner
    const pot = cyl(0.17, 0.15, 0.2, 0x8f8f96);
    pot.position.set(-0.24, 0.21, -0.2);
    g.add(pot);
    const lid = cyl(0.18, 0.18, 0.03, 0x6f6f76);
    lid.position.set(-0.24, 0.32, -0.2);
    g.add(lid);
    const knobTop = sph(0.03, 0x3a3a40);
    knobTop.position.set(-0.24, 0.36, -0.2);
    g.add(knobTop);
    // control knobs
    for (let i = 0; i < 3; i++) {
      const k = cyl(0.03, 0.03, 0.03, 0x55555c);
      k.position.set(-0.3 + i * 0.3, 0.12, 0.42);
      g.add(k);
    }
    return g;
  }

  function sink() {
    const g = new THREE.Group();
    const rim = box(1.05, 0.07, 0.95, 0xb9bec6);
    rim.position.y = 0.035;
    g.add(rim);
    const basin = box(0.8, 0.1, 0.66, 0x40454c);
    basin.position.y = 0.06;
    g.add(basin);
    // faucet
    const pipe = cyl(0.035, 0.04, 0.42, 0xc8cdd4);
    pipe.position.set(0, 0.24, 0.36);
    g.add(pipe);
    const spout = cyl(0.03, 0.03, 0.3, 0xc8cdd4);
    spout.rotation.x = Math.PI / 2;
    spout.position.set(0, 0.44, 0.22);
    g.add(spout);
    const tip = cyl(0.035, 0.035, 0.06, 0xc8cdd4);
    tip.position.set(0, 0.42, 0.08);
    g.add(tip);
    return g;
  }

  const OBSTACLES = [
    { type: 'stove', name: 'stove', build: stove, height: 0.5 },
    { type: 'sink', name: 'sink', build: sink, height: 0.5 }
  ];

  // ---------------- Spray arm ----------------
  // Group origin sits at the HAND; the arm stretches toward -x (the wall).
  function buildSprayArm() {
    const g = new THREE.Group();

    const armGeo = new THREE.BoxGeometry(4.2, 0.18, 0.18);
    armGeo.translate(-2.1, 0, 0);
    const arm = new THREE.Mesh(armGeo, mat(0xdba77f));
    arm.castShadow = true;
    g.add(arm);

    const sleeveGeo = new THREE.BoxGeometry(1.4, 0.26, 0.26);
    sleeveGeo.translate(-3.4, 0, 0);
    const sleeve = new THREE.Mesh(sleeveGeo, mat(0x5577aa));
    sleeve.castShadow = true;
    g.add(sleeve);

    const hand = sph(0.11, 0xdba77f);
    g.add(hand);

    // spray bottle held upright above the hand
    const bottle = cyl(0.08, 0.09, 0.26, 0xd8e8f2, 10, { transparent: true, opacity: 0.75 });
    bottle.position.set(0, 0.16, 0);
    g.add(bottle);
    const water = cyl(0.065, 0.075, 0.14, 0x6fb8e8);
    water.position.set(0, 0.1, 0);
    g.add(water);
    const trigger = box(0.05, 0.1, 0.06, 0xd04040);
    trigger.position.set(0, 0.33, 0);
    g.add(trigger);
    const nozzle = cyl(0.022, 0.022, 0.12, 0xd04040);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0.36, 0.08);
    g.add(nozzle);

    // water stream: extends +z (toward the approaching cat), hidden until spraying
    const streamGeo = new THREE.CylinderGeometry(0.05, 0.16, 5.4, 8);
    streamGeo.translate(0, -2.7, 0);
    const stream = new THREE.Mesh(streamGeo, mat(0x7fc4f0, { transparent: true, opacity: 0.5 }));
    stream.rotation.x = -Math.PI / 2 + 0.1; // slight downward tilt
    stream.position.set(0, 0.36, 0.15);
    stream.visible = false;
    g.add(stream);

    // droplets flying along the stream
    const drops = [];
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xaadcff });
    for (let i = 0; i < 9; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), dropMat);
      d.visible = false;
      g.add(d);
      drops.push(d);
    }

    // warning "!" sprite
    const cv = document.createElement('canvas');
    cv.width = cv.height = 96;
    const c2 = cv.getContext('2d');
    c2.fillStyle = '#e23a2e';
    c2.beginPath();
    c2.arc(48, 48, 44, 0, 7);
    c2.fill();
    c2.fillStyle = '#fff';
    c2.font = 'bold 68px Arial';
    c2.textAlign = 'center';
    c2.textBaseline = 'middle';
    c2.fillText('!', 48, 52);
    const warn = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
    warn.scale.set(0.8, 0.8, 1);
    warn.position.set(0, 1.05, 0);
    g.add(warn);

    return { group: g, stream: stream, drops: drops, warn: warn };
  }

  return {
    mat: mat, box: box, cyl: cyl, sph: sph, cone: cone,
    buildCat: buildCat, PALETTES: PALETTES,
    FOODS: FOODS, KNOCKABLES: KNOCKABLES, OBSTACLES: OBSTACLES,
    buildSprayArm: buildSprayArm
  };
})();
