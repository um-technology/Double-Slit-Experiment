const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const W = 700;
const H = 700;
canvas.width = W;
canvas.height = H;

// ========================
// Slit configuration
// ========================
const slitY = H * 0.45;
const slitGap = 100;
const slitWidth = 16;

// Wave parameters
let time = 0;
const k = 0.15;
const speed = 0.15;

// Precompute pixel list
const pixels = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    pixels.push({ x, y });
  }
}

// ========================
// Wave function
// ========================
function wave(x, y, sx, sy, k, t) {
  const dx = x - sx;
  const dy = y - sy;
  const r = Math.sqrt(dx * dx + dy * dy);
  return Math.sin(k * r - t) / (1 + 0.015 * r);
}

// ========================
// Render loop
// ========================
function render() {
  const img = ctx.createImageData(W, H);
  const data = img.data;

  time += speed;

  for (let i = 0; i < pixels.length; i++) {
    const { x, y } = pixels[i];
    const idx = i * 4;

    // Barrier
    if (
      Math.abs(y - slitY) < 5 &&
      !(
        Math.abs(x - W / 2 - slitGap / 2) < slitWidth ||
        Math.abs(x - W / 2 + slitGap / 2) < slitWidth
      )
    ) {
      data[idx] = 40;
      data[idx + 1] = 40;
      data[idx + 2] = 40;
      data[idx + 3] = 255;
      continue;
    }

    // Two coherent wave sources
    let v = 0;
    v += wave(x, y, W / 2 - slitGap / 2, slitY, k, time);
    v += wave(x, y, W / 2 + slitGap / 2, slitY, k, time);

    v = Math.abs(v);
    v = Math.pow(v, 1.25);

    const glow = Math.min(255, v * 255);

    data[idx]     = glow;
    data[idx + 1] = glow * 0.4;
    data[idx + 2] = 0;
    data[idx + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
  requestAnimationFrame(render);
}

render();


