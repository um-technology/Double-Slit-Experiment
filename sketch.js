const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

const Nx = 220;
const Ny = 220;

let field = new Float32Array(Nx * Ny);
let field2 = new Float32Array(Nx * Ny);
let vel = new Float32Array(Nx * Ny);

// ------------------------------------
// Physics parameters
// ------------------------------------
const damping = 0.999;
const speed = 0.32;

// slit geometry
const sourceY = Math.floor(Ny * 0.78);
const slitY = Math.floor(Ny * 0.5);
const slitSep = 26;
const slitWidth = 6;

// absorption border
const absorbWidth = 18;

// time
let t = 0;

// ------------------------------------
function idx(x, y) {
  return x + y * Nx;
}

// ------------------------------------
// Absorbing boundary
// ------------------------------------
function absorbFactor(x, y) {
  const dx = Math.min(x, Nx - 1 - x);
  const dy = Math.min(y, Ny - 1 - y);
  const d = Math.min(dx, dy);

  if (d > absorbWidth) return 1.0;

  const k = d / absorbWidth;
  return Math.exp(-6 * (1 - k) * (1 - k));
}

// ------------------------------------
// Double slit wall
// ------------------------------------
function isBarrier(x, y) {
  if (Math.abs(y - slitY) > 1) return false;

  if (Math.abs(x - (Nx / 2 - slitSep)) < slitWidth) return false;
  if (Math.abs(x - (Nx / 2 + slitSep)) < slitWidth) return false;

  return true;
}

// ------------------------------------
// Simulation step
// ------------------------------------
function step() {
  for (let y = 1; y < Ny - 1; y++) {
    for (let x = 1; x < Nx - 1; x++) {

      if (isBarrier(x, y)) {
        field[idx(x, y)] = 0;
        continue;
      }

      const i = idx(x, y);

      const lap =
        field[idx(x - 1, y)] +
        field[idx(x + 1, y)] +
        field[idx(x, y - 1)] +
        field[idx(x, y + 1)] -
        4 * field[i];

      vel[i] += lap * speed;
      vel[i] *= damping;

      field2[i] = field[i] + vel[i];

      // absorb edges
      field2[i] *= absorbFactor(x, y);
    }
  }

  [field, field2] = [field2, field];
}

// ------------------------------------
// Source injection (smooth plane wave)
// ------------------------------------
function source() {
  const amp = Math.sin(t * 0.25) * 0.8;
  for (let x = 0; x < Nx; x++) {
    field[idx(x, sourceY)] += amp;
  }
}

// ------------------------------------
// Color mapping (cinematic)
// ------------------------------------
function colorMap(v) {
  v = Math.abs(v);

  // contrast shaping
  v = Math.min(1, v * 1.8);
  v = Math.pow(v, 0.45);

  const r = Math.min(255, 40 + 220 * v);
  const g = Math.min(255, 60 + 150 * v);
  const b = Math.min(255, 120 + 200 * v);

  return [r, g, b];
}

// ------------------------------------
// Rendering
// ------------------------------------
const img = ctx.createImageData(W, H);
const sx = W / Nx;
const sy = H / Ny;

function render() {
  step();
  source();
  t++;

  for (let y = 0; y < Ny; y++) {
    for (let x = 0; x < Nx; x++) {

      const v = field[idx(x, y)];
      const [r, g, b] = colorMap(v);

      const baseX = Math.floor(x * sx);
      const baseY = Math.floor(y * sy);

      for (let py = 0; py < sy; py++) {
        for (let px = 0; px < sx; px++) {
          const i = ((baseY + py) * W + (baseX + px)) * 4;
          img.data[i]     = r;
          img.data[i + 1] = g;
          img.data[i + 2] = b;
          img.data[i + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  requestAnimationFrame(render);
}

render();

