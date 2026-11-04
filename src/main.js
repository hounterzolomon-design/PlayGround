import { Game } from "./game.js";

function boot() {
  const canvas = document.getElementById("scene");
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) {
    const loading = document.getElementById("loading");
    if (loading) {
      loading.innerHTML = `
        <div class="loading-mark">OR</div>
        <div class="loading-title">OCTAGON <span>RISE</span></div>
        <p style="max-width:340px;text-align:center;font-size:12px;line-height:1.7;color:rgba(255,255,255,.55);margin-top:18px">
          This fight needs WebGL. Enable hardware acceleration or try a current version of Chrome, Safari, or Firefox.
        </p>`;
    }
    return;
  }
  try {
    new Game();
  } catch (error) {
    console.error("Octagon Rise failed to start", error);
    const loading = document.getElementById("loading");
    if (loading) {
      loading.innerHTML = `
        <div class="loading-mark">!</div>
        <div class="loading-title">CARD <span>CANCELLED</span></div>
        <p style="max-width:360px;text-align:center;font-size:12px;line-height:1.7;color:rgba(255,255,255,.55);margin-top:18px">
          The 3D engine could not start. Reload the page to try again.
        </p>`;
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
