const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

const Nx = 220;
const Ny = 220;

let field = new Float32Array(Nx * Ny);
let field2 = new Float32Array(Nx * Ny);
let vel = new Float32Array(Nx * Ny);

// physical params
const damping = 0.999;
const speed = 0.32;

// source
const sourceY = Math.floor(Ny * 0.75);
const slitY = Math.floor(Ny * 0.5);
const slitSep = 26;
const slitWidth = 6;

// time
let t = 0;

// -----------------------------------
// Utility
// -----------------------------------
function idx(x, y) {
  return x + y * Nx;
}

// -----------------------------------
// Draw barrier with slits
// -----------------------------------
function isBarrier(x, y) {
  if (Math.abs(y - slitY) > 1) return false;

  if (Math.abs(x - (Nx / 2 - slitSep)) < slitWidth) return false;
  if (Math.abs(x - (Nx / 2 + slitSep)) < slitWidth) return false;

  return true;
}

// -----------------------------------
// Simulation step
// -----------------------------------
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
    }
  }

  // swap buffers
  [field, field2] = [field2, field];
}

// -----------------------------------
// Source injection (plane wave)
// -----------------------------------
function source() {
  for (let x = 0; x < Nx; x++) {
    field[idx(x, sourceY)] += Math.sin(t * 0.25) * 0.9;
  }
}

// -----------------------------------
// Color mapping (professional glow)
// -----------------------------------
function colorMap(v) {
  v = Math.abs(v);
  v = Math.min(1, v * 1.6);

  // cinematic curve
  v = Math.pow(v, 0.45);

  const r = Math.min(255, 40 + v * 240);
  const g = Math.min(255, 30 + v * 140);
  const b = Math.min(255, 80 + v * 255);

  return [r, g, b];
}

// -----------------------------------
// Render
// -----------------------------------
function render() {
  step();
  source();
  t++;

  const img = ctx.createImageData(W, H);
  const sx = W / Nx;
  const sy = H / Ny;

  for (let y = 0; y < Ny; y++) {
    for (let x = 0; x < Nx; x++) {
      const v = field[idx(x, y)];
      const [r, g, b] = colorMap(v);

      for (let py = 0; py < sy; py++) {
        for (let px = 0; px < sx; px++) {
          const X = Math.floor(x * sx + px);
          const Y = Math.floor(y * sy + py);
          const i = (Y * W + X) * 4;

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



