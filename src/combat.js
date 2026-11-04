import * as THREE from "three";
import { AI_PROFILES, MAX_ROUNDS, MOVES, RING_RADIUS, ROUND_SECONDS } from "./config.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const random = (a, b) => a + Math.random() * (b - a);
const forwardFromYaw = (yaw) => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

/**
 * Owns all moment-to-moment fight simulation: movement, strikes, stamina,
 * AI decisions, damage, scoring and round data.
 */
export class Combat {
  constructor(game) {
    this.g = game;
    this.match = null;
    this.aiCooldown = 0;
    this.aiBlockTimer = 0;
    this.aiStrafe = Math.random() > 0.5 ? 1 : -1;
    this.aiStrafeTimer = 1.2;
    this.aiReactedAction = null;
    this.knockback = [new THREE.Vector3(), new THREE.Vector3()];
    this.lastPlayerMove = null;
    this.aiTauntTimer = 4;
  }

  begin(p1, p2, rivalProfile) {
    this.p1 = p1;
    this.p2 = p2;
    this.profile = AI_PROFILES[rivalProfile] || AI_PROFILES.okafor;
    this.match = {
      health: [100, 100],
      stamina: [100, 100],
      round: 1,
      roundTime: ROUND_SECONDS,
      roundWins: [0, 0],
      combo: [0, 0],
      comboTimer: [0, 0],
      roundDamage: [0, 0],
      stats: [
        { strikes: 0, landed: 0, damage: 0, takedowns: 0, knockdowns: 0, blocks: 0 },
        { strikes: 0, landed: 0, damage: 0, takedowns: 0, knockdowns: 0, blocks: 0 },
      ],
      lastRoundWin: null,
    };
    this.aiCooldown = 0.9;
    this.aiBlockTimer = 0;
    this.aiReactedAction = null;
    this.knockback[0].set(0, 0, 0);
    this.knockback[1].set(0, 0, 0);
    this.resetRoundState(1, true);
  }

  resetRoundState(round, full = false) {
    const m = this.match;
    if (!m) return;
    m.round = round;
    m.roundTime = ROUND_SECONDS;
    m.combo = [0, 0];
    m.comboTimer = [0, 0];
    m.roundDamage = [0, 0];
    m.stamina = [100, 100];
    if (full) {
      m.health = [100, 100];
      m.roundWins = [0, 0];
      m.stats = [
        { strikes: 0, landed: 0, damage: 0, takedowns: 0, knockdowns: 0, blocks: 0 },
        { strikes: 0, landed: 0, damage: 0, takedowns: 0, knockdowns: 0, blocks: 0 },
      ];
    } else {
      m.health = [Math.min(100, m.health[0] + 9), Math.min(100, m.health[1] + 9)];
    }
    this.aiCooldown = 0.85;
    this.aiBlockTimer = 0;
    this.aiReactedAction = null;
    this.knockback[0].set(0, 0, 0);
    this.knockback[1].set(0, 0, 0);
  }

  update(dt) {
    const g = this.g;
    const m = this.match;
    if (!m || g.state !== "fight") return;

    m.roundTime -= dt;
    if (m.roundTime <= 0) {
      m.roundTime = 0;
      g.onRoundTimeExpired();
      return;
    }

    for (let i = 0; i < 2; i++) {
      if (m.comboTimer[i] > 0) m.comboTimer[i] -= dt;
      else m.combo[i] = 0;
    }

    const p1 = this.p1;
    const p2 = this.p2;

    // Player block state
    if (!p1.downed && !p1.ko) {
      p1.setBlocking(g.blockHeld && m.stamina[0] > 0 && !p1.action);
    }

    // Player locomotion
    const input = g.getMoveInput();
    const dir = this._fightDirection();
    const right = new THREE.Vector3(dir.z, 0, -dir.x);
    const playerMove = new THREE.Vector3()
      .addScaledVector(dir, input.forward)
      .addScaledVector(right, input.strafe);
    if (playerMove.lengthSq() > 1) playerMove.normalize();
    const playerSpeed = p1.config.speed * 2.55 * (p1.blocking ? 0.42 : 1) * (p1.action ? 0.26 : 1);
    this._moveFighter(p1, playerMove, playerSpeed, dt, 0);

    // AI brain
    this._updateAI(dt);

    // Physics / bodies
    this._separateBodies(dt);
    this._applyKnockback(dt);

    // Face each other
    const dx = p2.root.position.x - p1.root.position.x;
    const dz = p2.root.position.z - p1.root.position.z;
    p1.setFacing(dx, dz, dt);
    p2.setFacing(-dx, -dz, dt);

    // Animate rigs
    const p1Speed = playerMove.length() * playerSpeed;
    const p2Speed = this.aiMove ? this.aiMove.length() * (this.lastAiSpeed || 0) : 0;
    p1.update(dt, g.time, Math.min(1, p1Speed / 3.5));
    p2.update(dt, g.time, Math.min(1, p2Speed / 3.5));

    // Resolve strikes right after animation time advances.
    this._resolvePending(p1, p2, 0);
    this._resolvePending(p2, p1, 1);

    // Stamina economy
    for (let i = 0; i < 2; i++) {
      const f = i === 0 ? p1 : p2;
      let regen = f.blocking ? 2.2 : f.downed ? 6 : f.action ? 0.7 : 7.4;
      if (m.stamina[i] < 16 && !f.action) regen *= 0.45;
      m.stamina[i] = clamp(m.stamina[i] + regen * dt, 0, 100);
    }

    // Contextual coaching line
    const distance = Math.hypot(dx, dz);
    if (!g.ui.statusUntil) {
      if (p1.downed) g.ui.setStatus("GET BACK TO YOUR FEET");
      else if (m.health[0] < 24) g.ui.setStatus("DIG DEEP · SURVIVE THE ROUND");
      else if (m.health[1] < 24) g.ui.setStatus("HE'S HURT · FINISH HIM");
      else if (m.stamina[0] < 16) g.ui.setStatus("LOW STAMINA · CREATE SPACE");
      else if (distance > 2.5) g.ui.setStatus("CLOSE THE DISTANCE");
      else if (p2.blocking) g.ui.setStatus("THE GUARD IS UP · GO LOW");
      else g.ui.setStatus("READ THE OPENING");
    }
  }

  _fightDirection() {
    const d = new THREE.Vector3(
      this.p2.root.position.x - this.p1.root.position.x,
      0,
      this.p2.root.position.z - this.p1.root.position.z,
    );
    if (d.lengthSq() < 0.0001) d.set(1, 0, 0);
    return d.normalize();
  }

  _moveFighter(fighter, moveVector, speed, dt, index) {
    if (fighter.downed || fighter.ko) return;
    const deadzone = 0.08;
    if (moveVector.lengthSq() < deadzone * deadzone) return;
    fighter.root.position.addScaledVector(moveVector, speed * dt);
    this._clampToRing(fighter);
  }

  _clampToRing(fighter) {
    const pos = fighter.root.position;
    const length = Math.hypot(pos.x, pos.z);
    const limit = RING_RADIUS - 0.28;
    if (length > limit) {
      pos.x = (pos.x / length) * limit;
      pos.z = (pos.z / length) * limit;
    }
  }

  _separateBodies(dt) {
    if (this.p1.downed || this.p2.downed) return;
    const a = this.p1.root.position;
    const b = this.p2.root.position;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    const min = 0.92;
    if (dist > 0.0001 && dist < min) {
      const push = (min - dist) * 0.5;
      a.x -= (dx / dist) * push;
      a.z -= (dz / dist) * push;
      b.x += (dx / dist) * push;
      b.z += (dz / dist) * push;
      this._clampToRing(this.p1);
      this._clampToRing(this.p2);
    }
  }

  _applyKnockback(dt) {
    for (let i = 0; i < 2; i++) {
      const f = i === 0 ? this.p1 : this.p2;
      if (this.knockback[i].lengthSq() < 0.0001) continue;
      f.root.position.addScaledVector(this.knockback[i], dt);
      this.knockback[i].multiplyScalar(Math.pow(0.006, dt));
      if (this.knockback[i].lengthSq() < 0.01) this.knockback[i].set(0, 0, 0);
      this._clampToRing(f);
    }
  }

  _updateAI(dt) {
    const p1 = this.p1;
    const p2 = this.p2;
    const m = this.match;
    if (p2.downed || p2.ko || p1.ko) {
      p2.setBlocking(false);
      this.aiMove = new THREE.Vector3();
      return;
    }

    const profile = this.profile;
    const dx = p1.root.position.x - p2.root.position.x;
    const dz = p1.root.position.z - p2.root.position.z;
    const dist = Math.hypot(dx, dz);
    const toward = new THREE.Vector3(dx, 0, dz).normalize();

    this.aiCooldown -= dt;
    this.aiBlockTimer -= dt;
    this.aiStrafeTimer -= dt;
    this.aiTauntTimer -= dt;

    // React to a new player strike with a chance to shell up.
    if (p1.action && p1.action !== this.aiReactedAction) {
      this.aiReactedAction = p1.action;
      if (dist < 2.7 && m.stamina[1] > 12 && Math.random() < profile.block * 0.92) {
        this.aiBlockTimer = random(0.28, 0.62);
        this.g.sound?.whoosh(false);
      }
    }
    if (!p1.action) this.aiReactedAction = null;

    p2.setBlocking(this.aiBlockTimer > 0 && m.stamina[1] > 0 && !p2.action);

    if (this.aiStrafeTimer <= 0) {
      this.aiStrafe = Math.random() > 0.5 ? 1 : -1;
      this.aiStrafeTimer = random(0.9, 2.4);
    }

    const desired = new THREE.Vector3();
    const preferred = p2.config.id === "okafor" ? 1.65 : 1.85;
    const retreat = m.stamina[1] < 18 || (m.health[1] < 18 && Math.random() < 0.35);

    if (retreat) {
      if (dist < 2.6) desired.addScaledVector(toward, -1);
      desired.addScaledVector(new THREE.Vector3(toward.z, 0, -toward.x), this.aiStrafe * 0.9);
      if (dist > 3.4) desired.addScaledVector(toward, 0.55);
    } else {
      if (dist > preferred + 0.25) desired.addScaledVector(toward, 1);
      else if (dist < preferred - 0.32) desired.addScaledVector(toward, -0.65);
      desired.addScaledVector(new THREE.Vector3(toward.z, 0, -toward.x), this.aiStrafe * (dist < 3.1 ? 0.26 : 0.55));
    }
    if (p2.action || p2.blocking) desired.multiplyScalar(0.15);
    if (desired.lengthSq() > 1) desired.normalize();

    const speed = p2.config.speed * 2.42 * (p2.blocking ? 0.38 : 1) * (m.stamina[1] < 18 ? 0.74 : 1);
    this.aiMove = desired;
    this.lastAiSpeed = speed;
    this._moveFighter(p2, desired, speed, dt, 1);

    if (p2.action || p2.blocking || p1.downed) return;

    if (this.aiCooldown <= 0 && dist < 2.48 && m.stamina[1] > 8) {
      const options = [
        { key: "jab", w: 0.46 },
        { key: "heavy", w: 0.26 },
        { key: "kick", w: dist < 2.35 ? 0.19 : 0 },
        { key: "takedown", w: dist < 2.0 ? profile.takedown : 0 },
      ];
      let roll = Math.random() * options.reduce((sum, option) => sum + option.w, 0);
      let chosen = "jab";
      for (const option of options) {
        roll -= option.w;
        if (roll <= 0) {
          chosen = option.key;
          break;
        }
      }
      // Don't waste big moves at max stamina if opponent is circling away.
      if (chosen === "heavy" && Math.random() < 0.22) chosen = "jab";
      if (this.attack(chosen, false)) {
        this.aiCooldown = random(0.34, 0.88) / (0.5 + profile.patience * 0.5);
      }
    } else if (this.aiCooldown <= 0 && dist > 3.4 && Math.random() < 0.35 * dt * 6) {
      // occasional circling feint
      this.aiStrafeTimer = 0.5;
    }

    // The champion talks with his hands.
    if (m.health[0] < 18 && p1.downed && this.aiTauntTimer <= 0) {
      this.aiTauntTimer = 6;
      p2.setVictory(true);
      setTimeout(() => p2.setVictory(false), 900);
    }
  }

  attack(key, isPlayer) {
    if (this.g.state !== "fight") return false;
    const idx = isPlayer ? 0 : 1;
    const fighter = idx === 0 ? this.p1 : this.p2;
    const m = this.match;
    const move = MOVES[key];
    if (!move || !m || fighter.downed || fighter.ko) return false;
    if (fighter.action) return false;
    if (m.stamina[idx] < move.stamina) {
      if (isPlayer) {
        this.g.ui.flashStatus("NOT ENOUGH STAMINA", 1.1);
        this.g.sound?.ui(false);
      }
      return false;
    }
    fighter.setBlocking(false);
    if (!fighter.playMove(key)) return false;
    m.stamina[idx] = Math.max(0, m.stamina[idx] - move.stamina);
    m.stats[idx].strikes += 1;
    this.g.sound?.whoosh(key !== "jab");
    if (isPlayer) {
      this.g.ui.setStatus("", 0);
      if (key === "takedown") this.g.ui.flashStatus("TAKEDOWN ATTEMPT", 0.7);
    }
    return true;
  }

  _resolvePending(attacker, defender, idx) {
    const action = attacker.action;
    if (!action || action.hitConsumed || action.t < action.move.hitAt) return;
    action.hitConsumed = true;
    if (defender.ko) return;

    const dx = defender.root.position.x - attacker.root.position.x;
    const dz = defender.root.position.z - attacker.root.position.z;
    const dist = Math.hypot(dx, dz);
    const fwd = forwardFromYaw(attacker.yaw);
    const dot = dist < 0.0001 ? 1 : (dx / dist) * fwd.x + (dz / dist) * fwd.z;
    const move = action.move;

    if (dist > move.range + 0.28 || dot < 0.2) {
      if (idx === 0) this.g.ui.flashStatus("WHIFF · RESET YOUR FEET", 0.7);
      return;
    }
    if (defender.downed || defender.invulnerable > 0) return;

    const m = this.match;
    let blocked = defender.blocking && m.stamina[1 - idx] > 0;
    let guardBreak = false;
    let counter = false;
    if (defender.action && defender.action.t < defender.action.move.hitAt && !blocked) {
      counter = Math.random() < (idx === 0 ? 0.88 : 0.7);
    }

    let damage = move.damage * attacker.config.power * random(0.93, 1.07);
    if (blocked) {
      m.stamina[1 - idx] = Math.max(0, m.stamina[1 - idx] - (move.key === "takedown" ? 16 : 11));
      if (m.stamina[1 - idx] <= 0) {
        guardBreak = true;
        blocked = false;
        damage *= 0.62;
        if (idx === 0) this.g.ui.flashStatus("GUARD BROKEN", 1.2);
      } else {
        damage *= move.key === "takedown" ? 0.12 : 0.16;
      }
    }
    if (counter) damage *= 1.34;
    damage = Math.max(0.5, damage);

    const healthKey = 1 - idx;
    m.health[healthKey] = Math.max(0, m.health[healthKey] - damage);
    m.roundDamage[idx] += damage;
    m.stats[idx].damage += damage;
    m.stats[idx].landed += 1;
    if (blocked) m.stats[healthKey].blocks += 1;

    // Combos only count clean or guard-breaking hits.
    if (!blocked && !guardBreak) {
      m.combo[idx] += 1;
      m.comboTimer[idx] = 1.75;
    } else {
      m.combo[idx] = 0;
    }

    const hitPos = defender.root.position.clone();
    hitPos.y += 1.62;
    let heavy = false;
    if (blocked) {
      this.g.sound?.punch(0.75, true);
      this.g.effects.impact(hitPos, 0x9fc6ff, 0.7, 10);
      this.g.shake = Math.min(1.4, this.g.shake + 0.16);
      defender.takeHit(false);
      this._damageNumber(hitPos, "BLOCK", "block");
    } else if (guardBreak) {
      this.g.sound?.punch(1.2, false);
      this.g.effects.impact(hitPos, 0xffb54a, 1.2, 24);
      this.g.shake = Math.min(1.6, this.g.shake + 0.5);
      defender.takeHit(true);
      this._damageNumber(hitPos, Math.round(damage), "heavy");
      if (idx === 1) this.g.ui.flashScreen(0.75);
    } else {
      heavy = move.damage >= 12;
      this.g.sound?.punch(heavy ? 1.28 : 0.9, false);
      this.g.effects.impact(hitPos, counter ? 0xffffff : heavy ? 0xffa234 : 0xffd092, heavy ? 1.35 : 0.85, heavy ? 28 : 14);
      this.g.shake = Math.min(1.8, this.g.shake + (heavy ? 0.62 : 0.26));
      defender.takeHit(heavy);
      this._damageNumber(hitPos, Math.round(damage), heavy ? "heavy" : "");
      if (idx === 1) this.g.ui.flashScreen(heavy ? 0.85 : 0.45);
    }

    if (counter) {
      defender.cancelAction();
      if (idx === 0) this.g.ui.showCallout("COUNTER", "+34% DAMAGE");
      this.g.sound?.punch(1, false, 0.03);
    } else if (guardBreak && idx === 0) {
      this.g.ui.showCallout("GUARD BREAK", "STAMINA DRAINED");
    } else if (heavy && !blocked && idx === 0 && Math.random() < 0.16) {
      this.g.ui.showCallout("CLEAN SHOT", "MOMENTUM SHIFT");
    }

    // Knockback
    const pushDir = new THREE.Vector3(dx, 0, dz).normalize();
    this.knockback[healthKey].addScaledVector(pushDir, move.push * (blocked ? 0.5 : 1));
    if (move.key === "kick" && !blocked) {
      this.knockback[healthKey].addScaledVector(pushDir, 0.42);
    }

    // Takedowns put opponents on the mat.
    if (move.key === "takedown" && !blocked) {
      m.stats[idx].takedowns += 1;
      m.stats[idx].knockdowns += 1;
      defender.knockDown(random(2.2, 2.9));
      this.g.sound?.takedown();
      this.g.ui.showAnnounce("TAKEDOWN", "POSITION SECURED");
      this.g.ui.flashStatus(idx === 0 ? "TAKEDOWN · STAY ON HIM" : "TAKEN DOWN · FIGHT BACK", 1.6);
    }

    if (m.health[healthKey] <= 0) {
      this.g.beginKO(idx);
      return;
    }

    // Flashdowns from big kicks at low stamina.
    if (!blocked && move.key === "kick" && m.stamina[healthKey] < 9 && m.health[healthKey] < 55) {
      defender.knockDown(1.5);
      m.stats[idx].knockdowns += 1;
      this.g.ui.showAnnounce("FLASH DOWN", "MOMENTUM SHIFT");
    }
  }

  _damageNumber(worldPos, value, type) {
    const screen = this.g.projectToScreen(worldPos);
    if (screen) this.g.ui.damageNumber(screen.x, screen.y, value, type);
  }

  finishRound() {
    const m = this.match;
    if (!m) return null;
    let winner = -1;
    if (m.roundDamage[0] > m.roundDamage[1] + 0.2) winner = 0;
    else if (m.roundDamage[1] > m.roundDamage[0] + 0.2) winner = 1;
    if (winner >= 0) m.roundWins[winner] += 1;
    m.lastRoundWin = winner;
    return {
      winner,
      damage: [...m.roundDamage],
      roundWins: [...m.roundWins],
    };
  }

  decide() {
    const m = this.match;
    if (!m) return null;
    let winner = -1;
    if (m.roundWins[0] !== m.roundWins[1]) winner = m.roundWins[0] > m.roundWins[1] ? 0 : 1;
    else {
      const total0 = m.stats[0].damage;
      const total1 = m.stats[1].damage;
      if (Math.abs(total0 - total1) > 0.2) winner = total0 > total1 ? 0 : 1;
      else if (m.health[0] !== m.health[1]) winner = m.health[0] > m.health[1] ? 0 : 1;
    }
    return winner;
  }

  isFinalRound() {
    return this.match && this.match.round >= MAX_ROUNDS;
  }
}
