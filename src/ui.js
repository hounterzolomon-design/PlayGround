const SILHOUETTE = `
<svg viewBox="0 0 120 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M60 9c-8 0-14 6-14 14 0 6 3 11 7 13-7 2-13 6-18 12l-8 11-5 29 11 5 6-20 4 38 6 71h9l6-62 6 62h9l6-71 4-38 6 20 11-5-5-29-8-11c-5-6-11-10-18-12 4-2 7-7 7-13 0-8-6-14-14-14Z"/>
</svg>`;

export class GameUI {
  constructor() {
    this.el = {
      loading: document.getElementById("loading"),
      menu: document.getElementById("screen-menu"),
      select: document.getElementById("screen-select"),
      hud: document.getElementById("hud"),
      result: document.getElementById("result"),
      howto: document.getElementById("howto"),
      pause: document.getElementById("pause"),
      roundCard: document.getElementById("round-card"),
      roundKicker: document.getElementById("round-kicker"),
      roundBig: document.getElementById("round-big"),
      roundMessage: document.getElementById("round-message"),
      announce: document.getElementById("announce"),
      announceMain: document.getElementById("announce-main"),
      announceSub: document.getElementById("announce-sub"),
      callout: document.getElementById("callout"),
      calloutText: document.getElementById("callout-text"),
      calloutBonus: document.getElementById("callout-bonus"),
      damageLayer: document.getElementById("damage-layer"),
      touch: document.getElementById("touch-controls"),
      sound: document.getElementById("sound-toggle"),
      cards: document.getElementById("fighter-cards"),
      status: document.getElementById("fight-status"),
      statusText: document.getElementById("fight-status-text"),
      combo: document.getElementById("combo-wrap"),
      comboNum: document.getElementById("combo-num"),
      timer: document.getElementById("timer"),
      roundLabel: document.getElementById("round-label"),
      stance: document.getElementById("stance-label"),
      staminaLabel: document.getElementById("stamina-label"),
      resultTitle: document.getElementById("result-title"),
      resultMethod: document.getElementById("result-method"),
      resultTime: document.getElementById("result-time"),
      resultWinner: document.getElementById("result-winner"),
      resultLoser: document.getElementById("result-loser"),
      resultStats: document.getElementById("result-stats"),
      resultEvent: document.getElementById("result-event"),
    };
    this.fighterConfigs = [];
    this.rivalConfig = null;
    this.flash = document.createElement("div");
    this.flash.className = "screen-flash";
    document.getElementById("app").appendChild(this.flash);
    this.statusUntil = 0;
    this.statusDefault = "";
    this.lastStatus = "";
    this.lastRound = -1;
    this.ghostHealth = [1, 1];
    this._buildCards();
  }

  _buildCards() {
    this.el.cards.innerHTML = "";
  }

  buildFighterCards(fighters) {
    this.fighterConfigs = fighters;
    this.el.cards.innerHTML = fighters
      .map(
        (f, index) => `
      <button class="fighter-card" role="option" aria-selected="${index === 0}" data-fighter="${index}"
        style="--accent:${f.accentCss}; --accent-soft:${f.accentSoft}; --accent-deep:${f.accentDeep}">
        <div class="card-bg"></div>
        <div class="card-lines"></div>
        <span class="card-num">0${index + 1}</span>
        <span class="card-flag">${f.flag}</span>
        <div class="silhouette">${SILHOUETTE}</div>
        <div class="card-info">
          <small>${f.style}</small>
          <strong>${f.last}</strong>
          <span>${f.nick}</span>
          <div class="card-statline">
            <i style="--v:${f.stats.striking / 100}"></i>
            <i style="--v:${f.stats.power / 100}"></i>
            <i style="--v:${f.stats.speed / 100}"></i>
          </div>
        </div>
      </button>`,
      )
      .join("");
  }

  selectCard(index, fighter, rival) {
    [...this.el.cards.children].forEach((card, i) => {
      card.classList.toggle("is-selected", i === index);
      card.setAttribute("aria-selected", String(i === index));
    });
    const set = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    };
    set("selected-name", `${fighter.first}\n${fighter.last}`);
    document.getElementById("selected-name").innerHTML = `${fighter.first}<br>${fighter.last}`;
    set("selected-nickname", `“${fighter.nick}”`);
    set("selected-record", `${fighter.record} · ${fighter.height} · ${fighter.weight}`);
    document.getElementById("rival-name").innerHTML = `${rival.first}<br>${rival.last}`;
    set("rival-nickname", `“${rival.nick}”`);
    set("rival-record", `${rival.record} · ${rival.height} · ${rival.weight}`);
    set("select-opponent-name", rival.full);

    const stats = [
      ["striking", fighter.stats.striking],
      ["power", fighter.stats.power],
      ["speed", fighter.stats.speed],
      ["grapple", fighter.stats.grappling],
    ];
    for (const [name, value] of stats) {
      const bar = document.getElementById(`stat-${name}`);
      const num = document.getElementById(`stat-${name}-num`);
      if (bar) bar.style.transform = `scaleX(${value / 100})`;
      if (num) num.textContent = value;
    }
  }

  setFighters(p1, p2) {
    this.p1 = p1;
    this.p2 = p2;
    document.getElementById("hud-p1-name").textContent = p1.full;
    document.getElementById("hud-p1-nick").textContent = p1.nick;
    document.getElementById("hud-p1-record").textContent = p1.record.split("-").slice(0, 2).join("-");
    document.getElementById("hud-p2-name").textContent = p2.full;
    document.getElementById("hud-p2-nick").textContent = p2.nick;
    document.getElementById("hud-p2-record").textContent = p2.record.split("-").slice(0, 2).join("-");
    this.el.stance.textContent = p1.stance;
  }

  showScreen(name) {
    this.el.menu.classList.toggle("is-active", name === "menu");
    this.el.select.classList.toggle("is-active", name === "select");
    this.el.hud.classList.toggle("is-active", name === "fight");
    this.el.result.classList.toggle("is-active", name === "result");
    document.getElementById("app").classList.toggle("fight-live", name === "fight");
    this.el.touch.setAttribute("aria-hidden", name === "fight" ? "false" : "true");
  }

  hideLoading() {
    this.el.loading.classList.add("done");
  }

  setSound(enabled) {
    this.el.sound.classList.toggle("is-off", !enabled);
    this.el.sound.setAttribute("aria-pressed", String(enabled));
  }

  openModal(id) {
    document.getElementById(id)?.classList.add("is-open");
  }

  closeModal(id) {
    document.getElementById(id)?.classList.remove("is-open");
  }

  closeAllModals() {
    document.querySelectorAll(".modal").forEach((modal) => modal.classList.remove("is-open"));
  }

  resetForRound(round, time) {
    this.el.timer.textContent = this.formatTime(time);
    this.el.timer.classList.remove("is-low");
    this.el.roundLabel.textContent = `ROUND ${round}`;
    this.statusDefault = "";
    this._setStatus("", false);
    this.lastRound = round;
  }

  formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  updateHud(match, p1, p2) {
    if (!match) return;
    const hp = match.health;
    const stamina = match.stamina;
    this._bar("hud-p1-health", hp[0] / 100);
    this._bar("hud-p2-health", hp[1] / 100);
    // Lagging "ghost" bars make recent damage easy to read during a exchange.
    for (let i = 0; i < 2; i++) {
      const target = hp[i] / 100;
      this.ghostHealth[i] = Math.min(1, Math.max(target, this.ghostHealth[i] + (target - this.ghostHealth[i]) * 0.14));
    }
    this._bar("hud-p1-ghost", this.ghostHealth[0]);
    this._bar("hud-p2-ghost", this.ghostHealth[1]);
    this._bar("hud-p1-stamina", stamina[0] / 100);
    this._bar("hud-p2-stamina", stamina[1] / 100);

    document.getElementById("hud-p1-stamina").parentElement.classList.toggle("low", stamina[0] < 22);
    document.getElementById("hud-p2-stamina").parentElement.classList.toggle("low", stamina[1] < 22);

    this.el.timer.textContent = this.formatTime(match.roundTime);
    this.el.timer.classList.toggle("is-low", match.roundTime <= 10);
    this.el.roundLabel.textContent = `ROUND ${match.round}`;
    this.el.staminaLabel.textContent = String(Math.round(stamina[0]));

    for (let i = 0; i < 3; i++) {
      const p1El = document.getElementById("pips-p1").children[i];
      const p2El = document.getElementById("pips-p2").children[i];
      if (p1El) p1El.classList.toggle("won", i < match.roundWins[0]);
      if (p2El) p2El.classList.toggle("won", i < match.roundWins[1]);
    }

    const combo = match.combo[0];
    if (combo >= 2 && match.comboTimer[0] > 0) {
      this.el.combo.classList.add("show");
      this.el.comboNum.textContent = String(combo);
    } else {
      this.el.combo.classList.remove("show");
    }

    if (this.statusDefault) this._setStatus(this.statusDefault, false);
  }

  _bar(id, value) {
    const el = document.getElementById(id);
    if (el) el.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`;
  }

  setStatus(text, duration = 0) {
    this.statusDefault = text;
    this._setStatus(text, false);
    this.statusUntil = 0;
    if (duration) {
      this.statusUntil = performance.now() + duration * 1000;
    }
  }

  flashStatus(text, duration = 1.5) {
    this._setStatus(text, true);
    this.statusUntil = performance.now() + duration * 1000;
    this.statusDefault = "";
  }

  _setStatus(text, override) {
    if (!text) {
      this.el.status.style.opacity = "0";
      return;
    }
    if (this.lastStatus !== text) {
      this.el.statusText.textContent = text;
      this.lastStatus = text;
    }
    this.el.status.style.opacity = "1";
  }

  tickStatus() {
    if (this.statusUntil && performance.now() > this.statusUntil) {
      this.statusUntil = 0;
      this._setStatus(this.statusDefault || "", false);
    }
  }

  showRoundCard(kicker, big, message) {
    this.el.roundKicker.textContent = kicker;
    this.el.roundBig.textContent = big;
    this.el.roundMessage.textContent = message;
    this.el.roundCard.classList.remove("show");
    void this.el.roundCard.offsetWidth;
    this.el.roundCard.classList.add("show");
  }

  showAnnounce(main, sub) {
    this.el.announceMain.textContent = main;
    this.el.announceSub.textContent = sub;
    this.el.announce.classList.remove("show");
    void this.el.announce.offsetWidth;
    this.el.announce.classList.add("show");
  }

  showCallout(text, bonus) {
    this.el.calloutText.textContent = text;
    this.el.calloutBonus.textContent = bonus || "";
    this.el.callout.classList.remove("show");
    void this.el.callout.offsetWidth;
    this.el.callout.classList.add("show");
  }

  damageNumber(x, y, amount, type = "") {
    const node = document.createElement("div");
    node.className = `damage-number ${type}`;
    node.textContent = amount;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    this.el.damageLayer.appendChild(node);
    window.setTimeout(() => node.remove(), 900);
  }

  flashScreen(strength = 1) {
    this.flash.classList.remove("show");
    void this.flash.offsetWidth;
    this.flash.style.setProperty("--strength", String(Math.min(1, strength)));
    this.flash.classList.add("show");
  }

  showResult(data) {
    this.el.resultTitle.textContent = data.title;
    this.el.resultTitle.classList.toggle("loss", !data.playerWon);
    this.el.resultMethod.textContent = data.method;
    this.el.resultTime.textContent = data.detail;
    this.el.resultWinner.innerHTML = `<small>WINNER</small><strong>${data.winner.full}</strong><span>${data.winner.nick}</span>`;
    this.el.resultLoser.innerHTML = `<small>DEFEATED</small><strong>${data.loser.full}</strong><span>${data.loser.nick}</span>`;
    this.el.resultStats.innerHTML = data.stats
      .map(
        (stat) => `<div class="result-stat"><b>${stat.value}</b><span>${stat.label}</span></div>`,
      )
      .join("");
    this.el.resultEvent.textContent = `FIGHT NIGHT 07 · ${data.playerWon ? "VICTORY" : "DEFEAT"}`;
    this.showScreen("result");
  }

  hideResult() {
    this.el.result.classList.remove("is-active");
  }

}
