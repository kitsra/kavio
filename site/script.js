const canvas = document.querySelector("#hero-scene");
const context = canvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let width = 0;
let height = 0;
let ratio = 1;
let rafId = 0;

function resize() {
  ratio = Math.max(window.devicePixelRatio || 1, 1);
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function roundedRect(x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawFrame(timestamp) {
  const t = timestamp * 0.001;
  context.clearRect(0, 0, width, height);

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#111611");
  gradient.addColorStop(0.5, "#203123");
  gradient.addColorStop(1, "#5c2f27");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const gridSize = 48;
  context.strokeStyle = "rgba(255,255,255,0.055)";
  context.lineWidth = 1;
  for (let x = -gridSize + ((t * 14) % gridSize); x < width + gridSize; x += gridSize) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + height * 0.34, height);
    context.stroke();
  }

  const panelW = Math.min(430, width * 0.36);
  const panelH = Math.min(590, height * 0.74);
  const panelX = width - panelW - Math.max(24, width * 0.08);
  const panelY = height * 0.5 - panelH * 0.48 + Math.sin(t * 0.7) * 10;

  context.save();
  context.globalAlpha = 0.96;
  roundedRect(panelX, panelY, panelW, panelH, 18);
  context.fillStyle = "#f8f2df";
  context.fill();

  roundedRect(panelX + 22, panelY + 22, panelW - 44, panelH * 0.66, 12);
  const mediaGradient = context.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
  mediaGradient.addColorStop(0, "#60bfd0");
  mediaGradient.addColorStop(0.45, "#476447");
  mediaGradient.addColorStop(1, "#db614d");
  context.fillStyle = mediaGradient;
  context.fill();

  context.fillStyle = "rgba(17,22,17,0.72)";
  roundedRect(panelX + 52, panelY + 82, panelW - 104, 106, 10);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "900 34px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("{{headline}}", panelX + panelW / 2, panelY + 146);

  const timelineTop = panelY + panelH * 0.74;
  const trackX = panelX + 34;
  const trackW = panelW - 68;
  const rows = [
    ["#60bfd0", 0.03, 0.92],
    ["#d79b36", 0.16, 0.42],
    ["#db614d", 0.58, 0.34]
  ];
  rows.forEach(([color, start, span], index) => {
    const y = timelineTop + index * 36;
    roundedRect(trackX, y, trackW, 8, 8);
    context.fillStyle = "rgba(17,22,17,0.16)";
    context.fill();
    roundedRect(trackX + trackW * start, y - 4, trackW * span, 16, 16);
    context.fillStyle = color;
    context.fill();
  });

  const playhead = trackX + ((Math.sin(t * 0.8) + 1) / 2) * trackW;
  context.strokeStyle = "#111611";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(playhead, timelineTop - 18);
  context.lineTo(playhead, timelineTop + 98);
  context.stroke();
  context.restore();

  const codeX = width * 0.58;
  const codeY = height * 0.16;
  context.save();
  context.globalAlpha = 0.38;
  context.font = "700 15px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#ffffff";
  [
    '"composition": { "fps": 30, "durationFrames": 240 }',
    '"layers": ["background-video", "headline"]',
    '"exports": ["reels", "square", "landscape"]'
  ].forEach((line, index) => {
    context.fillText(line, codeX + Math.sin(t + index) * 12, codeY + index * 28);
  });
  context.restore();

  if (!prefersReducedMotion.matches) {
    rafId = requestAnimationFrame(drawFrame);
  }
}

function start() {
  cancelAnimationFrame(rafId);
  resize();
  drawFrame(0);
  if (!prefersReducedMotion.matches) {
    rafId = requestAnimationFrame(drawFrame);
  }
}

window.addEventListener("resize", start);
prefersReducedMotion.addEventListener("change", start);
start();
