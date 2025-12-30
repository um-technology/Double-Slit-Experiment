const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 600;

const W = canvas.width;
const H = canvas.height;

const NX = 240;
const NY = 180;

let u = new Float32Array(NX * NY);
let uPrev = new Float32Array(NX * NY);
let uNext = new Float32Array(NX * NY);

const damping = 0.999;
const speed = 0.25;

function idx(x, y) {
  return x + y * NX;
}

// Double slit barrier
function isWall(x, y) {
  const slitY = Math.floor(NY / 2);
  const slitSep = 18;
  const slitWidth = 6;

  if (Math.abs(y - slitY) > 1) return false;

  if (Math.abs(x - (NX / 2 - slitSep)) < slitWidth) return false;
  if (Math.abs(x - (NX / 2 + slitSep)) < slitWidth) return false;

  return true;
}

function step() {
  for (let y = 1; y < NY - 1; y++) {
    for (let x = 1; x < NX - 1; x++) {

      if (isWall(x, y)) {
        u[idx(x, y)] = 0;
        continue;
      }

      const i = idx(x, y);

      const lap =
        u[idx(x - 1, y)] +
        u[idx(x + 1, y)] +
        u[idx(x, y - 1)] +
        u[idx(x, y + 1)] -
        4 * u[i];

      uNext[i] = (2 * u[i] - uPrev[i]) + speed * lap;
      uNext[i] *= damping;
    }
  }

  [uPrev, u, uNext] = [u, uNext, uPrev];
}

let t = 0;

function source() {
  const y = Math.floor(NY * 0.8);
  for (let x = 0; x < NX; x++) {
    u[idx(x, y)] += Math.sin(t * 0.15) * 0.6;
  }
}

function draw() {
  const img = ctx.createImageData(W, H);
  const sx = W / NX;
  const sy = H / NY;

  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      const v = Math.abs(u[idx(x, y)]);
      const c = Math.min(255, v * 255 * 1.5);

      for (let py = 0; py < sy; py++) {
        for (let px = 0; px < sx; px++) {
          const X = (x * sx + px) | 0;
          const Y = (y * sy + py) | 0;
          const i = (Y * W + X) * 4;

          img.data[i] = c;
          img.data[i + 1] = 80;
          img.data[i + 2] = 200;
          img.data[i + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0);
}

function loop() {
  step();
  source();
  draw();
  requestAnimationFrame(loop);
}

loop();



