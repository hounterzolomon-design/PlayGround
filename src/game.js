import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Arena } from "./arena.js";
import { Fighter } from "./fighter.js";
import { SoundEngine } from "./audio.js";
import { Combat } from "./combat.js";
import { Effects } from "./effects.js";
import { GameUI } from "./ui.js";
import {
  FIGHTERS,
  FIGHTER_BY_ID,
  MAX_ROUNDS,
  RING_RADIUS,
  RIVALS,
  ROUND_SECONDS,
} from "./config.js";

const TAU = Math.PI * 2;
const BASE_Y = 0.57;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));
const formatTime = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export class Game {
  constructor() {
    this.app = document.getElementById("app");
    this.canvas = document.getElementById("scene");
    this.ui = new GameUI();
    this.audio = new SoundEngine();
    this.state = "loading";
    this.time = 0;
    this.timeScale = 1;
    this.shake = 0;
    this.selectedIndex = 0;
    this.rivalId = RIVALS[FIGHTERS[0].id];
    this.keys = new Set();
    this.keyboardBlock = false;
    this.touchBlock = false;
    this.blockHeld = false;
    this.touchMove = { x: 0, y: 0, active: false };
    this.roundIntroTimer = 0;
    this.roundEndTimer = 0;
    this.koTimer = 0;
    this.koWinner = 0;
    this.finishDetail = "";
    this.pausedFrom = "fight";
    this.howtoOpen = false;
    this.soundEnabled = this._readSoundPref();
    this.showcase = [];
    this.selectionRings = [];
    this.fighters = null;

    this._initRenderer();
    this._initScene();
    this._initShowcase();
    this._initCombat();
    this._bindInput();
    this._bindUi();
    this._updateSelectUi();
    this.audio.setEnabled(this.soundEnabled);
    this.ui.setSound(this.soundEnabled);

    this.state = "menu";
    this.ui.showScreen("menu");
    this.arena.setScreen({ left: "KAI MORENO", right: "MARCUS OKAFOR", round: "FIGHT NIGHT 07" });
    this.camera.position.set(0, 3.2, 4.62);
    this.camLook.set(0, 1.25, 0);
    this.camera.lookAt(this.camLook);

    this.lastFrame = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
    window.setTimeout(() => this.ui.hideLoading(), 850);
    window.__OCTAGON__ = this;
  }

  _readSoundPref() {
    try {
      return localStorage.getItem("octagon-sound") !== "off";
    } catch {
      return true;
    }
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x06070b, 0.017);
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 70);
    this.camLook = new THREE.Vector3(0, 1.25, 0);
    this.arena = new Arena(this.scene, this.renderer);
    this.effects = new Effects(this.scene);

    this.usePost = !window.matchMedia("(pointer: coarse)").matches && window.devicePixelRatio < 2.5;
    if (this.usePost) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.2, 0.42, 1.05);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    window.addEventListener("resize", () => this._resize());
  }

  _initShowcase() {
    const spacing = 2.12;
    FIGHTERS.forEach((config, index) => {
      const fighter = new Fighter(config, "showcase");
      fighter.setBaseY(BASE_Y);
      fighter.root.position.set((index - 1) * spacing, BASE_Y, 0);
      fighter.root.rotation.y = 0;
      fighter.yaw = 0;
      fighter.showcaseTimer = 1.5 + index * 1.7;
      this.scene.add(fighter.root);
      this.showcase.push(fighter);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.56, 0.63, 48),
        new THREE.MeshBasicMaterial({
          color: config.accent,
          transparent: true,
          opacity: 0.26,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set((index - 1) * spacing, BASE_Y + 0.008, 0);
      this.scene.add(ring);
      this.selectionRings.push(ring);
    });
  }

  _initCombat() {
    this.combat = new Combat(this);
    this.match = null;
    this.p1 = null;
    this.p2 = null;
  }

  startFight() {
    if (!["menu", "select", "result", "paused"].includes(this.state)) return;
    this._ensureAudio();
    const playerConfig = FIGHTERS[this.selectedIndex];
    const rivalConfig = FIGHTER_BY_ID[this.rivalId];
    if (!rivalConfig) return;

    this._disposeFightFighters();
    this.p1 = new Fighter(playerConfig, "left");
    this.p2 = new Fighter(rivalConfig, "right");
    this.p1.setBaseY(BASE_Y);
    this.p2.setBaseY(BASE_Y);
    this.scene.add(this.p1.root, this.p2.root);
    this.fighters = [this.p1, this.p2];
    this.showcase.forEach((fighter) => {
      fighter.root.visible = false;
    });
    this.selectionRings.forEach((ring) => {
      ring.visible = false;
    });

    this.combat.begin(this.p1, this.p2, this.rivalId);
    this.match = this.combat.match;
    this.ui.setFighters(playerConfig, rivalConfig);
    this.ui.closeAllModals();
    this.ui.hideResult();
    this.ui.showScreen("fight");
    this.ui.resetForRound(1, ROUND_SECONDS);
    this.arena.setScreen({ left: playerConfig.last, right: rivalConfig.last, round: "ROUND 1" });
    this._placeFighters();
    if (this.arena.referee) this.arena.referee.position.set(3.6, 0.56, 1.0);
    this.state = "roundIntro";
    this.roundIntroTimer = 1.7;
    this.timeScale = 1;
    this.shake = 0;
    this.ui.showRoundCard("ROUND ONE", "1", "FIGHT");
    this.audio.startCrowd();
    this.audio.cheer(0.65);
    this.ui.setStatus("TAP INTO THE CROWD");
    this.keyboardBlock = false;
    this.touchBlock = false;
    this.blockHeld = false;
    this.ui.updateHud(this.match, playerConfig, rivalConfig);
  }

  _placeFighters() {
    if (!this.p1 || !this.p2) return;
    this.p1.root.position.set(-1.12, BASE_Y, 0);
    this.p2.root.position.set(1.12, BASE_Y, 0);
    this.p1.yaw = Math.PI / 2;
    this.p2.yaw = -Math.PI / 2;
    this.p1.root.rotation.y = Math.PI / 2;
    this.p2.root.rotation.y = -Math.PI / 2;
    this.p1.setFacing(1, 0, 1);
    this.p2.setFacing(-1, 0, 1);
  }

  _disposeFightFighters() {
    if (!this.fighters) return;
    for (const fighter of this.fighters) {
      this.scene.remove(fighter.root);
    }
    this.fighters = null;
    this.p1 = null;
    this.p2 = null;
  }

  beginRound(round) {
    this.combat.resetRoundState(round, false);
    this.p1.reset();
    this.p2.reset();
    this._placeFighters();
    this.state = "roundIntro";
    this.roundIntroTimer = 1.65;
    this.timeScale = 1;
    this.blockHeld = false;
    this.keyboardBlock = false;
    this.touchBlock = false;
    this.ui.resetForRound(round, ROUND_SECONDS);
    this.ui.showRoundCard(round === 1 ? "ROUND ONE" : round === 2 ? "ROUND TWO" : "FINAL ROUND", String(round), "FIGHT");
    this.arena.setScreen({ left: this.p1.config.last, right: this.p2.config.last, round: `ROUND ${round}` });
    this.audio.cheer(0.6);
    this.ui.updateHud(this.match);
  }

  onRoundTimeExpired() {
    if (this.state !== "fight") return;
    this.state = "roundEnd";
    this.roundEndTimer = 3.4;
    this.timeScale = 1;
    this.audio.bell(3);
    const summary = this.combat.finishRound();
    this.ui.updateHud(this.match);
    this.ui.showRoundCard("ROUND " + this.match.round, "TIME", "ROUND OVER");
    let sub = "SCORECARDS ARE IN";
    if (summary?.winner === 0) sub = "YOU TOOK THE ROUND";
    if (summary?.winner === 1) sub = `${this.p2.config.last} TOOK THE ROUND`;
    this.ui.flashStatus(sub, 3);
    this.ui.setStatus(sub);
    this.audio.cheer(0.8);
  }

  beginKO(winnerIndex) {
    if (this.state !== "fight") return;
    const loser = winnerIndex === 0 ? this.p2 : this.p1;
    const winner = winnerIndex === 0 ? this.p1 : this.p2;
    this.match.health[1 - winnerIndex] = 0;
    this.state = "ko";
    this.koWinner = winnerIndex;
    this.koTimer = 0;
    this.timeScale = 0.3;
    this.finishDetail = `ROUND ${this.match.round} · ${formatTime(ROUND_SECONDS - this.match.roundTime)}`;
    loser.setKO();
    winner.cancelAction();
    winner.setBlocking(false);
    this.ui.showAnnounce("KO", winnerIndex === 0 ? "KNOCKOUT" : "YOU'RE OUT");
    this.ui.flashStatus("IT'S ALL OVER", 4.5);
    this.ui.flashScreen(1);
    this.audio.ko();
    this.audio.cheer(1.8);
    this.shake = 1.8;
    this.keyboardBlock = false;
    this.touchBlock = false;
    this.blockHeld = false;
  }

  finishDecision() {
    let winner = this.combat.decide();
    if (winner < 0) winner = this.match.health[0] >= this.match.health[1] ? 0 : 1;
    const method = Math.abs(this.match.roundWins[0] - this.match.roundWins[1]) >= 2 ? "UNANIMOUS DECISION" : "SPLIT DECISION";
    this.finishMatch(winner, method, "3 ROUNDS COMPLETE");
  }

  finishMatch(winnerIndex, method, detail) {
    this.state = "result";
    this.timeScale = 1;
    const playerWon = winnerIndex === 0;
    const winner = winnerIndex === 0 ? this.p1 : this.p2;
    const loser = winnerIndex === 0 ? this.p2 : this.p1;
    winner.setVictory(true);
    if (!loser.ko) loser.setBlocking(false);
    const stats = this.match.stats[0];
    const accuracy = stats.strikes ? Math.round((stats.landed / stats.strikes) * 100) : 0;
    this.ui.showResult({
      title: playerWon ? "VICTORY" : "DEFEAT",
      playerWon,
      method,
      detail,
      winner: winner.config,
      loser: loser.config,
      stats: [
        { value: `${stats.landed}/${stats.strikes}`, label: "STRIKES LANDED" },
        { value: `${accuracy}%`, label: "ACCURACY" },
        { value: String(stats.takedowns), label: "TAKEDOWNS" },
        { value: String(Math.round(stats.damage)), label: "DAMAGE DEALT" },
      ],
    });
    this.arena.setScreen({ left: playerWon ? this.p1.config.last : this.p2.config.last, right: playerWon ? this.p2.config.last : this.p1.config.last, round: playerWon ? "VICTORY" : "DEFEAT" });
    this.audio.cheer(playerWon ? 2 : 0.7);
    if (playerWon) {
      this.effects.confetti([this.p1.config.accent, 0xf7f2e8, 0xffc14a]);
    }
  }

  showSelect() {
    this.ui.closeAllModals();
    this.ui.hideResult();
    this._disposeFightFighters();
    this.combat.match = null;
    this.match = null;
    this.showcase.forEach((f) => {
      f.root.visible = true;
      f.reset();
    });
    this.selectionRings.forEach((r) => {
      r.visible = true;
    });
    this.state = "select";
    this.ui.showScreen("select");
    this._updateSelectUi();
    this.arena.setScreen({
      left: FIGHTERS[this.selectedIndex].last,
      right: FIGHTER_BY_ID[this.rivalId].last,
      round: "CHOOSE YOUR FIGHTER",
    });
  }

  returnToMenu() {
    this.ui.closeAllModals();
    this.ui.hideResult();
    this._disposeFightFighters();
    this.combat.match = null;
    this.match = null;
    this.showcase.forEach((f) => {
      f.root.visible = true;
      f.reset();
    });
    this.selectionRings.forEach((r) => {
      r.visible = true;
    });
    this.state = "menu";
    this.timeScale = 1;
    this.ui.showScreen("menu");
    this.arena.setScreen({ left: "KAI MORENO", right: "MARCUS OKAFOR", round: "FIGHT NIGHT 07" });
  }

  _updateSelectUi() {
    const fighter = FIGHTERS[this.selectedIndex];
    this.rivalId = RIVALS[fighter.id];
    const rival = FIGHTER_BY_ID[this.rivalId];
    this.ui.buildFighterCards(FIGHTERS);
    this.ui.selectCard(this.selectedIndex, fighter, rival);
    this.selectionRings.forEach((ring, index) => {
      ring.material.color.setHex(FIGHTERS[index].accent);
      ring.material.opacity = index === this.selectedIndex ? 0.9 : 0.14;
    });
  }

  selectFighter(index) {
    if (index === this.selectedIndex) return;
    this.selectedIndex = index;
    this.rivalId = RIVALS[FIGHTERS[index].id];
    this.audio.init();
    this.audio.ui(true);
    this._updateSelectUi();
    this.arena.setScreen({
      left: FIGHTERS[this.selectedIndex].last,
      right: FIGHTER_BY_ID[this.rivalId].last,
      round: "CHOOSE YOUR FIGHTER",
    });
    const fighter = this.showcase[index];
    if (fighter && !fighter.action) fighter.playMove("jab");
  }

  pauseGame() {
    if (!["fight", "roundIntro"].includes(this.state)) return;
    this.pausedFrom = this.state;
    this.state = "paused";
    this.ui.openModal("pause");
    this.app.classList.remove("fight-live");
    this.keyboardBlock = false;
    this.touchBlock = false;
    this.blockHeld = false;
    this.touchMove = { x: 0, y: 0, active: false };
    this._resetJoystick();
  }

  resumeGame() {
    if (this.state !== "paused") return;
    this.state = this.pausedFrom;
    this.ui.closeModal("pause");
    this.app.classList.add("fight-live");
  }

  openHowTo() {
    this.howtoOpen = true;
    if (this.state === "paused") this.ui.closeModal("pause");
    this.ui.openModal("howto");
  }

  closeHowTo() {
    this.howtoOpen = false;
    this.ui.closeModal("howto");
    if (this.state === "paused") this.ui.openModal("pause");
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    this.audio.setEnabled(this.soundEnabled);
    this.ui.setSound(this.soundEnabled);
    if (this.soundEnabled) {
      this._ensureAudio();
      this.audio.ui(true);
    }
    try {
      localStorage.setItem("octagon-sound", this.soundEnabled ? "on" : "off");
    } catch {
      /* private mode */
    }
  }

  _ensureAudio() {
    if (!this.soundEnabled) return;
    this.audio.init();
    this.audio.startCrowd();
  }

  getMoveInput() {
    let forward = 0;
    let strafe = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) forward += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) forward -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) strafe += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) strafe -= 1;
    if (this.touchMove.active) {
      forward += -this.touchMove.y;
      strafe += this.touchMove.x;
    }
    const length = Math.hypot(forward, strafe);
    if (length > 1) {
      forward /= length;
      strafe /= length;
    }
    return { forward, strafe };
  }

  projectToScreen(position) {
    const v = position.clone().project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * rect.width,
      y: (-v.y * 0.5 + 0.5) * rect.height,
    };
  }

  _bindInput() {
    document.addEventListener("keydown", (event) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
      if (event.repeat) {
        if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
          this.keys.add(event.code);
        }
        return;
      }
      if (event.code === "Escape") {
        if (this.howtoOpen) {
          this.closeHowTo();
          return;
        }
        if (this.state === "paused") this.resumeGame();
        else if (this.state === "fight" || this.state === "roundIntro") this.pauseGame();
        else if (this.state === "select") this.returnToMenu();
        return;
      }
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        this.keys.add(event.code);
      }
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        this.keyboardBlock = true;
      }
      if (this.state === "menu" && (event.code === "Enter" || event.code === "Space")) {
        this.showSelect();
        return;
      }
      if (this.state === "select" && event.code === "Enter") {
        this.startFight();
        return;
      }
      if (this.state !== "fight") return;
      if (event.code === "KeyJ") this.combat.attack("jab", true);
      else if (event.code === "KeyK") this.combat.attack("heavy", true);
      else if (event.code === "KeyL") this.combat.attack("kick", true);
      else if (event.code === "Space") this.combat.attack("takedown", true);
      else if (event.code === "KeyP") this.pauseGame();
    });

    document.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") this.keyboardBlock = false;
    });

    window.addEventListener("blur", () => {
      this.keys.clear();
      this.keyboardBlock = false;
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "fight") this.pauseGame();
    });

    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("pointerdown", (event) => {
      this._ensureAudio();
      if (this.state !== "fight" || event.pointerType === "touch") return;
      if (event.button === 0) this.combat.attack("jab", true);
      if (event.button === 2) this.combat.attack("heavy", true);
    });

    this._bindTouch();
  }

  _bindTouch() {
    const joystick = document.getElementById("joystick");
    const knob = document.getElementById("joystick-knob");
    let pointerId = null;
    let center = { x: 0, y: 0 };
    const maxDistance = 38;

    const updateStick = (event) => {
      let dx = event.clientX - center.x;
      let dy = event.clientY - center.y;
      const dist = Math.hypot(dx, dy);
      if (dist > maxDistance) {
        dx = (dx / dist) * maxDistance;
        dy = (dy / dist) * maxDistance;
      }
      const nx = dx / maxDistance;
      const ny = dy / maxDistance;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touchMove.active = Math.hypot(nx, ny) > 0.12;
      this.touchMove.x = nx;
      this.touchMove.y = ny;
    };

    joystick.addEventListener("pointerdown", (event) => {
      if (this.state !== "fight") return;
      event.preventDefault();
      pointerId = event.pointerId;
      joystick.setPointerCapture(pointerId);
      const rect = joystick.getBoundingClientRect();
      center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      updateStick(event);
    });
    joystick.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId) return;
      event.preventDefault();
      updateStick(event);
    });
    const releaseStick = (event) => {
      if (pointerId !== null && event.pointerId !== pointerId) return;
      pointerId = null;
      this.touchMove = { x: 0, y: 0, active: false };
      knob.style.transform = "translate(0, 0)";
    };
    joystick.addEventListener("pointerup", releaseStick);
    joystick.addEventListener("pointercancel", releaseStick);
    joystick.addEventListener("lostpointercapture", releaseStick);

    document.querySelectorAll("[data-touch]").forEach((button) => {
      const action = button.dataset.touch;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this._ensureAudio();
        if (this.state !== "fight") return;
        if (action === "block") {
          this.touchBlock = true;
          button.classList.add("pressed");
          return;
        }
        button.classList.add("pressed");
        this.combat.attack(action, true);
      });
      const release = (event) => {
        event.preventDefault();
        button.classList.remove("pressed");
        if (action === "block") this.touchBlock = false;
      };
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("pointerleave", release);
    });
  }

  _resetJoystick() {
    const knob = document.getElementById("joystick-knob");
    if (knob) knob.style.transform = "translate(0, 0)";
    this.touchMove = { x: 0, y: 0, active: false };
  }

  _bindUi() {
    this.app.addEventListener("pointerdown", () => this._ensureAudio());
    this.app.addEventListener("click", (event) => {
      const card = event.target.closest("[data-fighter]");
      if (card) {
        this.selectFighter(Number(card.dataset.fighter));
        return;
      }
      const actionNode = event.target.closest("[data-action]");
      if (!actionNode) return;
      const action = actionNode.dataset.action;
      this._ensureAudio();
      this.audio.ui(true);
      switch (action) {
        case "select":
          this.showSelect();
          break;
        case "fight":
          this.startFight();
          break;
        case "howto":
          this.openHowTo();
          break;
        case "close-howto":
          this.closeHowTo();
          break;
        case "resume":
          this.resumeGame();
          break;
        case "quit":
          this.returnToMenu();
          break;
        case "rematch":
          this.startFight();
          break;
        case "menu":
          this.returnToMenu();
          break;
        case "sound":
          this.toggleSound();
          break;
        default:
          break;
      }
    });
  }

  _resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
      this.bloom.setSize(width, height);
    }
  }

  _loop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time += dt;
    this.update(dt);
    this.render();
    requestAnimationFrame(this._loop);
  }

  update(dt) {
    this.arena.update(dt, this.time);
    this.blockHeld = this.keyboardBlock || this.touchBlock;

    switch (this.state) {
      case "menu":
      case "select":
        this._updateShowcase(dt);
        break;
      case "roundIntro":
        this.roundIntroTimer -= dt;
        if (this.p1 && this.p2) {
          this.p1.update(dt, this.time, 0);
          this.p2.update(dt, this.time, 0);
        }
        if (this.roundIntroTimer <= 0) {
          this.state = "fight";
          this.audio.bell(1);
          this.ui.setStatus("FIGHT");
          this.ui.flashStatus("FIGHT", 0.9);
        }
        break;
      case "fight":
        this.combat.update(dt);
        break;
      case "roundEnd":
        this.roundEndTimer -= dt;
        if (this.p1 && this.p2) {
          this.p1.update(dt, this.time, 0);
          this.p2.update(dt, this.time, 0);
        }
        if (this.roundEndTimer <= 0) {
          if (this.combat.isFinalRound()) this.finishDecision();
          else this.beginRound(this.match.round + 1);
        }
        break;
      case "ko":
        this.koTimer += dt;
        const sdt = dt * this.timeScale;
        if (this.p1 && this.p2) {
          this.p1.update(sdt, this.time, 0);
          this.p2.update(sdt, this.time, 0);
        }
        this.timeScale = damp(this.timeScale, this.koTimer > 1.5 ? 0.62 : 0.3, 1.2, dt);
        const koWinner = this.koWinner === 0 ? this.p1 : this.p2;
        const koLoser = this.koWinner === 0 ? this.p2 : this.p1;
        if (koWinner && this.koTimer > 1.15) koWinner.setVictory(true);
        if (this.koTimer > 2.0 && koLoser && koLoser.visual.rotation.x < -1.35) {
          this.koLoserRest = true;
        }
        if (this.koTimer > 4.6) {
          this.finishMatch(this.koWinner, "KO / TKO", this.finishDetail);
        }
        break;
      case "result":
        if (this.p1 && this.p2) {
          this.p1.update(dt, this.time, 0);
          this.p2.update(dt, this.time, 0);
        }
        break;
      case "paused":
        if (this.p1 && this.p2) {
          this.p1.update(0, this.time, 0);
          this.p2.update(0, this.time, 0);
        }
        break;
      default:
        break;
    }

    if (this.match && ["roundIntro", "fight", "roundEnd", "ko", "paused"].includes(this.state)) {
      this.ui.updateHud(this.match);
    }
    this.ui.tickStatus();
    this.effects.update(dt);
    this._updateCamera(dt);
    this._updateReferee(dt);
    this.shake *= Math.exp(-5.5 * dt);
  }

  /**
   * Keep the official on the far side of the action so he never blocks the
   * broadcast angle, and park him by the far fence on menu screens.
   */
  _updateReferee(dt) {
    const ref = this.arena.referee;
    if (!ref) return;
    const inFight = this.p1 && this.p2 && ["roundIntro", "fight", "roundEnd", "ko", "result", "paused"].includes(this.state);
    ref.visible = !!inFight;
    if (!inFight) return;
    const mid = new THREE.Vector3(
      (this.p1.root.position.x + this.p2.root.position.x) / 2,
      0,
      (this.p1.root.position.z + this.p2.root.position.z) / 2,
    );
    const away = new THREE.Vector3(mid.x - this.camera.position.x, 0, mid.z - this.camera.position.z);
    if (away.lengthSq() > 0.001) away.normalize();
    const side = new THREE.Vector3(away.z, 0, -away.x);
    let tx = mid.x + away.x * 1.6 + side.x * 3.2;
    let tz = mid.z + away.z * 1.6 + side.z * 3.2;
    const radius = Math.hypot(tx, tz);
    if (radius > 4.25) {
      tx = (tx / radius) * 4.25;
      tz = (tz / radius) * 4.25;
    }
    ref.position.x = damp(ref.position.x, tx, 2.4, dt);
    ref.position.z = damp(ref.position.z, tz, 2.4, dt);
  }

  _updateShowcase(dt) {
    const selectMode = this.state === "select";
    const spacing = 2.12;
    const sideSlots = [-spacing, 0, spacing];
    const others = [0, 1, 2].filter((i) => i !== this.selectedIndex);
    this.showcase.forEach((fighter, index) => {
      const targetZ = selectMode ? (index === this.selectedIndex ? 0.36 : -0.08) : 0;
      const targetX = selectMode
        ? index === this.selectedIndex
          ? 0
          : index === others[0]
            ? sideSlots[0]
            : sideSlots[2]
        : (index - 1) * spacing;
      fighter.root.position.x = damp(fighter.root.position.x, targetX, 5, dt);
      fighter.root.position.z = damp(fighter.root.position.z, targetZ, 5, dt);
      fighter.setFacing(0, 1, dt);
      fighter.update(dt, this.time, 0);
      fighter.showcaseTimer -= dt;
      if (fighter.showcaseTimer <= 0 && !fighter.action) {
        fighter.showcaseTimer = 2.4 + Math.random() * 3.2;
        const moves = ["jab", "heavy", "jab", "kick"];
        fighter.playMove(moves[(Math.random() * moves.length) | 0]);
      }
      const ring = this.selectionRings[index];
      ring.position.x = fighter.root.position.x;
      ring.position.z = fighter.root.position.z;
      if (selectMode) {
        const selected = index === this.selectedIndex;
        ring.material.opacity = selected ? 0.88 + Math.sin(this.time * 4) * 0.1 : 0.12;
        ring.scale.setScalar(selected ? 1.08 + Math.sin(this.time * 4) * 0.025 : 0.9);
      } else {
        ring.material.opacity = 0.2 + Math.sin(this.time * 2 + index) * 0.04;
        ring.scale.setScalar(0.9);
      }
    });
  }

  _updateCamera(dt) {
    const desired = new THREE.Vector3();
    const look = new THREE.Vector3();
    const portrait = this.camera.aspect < 0.85;
    let targetFov = 50;
    let rate = 5;

    if (this.state === "menu" || this.state === "select") {
      const selectMode = this.state === "select";
      const drift = Math.sin(this.time * 0.13) * 0.16;
      desired.set(selectMode ? -0.1 : -0.25 + drift, selectMode ? 2.3 : 2.65, selectMode ? 4.45 : 4.62);
      look.set(0, selectMode ? 1.3 : 1.24, selectMode ? 0.08 : 0.02);
      targetFov = selectMode ? (portrait ? 60 : 48) : (portrait ? 62 : 50);
      rate = 3.2;
    } else if (this.state === "roundIntro" || this.state === "fight" || this.state === "paused") {
      if (this.p1 && this.p2) {
        const p1p = this.p1.root.position;
        const p2p = this.p2.root.position;
        const dir = new THREE.Vector3(p2p.x - p1p.x, 0, p2p.z - p1p.z);
        if (dir.lengthSq() < 0.001) dir.set(1, 0, 0);
        dir.normalize();
        const right = new THREE.Vector3(dir.z, 0, -dir.x);
        const mid = new THREE.Vector3((p1p.x + p2p.x) / 2, 0, (p1p.z + p2p.z) / 2);
        // Side-on broadcast angle: stand off the fighters' axis so both stay visible.
        desired.copy(mid).addScaledVector(right, 4.25).addScaledVector(dir, 0.7);
        desired.y = 2.55;
        const radius = Math.hypot(desired.x, desired.z);
        if (radius > 4.9) {
          desired.x = (desired.x / radius) * 4.9;
          desired.z = (desired.z / radius) * 4.9;
        }
        look.copy(mid).addScaledVector(dir, 0.18);
        look.y = 1.2;
        targetFov = portrait ? 70 : 48;
        rate = 5.5;
      }
    } else if (this.state === "roundEnd") {
      if (this.p1 && this.p2) {
        const mid = new THREE.Vector3().addVectors(this.p1.root.position, this.p2.root.position).multiplyScalar(0.5);
        desired.copy(mid).add(new THREE.Vector3(-4.5, 3.2, 2.9));
        look.copy(mid).add(new THREE.Vector3(0, 1.1, 0));
      }
      targetFov = 50;
      rate = 3.4;
    } else if (this.state === "ko") {
      if (this.p1 && this.p2) {
        const winner = this.koWinner === 0 ? this.p1 : this.p2;
        const loser = this.koWinner === 0 ? this.p2 : this.p1;
        const w = winner.root.position;
        const l = loser.root.position;
        const mid = new THREE.Vector3((w.x + l.x) / 2, 0, (w.z + l.z) / 2);
        const ang = Math.atan2(w.x - l.x, w.z - l.z) + 1.0 + Math.sin(this.koTimer * 0.25) * 0.1;
        const radius = portrait ? 4.6 : 4.2;
        desired.set(mid.x + Math.sin(ang) * radius, (portrait ? 3.3 : 3.0) + Math.sin(this.koTimer * 0.35) * 0.2, mid.z + Math.cos(ang) * radius);
        look.set(mid.x, 1.0, mid.z);
      }
      targetFov = portrait ? 73 : 47;
      rate = 2.5;
    } else if (this.state === "result") {
      const angle = this.time * 0.12 + 2.3;
      desired.set(Math.sin(angle) * 4.72, 3.1, Math.cos(angle) * 4.72);
      look.set(0, 1.18, 0);
      targetFov = portrait ? 64 : 49;
      rate = 1.6;
    } else {
      desired.set(0, 3.2, 5.3);
      look.set(0, 1.2, 0);
      targetFov = portrait ? 62 : 50;
    }

    this.camera.position.lerp(desired, 1 - Math.exp(-rate * dt));
    this.camLook.lerp(look, 1 - Math.exp(-rate * 1.25 * dt));
    this.camera.fov = damp(this.camera.fov, targetFov, 2.5, dt);
    this.camera.updateProjectionMatrix();

    if (this.shake > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.11;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.08;
      this.camera.position.z += (Math.random() - 0.5) * this.shake * 0.09;
    }
    this.camera.lookAt(this.camLook);

    if (this.arena.fill) {
      this.arena.fill.position.copy(this.camera.position);
      this.arena.fill.position.y += 1.4;
      this.arena.fill.position.lerp(this.camLook, 0.18);
    }
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
