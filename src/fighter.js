import * as THREE from "three";
import { MOVES } from "./config.js";

const TAU = Math.PI * 2;

function damp(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

function shadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(0,0,0,.55)");
  g.addColorStop(0.55, "rgba(0,0,0,.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function capsule(radius, length, material) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 5, 10), material);
}

export class Fighter {
  constructor(config, side = "left") {
    this.config = config;
    this.side = side;
    this.root = new THREE.Group();
    this.root.name = `fighter-${config.id}-${side}`;
    this.visual = new THREE.Group();
    this.root.add(this.visual);

    this.baseY = 0;
    this.yaw = 0;
    this.action = null;
    this.blocking = false;
    this.downed = false;
    this.downTimer = 0;
    this.ko = false;
    this.hurtTimer = 0;
    this.celebrating = false;
    this.invulnerable = 0;
    this.walkPhase = Math.random() * TAU;
    this.locomotion = 0;
    this.alternateArm = side === "left" ? "l" : "r";
    this.pose = {};
    this.poseReady = false;
    this._build();
    this._initPose();
  }

  _initPose() {
    this.pose = {
      torsoX: 0.08,
      torsoY: 0,
      torsoZ: 0,
      headX: -0.03,
      headY: 0,
      headZ: 0,
      lArmX: -0.56,
      lArmY: 0.16,
      lArmZ: 0.2,
      lElbowX: -1.72,
      lElbowY: 0,
      lElbowZ: 0,
      rArmX: -0.56,
      rArmY: -0.16,
      rArmZ: -0.2,
      rElbowX: -1.72,
      rElbowY: 0,
      rElbowZ: 0,
      lHipX: -0.2,
      lHipY: -0.05,
      lHipZ: 0.045,
      lKneeX: 0.28,
      rHipX: 0.16,
      rHipY: 0.06,
      rHipZ: -0.045,
      rKneeX: 0.3,
      visualY: 0,
    };
    this.poseReady = true;
  }

  _build() {
    const c = this.config;
    const scale = c.id === "okafor" ? 1.075 : c.id === "tanaka" ? 0.958 : 1;
    this.visual.scale.setScalar(scale);

    const skin = new THREE.MeshStandardMaterial({ color: c.skin, roughness: 0.74, metalness: 0 });
    const skinShade = new THREE.MeshStandardMaterial({ color: c.skinShade, roughness: 0.78, metalness: 0 });
    const trunks = new THREE.MeshStandardMaterial({ color: c.trunks, roughness: 0.58, metalness: 0.08 });
    const trim = new THREE.MeshStandardMaterial({ color: c.trim, roughness: 0.74, metalness: 0.02 });
    const glove = new THREE.MeshStandardMaterial({ color: c.trunks, roughness: 0.56, metalness: 0.06 });
    const gloveTrim = new THREE.MeshStandardMaterial({ color: c.trim, roughness: 0.78, metalness: 0 });
    const hair = new THREE.MeshStandardMaterial({ color: c.hair, roughness: 0.92, metalness: 0 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0b0a0a, roughness: 0.5, metalness: 0.1 });
    const tape = new THREE.MeshStandardMaterial({ color: 0xe8e1d2, roughness: 0.94, metalness: 0 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0xd54040, roughness: 0.6 });
    this.materials = { skin, skinShade, trunks, trim, glove, gloveTrim, hair, dark, tape, mouthMat };

    const add = (mesh, cast = true) => {
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      this.visual.add(mesh);
      return mesh;
    };

    // Contact shadow
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      new THREE.MeshBasicMaterial({
        map: shadowTexture(),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.012;
    this.root.add(this.shadow);

    // Pelvis / trunks
    this.hips = new THREE.Group();
    this.hips.position.y = 0.98;
    this.visual.add(this.hips);

    const trunksMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.255, 0.34, 12, 1, false), trunks);
    trunksMesh.scale.z = 0.8;
    trunksMesh.position.y = 0.05;
    trunksMesh.castShadow = true;
    trunksMesh.receiveShadow = true;
    this.hips.add(trunksMesh);

    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.247, 0.247, 0.05, 12, 1, false), trim);
    waist.scale.z = 0.8;
    waist.position.y = 0.22;
    this.hips.add(waist);

    const shortsHem = new THREE.Mesh(new THREE.CylinderGeometry(0.257, 0.257, 0.026, 12, 1, false), trim);
    shortsHem.scale.z = 0.8;
    shortsHem.position.y = -0.122;
    this.hips.add(shortsHem);

    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.31, 0.024), trim);
      stripe.position.set(side * 0.205, 0.02, 0.118);
      stripe.rotation.y = side * 0.2;
      this.hips.add(stripe);
    }

    // Torso pivot
    this.torso = new THREE.Group();
    this.torso.position.y = 1.12;
    this.visual.add(this.torso);

    const profile = [
      new THREE.Vector2(0.15, -0.2),
      new THREE.Vector2(0.18, -0.1),
      new THREE.Vector2(0.205, 0.04),
      new THREE.Vector2(0.235, 0.18),
      new THREE.Vector2(0.275, 0.3),
      new THREE.Vector2(0.3, 0.4),
      new THREE.Vector2(0.28, 0.48),
      new THREE.Vector2(0.21, 0.55),
      new THREE.Vector2(0.135, 0.59),
    ];
    const torsoMesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 16), skin);
    torsoMesh.scale.z = 0.68;
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.torso.add(torsoMesh);

    // Pecs and deltoids
    for (const side of [-1, 1]) {
      const pec = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), skin);
      pec.position.set(side * 0.115, 0.37, 0.135);
      pec.scale.set(1.08, 0.72, 0.32);
      this.torso.add(pec);

      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), skin);
      shoulder.position.set(side * 0.325, 0.43, -0.005);
      shoulder.scale.set(1.08, 0.95, 1.04);
      shoulder.castShadow = true;
      this.torso.add(shoulder);
    }

    const sternum = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.14, 0.012), skinShade);
    sternum.position.set(0, 0.35, 0.2);
    this.torso.add(sternum);

    // Tattoo strokes for Moreno
    if (c.tattoos) {
      const tatMat = new THREE.MeshBasicMaterial({ color: 0x2a1712, transparent: true, opacity: 0.52, depthWrite: false });
      for (let i = 0; i < 3; i++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.185 + i * 0.015, 0.008, 4, 18, Math.PI * 0.9), tatMat);
        band.position.set(-0.12, 0.35 + i * 0.035, 0.21);
        band.rotation.z = 0.4;
        band.rotation.x = 0.14;
        band.scale.set(1, 0.55, 1);
        this.torso.add(band);
      }
      const slash = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.22, 0.005), tatMat);
      slash.position.set(0.235, 0.34, 0.19);
      slash.rotation.z = -0.42;
      this.torso.add(slash);
    }

    // Neck + head
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.102, 0.15, 9), skin);
    neck.position.y = 0.645;
    this.torso.add(neck);

    this.head = new THREE.Group();
    this.head.position.y = 0.815;
    this.head.scale.setScalar(1.06);
    this.torso.add(this.head);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), skin);
    skull.scale.set(0.88, 1.12, 0.92);
    skull.position.y = 0.025;
    skull.castShadow = true;
    this.head.add(skull);

    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), skin);
    jaw.scale.set(0.92, 0.72, 0.95);
    jaw.position.set(0, -0.065, 0.035);
    jaw.castShadow = true;
    this.head.add(jaw);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 7, 5), skinShade);
      ear.position.set(side * 0.145, 0.015, 0);
      ear.scale.set(0.65, 1, 0.65);
      this.head.add(ear);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 7, 6), dark);
      eye.position.set(side * 0.058, 0.045, 0.143);
      this.head.add(eye);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.011, 0.012), hair);
      brow.position.set(side * 0.06, 0.078, 0.15);
      brow.rotation.z = side * 0.12;
      this.head.add(brow);
    }

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.085, 6), skin);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.005, 0.165);
    nose.scale.set(1, 1, 0.8);
    this.head.add(nose);

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.014, 0.012), mouthMat);
    mouth.position.set(0, -0.058, 0.148);
    this.head.add(mouth);

    // Hair styles
    if (c.hairStyle === "fade") {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.164, 12, 8, 0, TAU, 0, Math.PI * 0.52), hair);
      cap.position.y = 0.045;
      cap.scale.set(0.93, 1.05, 0.98);
      this.head.add(cap);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.1), hair);
      top.position.set(0, 0.175, -0.015);
      top.rotation.x = -0.12;
      this.head.add(top);
      for (const side of [-1, 1]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.01), dark);
        line.position.set(side * 0.14, 0.07, 0.02);
        this.head.add(line);
      }
    } else if (c.hairStyle === "undercut") {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.166, 12, 8, 0, TAU, 0, Math.PI * 0.42), hair);
      cap.position.y = 0.062;
      cap.scale.set(0.95, 1.18, 1);
      this.head.add(cap);
      const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 0.06), hair);
      fringe.position.set(0, 0.15, 0.1);
      fringe.rotation.x = 0.18;
      this.head.add(fringe);
    } else {
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: 0xd8b08d, transparent: true, opacity: 0.18 }));
      shine.position.set(-0.04, 0.165, 0.02);
      this.head.add(shine);
    }

    if (c.id === "okafor") {
      const beard = new THREE.Mesh(new THREE.SphereGeometry(0.122, 10, 8), new THREE.MeshStandardMaterial({ color: 0x0b0908, roughness: 1, transparent: true, opacity: 0.92 }));
      beard.scale.set(0.96, 0.65, 0.95);
      beard.position.set(0, -0.085, 0.045);
      this.head.add(beard);
    }

    // Arms
    this.armL = this._buildArm(-1, skin, glove, gloveTrim, tape);
    this.armR = this._buildArm(1, skin, glove, gloveTrim, tape);
    this.armL.position.set(-0.345, 0.43, 0);
    this.armR.position.set(0.345, 0.43, 0);
    this.torso.add(this.armL, this.armR);

    // Legs
    this.legL = this._buildLeg(-1, skin, trunks, trim, tape);
    this.legR = this._buildLeg(1, skin, trunks, trim, tape);
    this.legL.hip.position.set(-0.15, 0.98, 0);
    this.legR.hip.position.set(0.15, 0.98, 0);
    this.visual.add(this.legL.hip, this.legR.hip);

    // Small corner marker on the back
    const tag = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.05, 0.012),
      new THREE.MeshBasicMaterial({ color: c.accent }),
    );
    tag.position.set(0, 0.27, -0.18);
    tag.rotation.x = -0.08;
    this.torso.add(tag);

    this.visual.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = node.castShadow || node !== this.shadow;
        node.receiveShadow = true;
      }
    });
  }

  _buildArm(side, skin, glove, gloveTrim, tape) {
    const shoulder = new THREE.Group();
    const upper = capsule(0.075, 0.2, skin);
    upper.position.y = -0.175;
    upper.scale.set(1.02, 1, 1.02);
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.34;
    shoulder.add(elbow);

    const forearm = capsule(0.058, 0.18, skin);
    forearm.position.y = -0.145;
    forearm.castShadow = true;
    elbow.add(forearm);

    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.067, 0.071, 0.07, 8), gloveTrim);
    wrist.position.y = -0.285;
    elbow.add(wrist);

    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.077, 12, 9), glove);
    fist.scale.set(0.95, 0.88, 1.12);
    fist.position.set(0, -0.33, 0.012);
    fist.castShadow = true;
    elbow.add(fist);

    // knuckle plate is painted onto the glove rather than intersecting it
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.04, 3, 6), glove);
    thumb.position.set(side * -0.065, -0.332, 0.04);
    thumb.rotation.z = side * 0.55;
    elbow.add(thumb);

    // sponsor stripe on the forearm
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.026, 8), tape);
    band.position.y = -0.235;
    elbow.add(band);

    return shoulder;
  }

  _buildLeg(side, skin, trunks, trim, tape) {
    const hip = new THREE.Group();

    const thigh = capsule(0.115, 0.22, skin);
    thigh.position.y = -0.23;
    thigh.scale.set(1.04, 1, 1.04);
    thigh.castShadow = true;
    hip.add(thigh);

    // trunks leg
    // (shorts body is built once on the hips; legs stay clean to avoid seams)

    const knee = new THREE.Group();
    knee.position.y = -0.47;
    hip.add(knee);

    const kneecap = new THREE.Mesh(new THREE.SphereGeometry(0.082, 8, 6), skin);
    kneecap.scale.set(1, 0.85, 1);
    knee.add(kneecap);

    const calf = capsule(0.084, 0.19, skin);
    calf.position.y = -0.19;
    calf.castShadow = true;
    knee.add(calf);

    const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.083, 0.08, 8), tape);
    ankle.position.y = -0.34;
    knee.add(ankle);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.26), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.6, metalness: 0.25 }));
    foot.position.set(0, -0.41, 0.055);
    foot.castShadow = true;
    knee.add(foot);

    return { hip, knee };
  }

  playMove(key) {
    const move = MOVES[key];
    if (!move || this.action || this.blocking || this.downed || this.ko) return false;
    this.action = {
      key,
      move,
      t: 0,
      arm: key === "jab" || key === "heavy" ? this.alternateArm : "l",
      hitConsumed: false,
    };
    if (key === "jab") this.alternateArm = this.alternateArm === "l" ? "r" : "l";
    if (key === "heavy") this.alternateArm = this.alternateArm === "l" ? "r" : "l";
    return true;
  }

  cancelAction() {
    this.action = null;
  }

  setBlocking(value) {
    if (this.ko || this.downed) this.blocking = false;
    else this.blocking = value;
  }

  isAttacking() {
    return !!this.action;
  }

  isInWindup() {
    return !!this.action && this.action.t < this.action.move.windup;
  }

  hitLanded() {
    if (!this.action || this.action.hitConsumed) return false;
    if (this.action.t < this.action.move.hitAt) return false;
    this.action.hitConsumed = true;
    return true;
  }

  takeHit(heavy = false) {
    this.hurtTimer = heavy ? 0.5 : 0.32;
    this.blocking = false;
    if (this.action) this.cancelAction();
    if (this.downed) return;
  }

  knockDown(duration = 2.0) {
    this.cancelAction();
    this.blocking = false;
    this.downed = true;
    this.downTimer = duration;
    this.hurtTimer = 0;
  }

  setKO() {
    this.cancelAction();
    this.blocking = false;
    this.ko = true;
    this.downed = true;
    this.downTimer = 0;
    this.hurtTimer = 0;
  }

  setVictory(value) {
    this.celebrating = value;
    if (value) {
      this.action = null;
      this.blocking = false;
    }
  }

  reset() {
    this.action = null;
    this.blocking = false;
    this.downed = false;
    this.downTimer = 0;
    this.ko = false;
    this.hurtTimer = 0;
    this.celebrating = false;
    this.invulnerable = 0;
    this.locomotion = 0;
    this.visual.rotation.x = 0;
    this.visual.position.set(0, 0, 0);
    this._initPose();
  }

  setBaseY(y) {
    this.baseY = y;
    this.root.position.y = y;
  }

  setFacing(dx, dz, dt = 0.2) {
    const target = Math.atan2(dx, dz);
    let diff = ((target - this.yaw + Math.PI * 3) % TAU) - Math.PI;
    this.yaw += diff * (1 - Math.exp(-12 * dt));
    this.root.rotation.y = this.yaw;
  }

  update(dt, time, locomotion = 0) {
    this.locomotion = locomotion;
    if (this.invulnerable > 0) this.invulnerable -= dt;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;

    if (this.downed && !this.ko) {
      this.downTimer -= dt;
      if (this.downTimer <= 0) {
        this.downed = false;
        this.invulnerable = 0.5;
      }
    }

    if (this.action) {
      this.action.t += dt;
      if (this.action.t >= this.action.move.duration) this.action = null;
    }

    const walking = Math.min(1, locomotion);
    this.walkPhase += dt * (2.3 + walking * 6.2);
    const bob = Math.sin(this.walkPhase * 2) * 0.008 * walking + Math.sin(time * 2.2 + (this.side === "left" ? 0 : 1.2)) * 0.008;

    const target = this._targetPose(time, walking);
    let rate = 11;
    if (this.action) rate = this.action.t < this.action.move.hitAt ? 24 : 16;
    if (this.downed || this.ko) rate = 7;
    this._blendPose(target, rate, dt);
    this._applyPose(bob, dt);

    // Falling / getting up is on the visual wrapper, so gameplay positions stay stable.
    const fallTarget = this.ko ? -Math.PI / 2.02 : this.downed ? -Math.PI / 2.15 : 0;
    this.visual.rotation.x = damp(this.visual.rotation.x, fallTarget, this.ko ? 4.2 : this.downed ? 7.2 : 8.5, dt);
    const fallY = this.ko || this.downed ? 0.1 : 0;
    this.visual.position.y = damp(this.visual.position.y, fallY + this.pose.visualY + bob, 8, dt);
    this.visual.position.z = damp(this.visual.position.z, this.ko || this.downed ? -0.18 : 0, 7, dt);
    this.shadow.material.opacity = this.ko || this.downed ? 0.55 : 0.85;
  }

  _targetPose(time, walking) {
    const t = {
      torsoX: 0.08 + Math.sin(time * 2.2) * 0.012,
      torsoY: 0,
      torsoZ: 0,
      headX: -0.03,
      headY: Math.sin(time * 1.5) * 0.02,
      headZ: 0,
      lArmX: -0.56,
      lArmY: 0.16,
      lArmZ: 0.2,
      lElbowX: -1.72,
      lElbowY: 0,
      lElbowZ: 0,
      rArmX: -0.56,
      rArmY: -0.16,
      rArmZ: -0.2,
      rElbowX: -1.72,
      rElbowY: 0,
      rElbowZ: 0,
      lHipX: -0.2,
      lHipY: -0.05,
      lHipZ: 0.045,
      lKneeX: 0.28,
      rHipX: 0.16,
      rHipY: 0.06,
      rHipZ: -0.045,
      rKneeX: 0.3,
      visualY: 0,
    };

    // head bob / breathing
    t.headY += Math.sin(time * 2.6) * 0.032;

    const shuffle = Math.sin(this.walkPhase) * 0.055 * walking;
    t.lHipX += shuffle;
    t.rHipX -= shuffle;
    t.lKneeX += Math.abs(shuffle) * 0.5;
    t.rKneeX += Math.abs(shuffle) * 0.5;
    t.torsoY += Math.sin(this.walkPhase) * 0.04 * walking;

    if (this.celebrating) {
      return {
        ...t,
        torsoX: -0.06,
        torsoY: Math.sin(time * 2.4) * 0.12,
        headX: -0.14,
        lArmX: -2.76,
        lArmY: -0.05,
        lArmZ: 0.5,
        lElbowX: -0.08,
        rArmX: -2.76,
        rArmY: 0.05,
        rArmZ: -0.5,
        rElbowX: -0.08,
        lHipX: -0.13,
        rHipX: 0.13,
        visualY: Math.abs(Math.sin(time * 4.2)) * 0.035,
      };
    }

    if (this.ko) {
      return {
        ...t,
        torsoX: -0.05,
        headX: -0.2,
        headY: 0.3,
        lArmX: -0.25,
        lArmZ: 0.55,
        lElbowX: -0.4,
        rArmX: -0.25,
        rArmZ: -0.55,
        rElbowX: -0.4,
        lHipX: -0.05,
        rHipX: 0.08,
        lKneeX: 0.35,
        rKneeX: 0.2,
      };
    }

    if (this.downed) {
      return {
        ...t,
        torsoX: 0.05,
        headX: 0.18,
        lArmX: -0.3,
        lArmZ: 0.4,
        lElbowX: -0.6,
        rArmX: -0.35,
        rArmZ: -0.45,
        rElbowX: -0.55,
        lHipX: -0.15,
        rHipX: 0.2,
        lKneeX: 0.3,
        rKneeX: 0.3,
      };
    }

    if (this.hurtTimer > 0) {
      const hurt = Math.min(1, this.hurtTimer * 3.5);
      return {
        ...t,
        torsoX: t.torsoX - 0.18 * hurt,
        torsoY: 0.15 * hurt,
        headX: -0.32 * hurt,
        headY: 0.18 * hurt,
        lArmX: -0.3,
        lArmZ: 0.4,
        lElbowX: -1.1,
        rArmX: -0.36,
        rArmZ: -0.48,
        rElbowX: -1.0,
        lHipX: -0.32,
        rHipX: 0.28,
      };
    }

    if (this.blocking) {
      return {
        ...t,
        torsoX: 0.17,
        headX: 0.13,
        lArmX: -1.48,
        lArmY: 0.2,
        lArmZ: 0.45,
        lElbowX: -2.05,
        lElbowZ: 0.12,
        rArmX: -1.48,
        rArmY: -0.2,
        rArmZ: -0.45,
        rElbowX: -2.05,
        rElbowZ: -0.12,
        lHipX: -0.3,
        rHipX: 0.24,
        lKneeX: 0.45,
        rKneeX: 0.42,
      };
    }

    if (this.action) {
      const { key, t: at, arm, move } = this.action;
      const p = Math.min(1, at / move.duration);
      const wind = Math.min(1, at / Math.max(0.01, move.hitAt));
      const retract = Math.max(0, (at - move.hitAt) / Math.max(0.01, move.duration - move.hitAt));
      const extension = at < move.hitAt ? Math.sin(wind * Math.PI * 0.5) * 0.3 : Math.cos(retract * Math.PI * 0.5);
      const twist = (arm === "l" ? 1 : -1) * extension * 0.2;

      if (key === "jab") {
        const shoulder = arm === "l" ? "l" : "r";
        const other = shoulder === "l" ? "r" : "l";
        t.torsoY = twist;
        t.headY = -twist * 0.35;
        t[`${shoulder}ArmX`] = -0.56 - extension * 1.08;
        t[`${shoulder}ArmZ`] = (shoulder === "l" ? 0.2 : -0.2) - extension * (shoulder === "l" ? 0.14 : -0.14);
        t[`${shoulder}ElbowX`] = -1.72 + extension * 1.62;
        t[`${other}ArmX`] = -0.58;
        t.lHipX = -0.24;
        t.rHipX = 0.18;
      } else if (key === "heavy") {
        const shoulder = arm === "l" ? "l" : "r";
        const other = shoulder === "l" ? "r" : "l";
        t.torsoY = twist * 1.3;
        t.torsoX = 0.12 + extension * 0.12;
        t.headY = -twist;
        t[`${shoulder}ArmX`] = -0.56 - extension * 0.86;
        t[`${shoulder}ArmY`] = (shoulder === "l" ? 0.16 : -0.16) * (1 - extension);
        t[`${shoulder}ArmZ`] = (shoulder === "l" ? 0.2 : -0.2) + extension * (shoulder === "l" ? 0.18 : -0.18);
        t[`${shoulder}ElbowX`] = -1.72 + extension * 1.38;
        t[`${other}ArmX`] = -0.48;
        t[`${other}ElbowX`] = -1.9;
        t.lHipX = -0.32;
        t.rHipX = 0.26;
        t.lKneeX = 0.38;
      } else if (key === "kick") {
        const extensionKick = at < move.hitAt ? Math.sin(wind * Math.PI * 0.5) : Math.cos(retract * Math.PI * 0.42);
        t.torsoX = -0.2 - extensionKick * 0.16;
        t.torsoY = -0.2 * extensionKick;
        t.headX = -0.1;
        t.lHipX = -0.2 - extensionKick * 1.28;
        t.lHipZ = 0.045 + extensionKick * 0.12;
        t.lKneeX = 0.28 - extensionKick * 0.25;
        t.rHipX = 0.16;
        t.rKneeX = 0.5 + extensionKick * 0.2;
        t.lArmX = -0.95;
        t.lArmZ = 0.46;
        t.lElbowX = -1.4;
        t.rArmX = -0.12;
        t.rArmZ = -0.72;
        t.rElbowX = -1.1;
        t.visualY = extensionKick * 0.025;
      } else if (key === "takedown") {
        const drive = Math.sin(Math.min(1, p / 0.55) * Math.PI * 0.5);
        t.torsoX = 0.08 + drive * 0.58;
        t.headX = drive * 0.16;
        t.lHipX = -0.2 - drive * 0.35;
        t.rHipX = 0.16 - drive * 0.18;
        t.lKneeX = 0.28 + drive * 0.5;
        t.rKneeX = 0.3 + drive * 0.42;
        t.lArmX = -0.56 - drive * 0.84;
        t.rArmX = -0.56 - drive * 0.84;
        t.lArmZ = 0.2 - drive * 0.12;
        t.rArmZ = -0.2 + drive * 0.12;
        t.lElbowX = -1.72 + drive * 1.32;
        t.rElbowX = -1.72 + drive * 1.32;
        t.visualY = -drive * 0.05;
      }
      return t;
    }

    return t;
  }

  _blendPose(target, rate, dt) {
    for (const key of Object.keys(target)) {
      this.pose[key] = damp(this.pose[key], target[key], rate, dt);
    }
  }

  _applyPose(bob, dt) {
    const p = this.pose;
    this.torso.rotation.set(p.torsoX, p.torsoY, p.torsoZ);
    this.head.rotation.set(p.headX, p.headY, p.headZ);

    this.armL.rotation.set(p.lArmX, p.lArmY, p.lArmZ);
    this.armR.rotation.set(p.rArmX, p.rArmY, p.rArmZ);

    // Elbows are children of shoulders.
    this.armL.children[1].rotation.set(p.lElbowX, p.lElbowY, p.lElbowZ);
    this.armR.children[1].rotation.set(p.rElbowX, p.rElbowY, p.rElbowZ);

    this.legL.hip.rotation.set(p.lHipX, p.lHipY, p.lHipZ);
    this.legR.hip.rotation.set(p.rHipX, p.rHipY, p.rHipZ);
    this.legL.knee.rotation.x = p.lKneeX;
    this.legR.knee.rotation.x = p.rKneeX;

    if (!this.ko && !this.downed) this.visual.position.y = Math.max(0, this.visual.position.y);
  }
}
