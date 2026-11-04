import * as THREE from "three";

const TAU = Math.PI * 2;
const OCT_ANGLE = Math.PI / 8;

function makeCanvas(size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function makeMatTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Arena {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.group.name = "arena";
    scene.add(this.group);
    this.octagonRadius = 5.62;
    this.cageHeight = 2.95;
    this.flashes = [];
    this.time = 0;
    this.screenText = { left: "KAI MORENO", right: "MARCUS OKAFOR", round: "FIGHT NIGHT 07" };
    this._build();
  }

  _build() {
    this._materials();
    this._platform();
    this._cage();
    this._outside();
    this._crowd();
    this._jumbotron();
    this._lights();
    this._atmosphere();
    this._referee();
  }

  _materials() {
    this.matBlack = new THREE.MeshStandardMaterial({ color: 0x090a0d, roughness: 0.78, metalness: 0.18 });
    this.matPad = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.92, metalness: 0 });
    this.matSteel = new THREE.MeshStandardMaterial({ color: 0x626975, roughness: 0.32, metalness: 0.92 });
    this.matRedPad = new THREE.MeshStandardMaterial({ color: 0x9c1019, roughness: 0.56, metalness: 0.08, emissive: 0x230003, emissiveIntensity: 0.6 });
    this.matBluePad = new THREE.MeshStandardMaterial({ color: 0x1b3d8f, roughness: 0.56, metalness: 0.08, emissive: 0x020b22, emissiveIntensity: 0.6 });
  }

  _floorTexture() {
    const canvas = makeCanvas(1024);
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(512, 470, 20, 512, 512, 600);
    g.addColorStop(0, "#2a2c31");
    g.addColorStop(0.48, "#202227");
    g.addColorStop(1, "#101115");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);

    // Fine mat texture
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 12000; i++) {
      const c = Math.random() > 0.5 ? 255 : 0;
      ctx.fillStyle = `rgb(${c},${c},${c})`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1, 1);
    }
    ctx.globalAlpha = 1;

    // Octagon geometry lines
    ctx.strokeStyle = "rgba(255,255,255,.055)";
    ctx.lineWidth = 2;
    for (let r = 175; r <= 460; r += 95) {
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = OCT_ANGLE + (i * TAU) / 8;
        const x = 512 + Math.cos(a) * r;
        const y = 512 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Center mark
    ctx.save();
    ctx.translate(512, 512);
    ctx.strokeStyle = "rgba(255,47,56,.5)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 130, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 148, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.065)";
    ctx.font = "italic 900 92px 'Arial Narrow', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("OCTAGON", 0, -15);
    ctx.fillStyle = "rgba(255,47,56,.5)";
    ctx.font = "italic 900 82px 'Arial Narrow', Impact, sans-serif";
    ctx.fillText("RISE", 0, 67);
    ctx.restore();

    // Sponsor blocks around edge
    ctx.save();
    const sponsors = ["FIGHT NIGHT", "OR ATHLETICS", "LAS VEGAS", "RISE UP", "MAIN EVENT", "CHAMPIONSHIP"];
    ctx.textAlign = "center";
    for (let i = 0; i < sponsors.length; i++) {
      const a = OCT_ANGLE + (i * TAU) / 6;
      const x = 512 + Math.cos(a) * 345;
      const y = 512 + Math.sin(a) * 345;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = "rgba(255,255,255,.09)";
      ctx.font = "700 20px 'Arial Narrow', Arial, sans-serif";
      ctx.fillText(sponsors[i], 0, 0);
      ctx.fillStyle = "rgba(255,47,56,.35)";
      ctx.fillRect(-54, 14, 108, 2);
      ctx.restore();
    }
    ctx.restore();

    // Outer octagon line
    ctx.strokeStyle = "rgba(255,255,255,.075)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const a = OCT_ANGLE + (i * TAU) / 8;
      const x = 512 + Math.cos(a) * 490;
      const y = 512 + Math.sin(a) * 490;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    return makeMatTexture(canvas);
  }

  _platform() {
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(5.75, 6.05, 0.62, 8, 1, false),
      this.matBlack,
    );
    platform.rotation.y = OCT_ANGLE;
    platform.position.y = 0.24;
    platform.receiveShadow = true;
    this.group.add(platform);

    const skirtMat = new THREE.MeshStandardMaterial({ color: 0x07080b, roughness: 0.6, metalness: 0.4 });
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.98, 0.36, 8, 1, true), skirtMat);
    skirt.rotation.y = OCT_ANGLE;
    skirt.position.y = 0.06;
    this.group.add(skirt);

    const floorMat = new THREE.MeshStandardMaterial({
      map: this._floorTexture(),
      roughness: 0.9,
      metalness: 0.05,
      color: 0xffffff,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(5.55, 8), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.rotation.z = OCT_ANGLE;
    floor.position.y = 0.56;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Padded apron around the mat
    const verts = [];
    for (let i = 0; i < 8; i++) {
      const a = OCT_ANGLE + (i * TAU) / 8;
      verts.push(new THREE.Vector3(Math.cos(a) * 5.62, 0.58, Math.sin(a) * 5.62));
    }
    for (let i = 0; i < 8; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % 8];
      const len = a.distanceTo(b);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(len + 0.08, 0.14, 0.42), this.matPad);
      pad.position.copy(a).add(b).multiplyScalar(0.5);
      pad.position.y = 0.57;
      pad.rotation.y = Math.atan2(b.z - a.z, b.x - a.x);
      pad.castShadow = true;
      pad.receiveShadow = true;
      this.group.add(pad);

      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(len + 0.08, 0.025, 0.43),
        i % 2 === 0 ? this.matRedPad : this.matBluePad,
      );
      stripe.position.copy(pad.position);
      stripe.position.y = 0.647;
      stripe.rotation.y = pad.rotation.y;
      this.group.add(stripe);
    }

    // LED underglow
    const glowGeo = new THREE.CylinderGeometry(6.12, 6.12, 0.03, 8, 1, true);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff2433, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.y = OCT_ANGLE;
    glow.position.y = 0.03;
    this.group.add(glow);
  }

  _cage() {
    const radius = 5.5;
    const bottom = 0.66;
    const height = 2.16;
    const top = bottom + height;
    const verts = [];
    for (let i = 0; i < 8; i++) {
      const a = OCT_ANGLE + (i * TAU) / 8;
      verts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }

    const chainCanvas = makeCanvas(64);
    const cctx = chainCanvas.getContext("2d");
    cctx.fillStyle = "#000";
    cctx.fillRect(0, 0, 64, 64);
    cctx.strokeStyle = "#fff";
    cctx.lineWidth = 2.2;
    cctx.beginPath();
    cctx.moveTo(-4, 32);
    cctx.lineTo(32, -4);
    cctx.lineTo(68, 32);
    cctx.lineTo(32, 68);
    cctx.closePath();
    cctx.moveTo(32, -4);
    cctx.lineTo(32, 68);
    cctx.moveTo(-4, 32);
    cctx.lineTo(68, 32);
    cctx.stroke();

    for (let i = 0; i < 8; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % 8];
      const len = a.distanceTo(b);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const angle = Math.atan2(b.z - a.z, b.x - a.x);

      const tex = new THREE.CanvasTexture(chainCanvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(Math.max(2, Math.round(len / 0.38)), Math.round(height / 0.38));
      tex.colorSpace = THREE.SRGBColorSpace;
      const meshMat = new THREE.MeshStandardMaterial({
        color: 0x535963,
        map: tex,
        alphaMap: tex,
        transparent: true,
        alphaTest: 0.18,
        side: THREE.DoubleSide,
        metalness: 0.9,
        roughness: 0.42,
        depthWrite: false,
      });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, height), meshMat);
      panel.position.set(mid.x, bottom + height / 2, mid.z);
      panel.rotation.y = -angle;
      panel.renderOrder = 2;
      this.group.add(panel);

      // Top + bottom rails
      for (const y of [bottom, top]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, len, 8), this.matSteel);
        rail.position.set(mid.x, y, mid.z);
        rail.rotation.z = Math.PI / 2;
        rail.rotation.y = -angle;
        this.group.add(rail);
      }

      // Padded top rail
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, len, 8), this.matRedPad);
      pad.position.set(mid.x, top + 0.06, mid.z);
      pad.rotation.z = Math.PI / 2;
      pad.rotation.y = -angle;
      this.group.add(pad);
    }

    // Posts and pads
    for (let i = 0; i < 8; i++) {
      const a = verts[i];
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 2.85, 10), this.matSteel);
      post.position.set(a.x, 1.9, a.z);
      post.castShadow = true;
      this.group.add(post);

      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 1.05, 8), this.matPad);
      pad.position.set(a.x, 1.22, a.z);
      this.group.add(pad);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), this.matRedPad);
      cap.position.set(a.x, 3.32, a.z);
      this.group.add(cap);

      const light = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6),
        new THREE.MeshBasicMaterial({ color: 0xff2c37 }),
      );
      light.position.set(a.x, 2.73, a.z);
      this.group.add(light);
    }

    // Corner sponsor pads (red/blue alternating)
    const padPositions = [
      [-3.9, -3.9],
      [3.9, -3.9],
      [5.1, 0],
      [3.9, 3.9],
      [-3.9, 3.9],
      [-5.1, 0],
    ];
    padPositions.slice(0, 4).forEach(([x, z], i) => {
      const mat = i % 2 === 0 ? this.matRedPad : this.matBluePad;
      const banner = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.58, 0.08), mat);
      banner.position.set(x * 1.02, 1.66, z * 1.02);
      banner.lookAt(0, 1.66, 0);
      this.group.add(banner);
    });
  }

  _outside() {
    // Arena floor / walkway
    const arenaFloor = new THREE.Mesh(
      new THREE.CircleGeometry(24, 64),
      new THREE.MeshStandardMaterial({ color: 0x08090c, roughness: 0.95, metalness: 0.02 }),
    );
    arenaFloor.rotation.x = -Math.PI / 2;
    arenaFloor.position.y = -0.04;
    arenaFloor.receiveShadow = true;
    this.group.add(arenaFloor);

    // Low barrier ring
    const barrier = new THREE.Mesh(
      new THREE.CylinderGeometry(7.25, 7.25, 1.08, 64, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.92, side: THREE.DoubleSide }),
    );
    barrier.position.y = 0.5;
    this.group.add(barrier);

    const ledMat = new THREE.MeshBasicMaterial({ color: 0xff2f38, transparent: true, opacity: 0.75 });
    const led = new THREE.Mesh(new THREE.CylinderGeometry(7.27, 7.27, 0.045, 64, 1, true), ledMat);
    led.position.y = 0.98;
    this.group.add(led);

    // Camera / production platforms
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * (Math.PI / 2);
      const platform = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.85), this.matBlack);
      base.position.y = 0.18;
      platform.add(base);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.04), this.matSteel);
      rail.position.set(0, 0.88, -0.38);
      platform.add(rail);
      platform.position.set(Math.cos(a) * 6.6, 0, Math.sin(a) * 6.6);
      platform.rotation.y = -a;
      this.group.add(platform);
    }

    // LED ribbon above crowd
    const ribbonCanvas = makeCanvas(1024);
    const rctx = ribbonCanvas.getContext("2d");
    rctx.fillStyle = "#08090c";
    rctx.fillRect(0, 0, 1024, 128);
    rctx.fillStyle = "rgba(255,255,255,.86)";
    rctx.font = "800 54px 'Arial Narrow', Arial, sans-serif";
    rctx.textAlign = "center";
    rctx.textBaseline = "middle";
    for (let i = 0; i < 4; i++) {
      rctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,.7)" : "rgba(255,47,56,.8)";
      rctx.fillText("OCTAGON RISE", 128 + i * 256, 66);
    }
    const ribbonTex = new THREE.CanvasTexture(ribbonCanvas);
    ribbonTex.wrapS = THREE.RepeatWrapping;
    ribbonTex.repeat.set(3, 1);
    ribbonTex.colorSpace = THREE.SRGBColorSpace;
    const ribbon = new THREE.Mesh(
      new THREE.CylinderGeometry(13.4, 13.4, 1.2, 64, 1, true),
      new THREE.MeshBasicMaterial({ map: ribbonTex, side: THREE.BackSide, transparent: true, opacity: 0.86 }),
    );
    ribbon.position.y = 4.9;
    this.group.add(ribbon);
  }

  _crowd() {
    const bodyGeo = new THREE.CapsuleGeometry(0.11, 0.28, 3, 6);
    const headGeo = new THREE.SphereGeometry(0.088, 7, 5);
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    const headMat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });

    const rows = 8;
    const perRow = 190;
    const total = rows * perRow;
    const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, total);
    const heads = new THREE.InstancedMesh(headGeo, headMat, total);
    bodies.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    heads.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const shirtColors = [
      0x222a38, 0x3c1f26, 0x1e2a26, 0x332c24, 0x252028, 0x1a2028, 0x3a2e1f,
      0x46252b, 0x223246, 0x2a2a2a, 0x5a2930, 0x21323a, 0x3b3444, 0x4b3a28,
    ];
    const skins = [0xc38a63, 0x8b5a3c, 0x5f3b2a, 0xe0ad84, 0x9a6a4a, 0x764c35];

    let index = 0;
    for (let row = 0; row < rows; row++) {
      const radius = 8.25 + row * 0.74;
      const yBase = 0.86 + row * 0.43;
      for (let i = 0; i < perRow; i++) {
        const angle = (i / perRow) * TAU + row * 0.055 + (Math.random() - 0.5) * 0.018;
        const crowdX = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.18;
        const crowdZ = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.18;
        const scale = 0.82 + Math.random() * 0.35;
        dummy.position.set(crowdX, yBase + Math.random() * 0.1, crowdZ);
        dummy.rotation.y = -angle + Math.PI;
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        bodies.setMatrixAt(index, dummy.matrix);
        color.setHex(shirtColors[(Math.random() * shirtColors.length) | 0]);
        color.multiplyScalar(0.55 + Math.random() * 0.35);
        bodies.setColorAt(index, color);

        dummy.position.y += 0.27 * scale;
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        heads.setMatrixAt(index, dummy.matrix);
        color.setHex(skins[(Math.random() * skins.length) | 0]).multiplyScalar(0.55 + Math.random() * 0.3);
        heads.setColorAt(index, color);
        index++;
      }
    }
    bodies.instanceColor.needsUpdate = true;
    heads.instanceColor.needsUpdate = true;
    this.group.add(bodies, heads);

    // Tiny camera flashes in the crowd
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xf7f4e8, transparent: true, opacity: 0 });
    const flashGeo = new THREE.PlaneGeometry(0.055, 0.055);
    for (let i = 0; i < 34; i++) {
      const flash = new THREE.Mesh(flashGeo, flashMat.clone());
      const angle = Math.random() * TAU;
      const radius = 8.2 + Math.random() * 5.2;
      flash.position.set(Math.cos(angle) * radius, 1 + Math.random() * 2.4, Math.sin(angle) * radius);
      flash.lookAt(0, 2, 0);
      flash.userData = {
        phase: Math.random() * TAU,
        speed: 0.5 + Math.random() * 1.8,
        max: 0.55 + Math.random() * 0.45,
      };
      this.flashes.push(flash);
      this.group.add(flash);
    }

    // Smoke / dust points
    const dustGeo = new THREE.BufferGeometry();
    const count = 240;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const radius = Math.random() * 7.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 0.6 + Math.random() * 6;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0xffe6c2,
        size: 0.022,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.dust = dust;
    this.group.add(dust);
  }

  _jumbotron() {
    const beamMat = this.matSteel;
    for (let i = -1; i <= 1; i += 2) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 5.0, 5), beamMat);
      cable.position.set(i * 2.35, 9.3, -9.6);
      this.group.add(cable);
    }

    const housing = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.85, 0.38), this.matBlack);
    housing.position.set(0, 7.0, -9.6);
    this.group.add(housing);

    const glowFrame = new THREE.Mesh(
      new THREE.BoxGeometry(7.62, 4.05, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x251014, transparent: true, opacity: 0.8 }),
    );
    glowFrame.position.set(0, 7.0, -9.82);
    this.group.add(glowFrame);

    this.screenCanvas = makeCanvas(1024);
    this.screenCanvas.height = 512;
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.screenTexture.anisotropy = 8;
    this.screen = new THREE.Mesh(
      new THREE.PlaneGeometry(7.1, 3.55),
      new THREE.MeshBasicMaterial({ map: this.screenTexture, toneMapped: false }),
    );
    this.screen.position.set(0, 7.0, -9.78);
    this.group.add(this.screen);

    this._drawScreen();

    // Overhead truss
    const trussMat = this.matSteel;
    for (let i = -1; i <= 1; i += 2) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 18, 8), trussMat);
      beam.rotation.z = Math.PI / 2;
      beam.position.set(0, 11.2, i * 4.4);
      this.group.add(beam);
    }
    for (let i = -3; i <= 3; i++) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 8.8, 6), trussMat);
      beam.rotation.x = Math.PI / 2;
      beam.position.set(i * 2.8, 11.2, 0);
      this.group.add(beam);
    }
  }

  _drawScreen() {
    const ctx = this.screenCanvas.getContext("2d");
    const { width, height } = this.screenCanvas;
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#17191f");
    g.addColorStop(0.55, "#0b0c10");
    g.addColorStop(1, "#2b0a0f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(255,47,56,.55)";
    ctx.lineWidth = 5;
    ctx.strokeRect(16, 16, width - 32, height - 32);

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = "800 26px 'Arial Narrow', Arial, sans-serif";
    ctx.letterSpacing = "10px";
    ctx.fillText("OCTAGON RISE", width / 2, 74);
    ctx.fillStyle = "rgba(255,47,56,.85)";
    ctx.fillRect(width / 2 - 90, 91, 180, 3);

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "900 78px 'Arial Narrow', Impact, sans-serif";
    ctx.fillText(this.screenText.left, width / 2 - 214, 205);
    ctx.fillStyle = "rgba(255,47,56,.95)";
    ctx.font = "italic 900 62px 'Arial Narrow', Impact, sans-serif";
    ctx.fillText("VS", width / 2, 203);
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillText(this.screenText.right, width / 2 + 214, 205);

    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.font = "700 21px 'Arial Narrow', Arial, sans-serif";
    ctx.fillText("FIGHT NIGHT 07  ·  LAS VEGAS  ·  MAIN EVENT", width / 2, 283);

    ctx.fillStyle = "#ff2f38";
    ctx.fillRect(width / 2 - 125, 330, 250, 45);
    ctx.fillStyle = "#fff";
    ctx.font = "800 23px 'Arial Narrow', Arial, sans-serif";
    ctx.fillText(this.screenText.round, width / 2, 360);

    // scanlines
    ctx.fillStyle = "rgba(0,0,0,.08)";
    for (let y = 0; y < height; y += 3) ctx.fillRect(0, y, width, 1);
    this.screenTexture.needsUpdate = true;
  }

  setScreen({ left, right, round }) {
    if (left) this.screenText.left = left;
    if (right) this.screenText.right = right;
    if (round) this.screenText.round = round;
    this._drawScreen();
  }

  _lights() {
    const hemi = new THREE.HemisphereLight(0x9aabc4, 0x080604, 0.58);
    this.group.add(hemi);

    const key = new THREE.SpotLight(0xfff0da, 460, 30, 0.55, 0.65, 1.35);
    key.position.set(1.4, 11.8, 5.2);
    key.target.position.set(0, 0.8, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 24;
    key.shadow.bias = -0.00013;
    key.shadow.normalBias = 0.02;
    this.group.add(key, key.target);

    const rimRed = new THREE.SpotLight(0xff2638, 120, 24, 0.48, 0.8, 1.5);
    rimRed.position.set(-8.5, 5.5, -5.0);
    rimRed.target.position.set(0, 1.2, 0);
    this.group.add(rimRed, rimRed.target);

    const rimBlue = new THREE.SpotLight(0x3c7cff, 110, 24, 0.48, 0.8, 1.5);
    rimBlue.position.set(8.5, 5.5, -4.2);
    rimBlue.target.position.set(0, 1.2, 0);
    this.group.add(rimBlue, rimBlue.target);

    const front = new THREE.PointLight(0xffd9b8, 42, 14, 1.8);
    front.position.set(0, 4.6, 7.5);
    this.group.add(front);

    // Camera-side fill so the broadcast angle never reads as pure silhouette.
    const fill = new THREE.PointLight(0xffeedd, 34, 18, 1.6);
    fill.position.set(0, 3.2, -4.5);
    this.fill = fill;
    this.group.add(fill);

    // visible light shafts
    const shaftMat = new THREE.MeshBasicMaterial({
      color: 0xffdfb8,
      transparent: true,
      opacity: 0.017,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (const [x, z] of [
      [1.4, 5.2],
      [-5.7, -3.8],
      [5.7, -3.8],
    ]) {
      const shaft = new THREE.Mesh(new THREE.ConeGeometry(2.7, 11, 24, 1, true), shaftMat);
      shaft.position.set(x, 6.0, z);
      this.group.add(shaft);
    }

    // corner LED columns in the distance
    const red = new THREE.PointLight(0xff2033, 35, 12, 1.6);
    red.position.set(-8, 2, -7);
    this.group.add(red);
    const blue = new THREE.PointLight(0x2a67ff, 35, 12, 1.6);
    blue.position.set(8, 2, -7);
    this.group.add(blue);
  }

  _atmosphere() {
    // haze sprites around the cage
    const canvas = makeCanvas(256);
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,.16)");
    g.addColorStop(0.5, "rgba(255,255,255,.05)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: texture,
      color: 0xffdfc0,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < 9; i++) {
      const sprite = new THREE.Sprite(mat.clone());
      const angle = (i / 9) * TAU;
      sprite.position.set(Math.cos(angle) * (2.5 + Math.random() * 3), 1.2 + Math.random() * 2.4, Math.sin(angle) * (2.5 + Math.random() * 3));
      sprite.scale.setScalar(2.4 + Math.random() * 2.2);
      sprite.userData.phase = Math.random() * TAU;
      this.group.add(sprite);
    }
  }

  _referee() {
    const ref = new THREE.Group();
    ref.name = "referee";
    const skin = new THREE.MeshStandardMaterial({ color: 0x8b5f43, roughness: 0.8 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.9 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x1d2027, roughness: 0.92 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.6 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.38, 4, 8), shirt);
    torso.position.y = 1.12;
    torso.scale.set(1.22, 1, 0.74);
    torso.castShadow = true;
    ref.add(torso);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 8), skin);
    neck.position.y = 1.47;
    ref.add(neck);
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.12, 4, 8), skin);
    head.position.y = 1.65;
    head.scale.set(0.92, 1.12, 0.95);
    head.castShadow = true;
    ref.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135, 8, 5, 0, TAU, 0, Math.PI * 0.48), new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 1 }));
    hair.position.y = 1.71;
    ref.add(hair);

    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.58, 3, 6), pants);
      leg.position.set(side * 0.12, 0.46, 0);
      leg.castShadow = true;
      ref.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.28), shoe);
      foot.position.set(side * 0.12, 0.07, 0.06);
      ref.add(foot);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.38, 3, 6), skin);
      arm.position.set(side * 0.37, 1.03, 0.04);
      arm.rotation.z = side * 0.18;
      arm.castShadow = true;
      ref.add(arm);
    }
    ref.position.set(3.6, 0.56, 1.0);
    ref.rotation.y = 0.05;
    this.referee = ref;
    this.group.add(ref);
  }

  update(dt, elapsed) {
    this.time = elapsed;
    if (this.dust) {
      this.dust.rotation.y += dt * 0.007;
      const positions = this.dust.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i) + Math.sin(elapsed * 0.4 + i) * dt * 0.012;
        positions.setY(i, y > 6.6 ? 0.7 : y);
      }
      positions.needsUpdate = true;
    }
    for (const flash of this.flashes) {
      const { phase, speed, max } = flash.userData;
      const cycle = (Math.sin(elapsed * speed * 1.7 + phase) + 1) * 0.5;
      const val = cycle > 0.94 ? (cycle - 0.94) * (max / 0.06) : 0;
      flash.material.opacity = Math.min(max, val);
      const s = 1 + val * 5;
      flash.scale.setScalar(s);
    }
    if (this.referee) {
      this.referee.rotation.y = 0.05 + Math.sin(elapsed * 0.32) * 0.08;
    }
  }
}
