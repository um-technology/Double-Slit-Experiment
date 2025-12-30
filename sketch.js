const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

const Nx = 220;
const Ny = 220;

let field = new Float32Array(Nx * Ny);
let field2 = new Float32Array(Nx * Ny);
let vel = new Float32Array(Nx * Ny);

let running = true;
let measured = false;

let speed = 0.32;
let damping = 0.999;
let slitWidth = 6;
let slitSep = 26;

const sourceY = Math.floor(Ny * 0.78);
const slitY = Math.floor(Ny * 0.5);

let t = 0;

// ------------------ UI ------------------
document.getElementById("speed").oninput = e => speed = +e.target.value;
document.getElementById("damping").oninput = e => damping = +e.target.value;
document.getElementById("slitWidth").oninput = e => slitWidth = +e.target.value;
document.getElementById("slitSep").oninput = e => slitSep = +e.target.value;

document.getElementById("pauseBtn").onclick = () => {
  running = !running;
  document.getElementById("pauseBtn").innerText = running ? "Pause" : "Play";
};

document.getElementById("resetBtn").onclick = reset;
document.getElementById("measureBtn").onclick = () => measured = true;

let palette = "inferno";
document.getElementById("palette").onchange = e => palette = e.target.value;

// ------------------ Helpers ------------------
function idx(x, y) {
  return x + y * Nx;
}

function isBarrier(x, y) {
  if (Math.abs(y - slitY) > 1) return false;

  if (Math.abs(x - (Nx / 2 - slitSep)) < slitWidth) return false;
  if (Math.abs(x - (Nx / 2 + slitSep)) < slitWidth) return false;

  return true;
}

// ------------------ Physics ------------------
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

  [field, field2] = [field2, field];
}

function source() {
  if (measured) return;
  for (let x = 0; x < Nx; x++) {
    field[idx(x, sourceY)] += Math.sin(t * 0.25) * 0.8;
  }
}

// ------------------ Measurement collapse ------------------
function collapse() {
  for (let i = 0; i < field.length; i++) {
    field[i] = Math.random() < Math.abs(field[i]) * 0.5 ? field[i] : 0;
  }
}

// ------------------ Color mapping ------------------
function colormap(v) {
  v = Math.abs(v);
  v = Math.min(1, v * 1.4);
  v = Math.pow(v, 0.45);

  if (palette === "plasma")
    return [255 * v, 120 + 100 * v, 255 * (1 - v)];

  if (palette === "blue")
    return [50 * v, 120 * v, 255];

  if (palette === "classic")
    return [255 * v, 255 * v, 255 * v];

  // inferno
  return [
    40 + 215 * v,
    30 + 120 * v,
    80 + 180 * v
  ];
}

// ------------------ Render ------------------
function render() {
  if (running) {
    step();
    source();
    t++;
  }

  if (measured) collapse();

  const img = ctx.createImageData(W, H);
  const sx = W / Nx;
  const sy = H / Ny;

  for (let y = 0; y < Ny; y++) {
    for (let x = 0; x < Nx; x++) {
      const v = field[idx(x, y)];
      const [r, g, b] = colormap(v);

      for (let py = 0; py < sy; py++) {
        for (let px = 0; px < sx; px++) {
          const X = (x * sx + px) | 0;
          const Y = (y * sy + py) | 0;
          const i = (Y * W + X) * 4;

          img.data[i] = r;
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

// ------------------ Reset ------------------
function reset() {
  field.fill(0);
  field2.fill(0);
  vel.fill(0);
  measured = false;
}

// Start
render();


