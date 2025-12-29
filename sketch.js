const Nx = 512;
const Ny = 512;
const Lx = 10.0;
const Ly = 10.0;
const dt = 0.002;
const hbar = 1.0;
const m = 1.0;

const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");
const imageData = ctx.createImageData(Nx, Ny);

const x = new Float32Array(Nx);
const y = new Float32Array(Ny);
for (let i=0; i<Nx; i++) x[i] = -Lx/2 + i*Lx/Nx;
for (let i=0; i<Ny; i++) y[i] = -Ly/2 + i*Ly/Ny;

// Potential: double slit
const V = new Float32Array(Nx*Ny);
const barrier_y = 0.0;
const thickness = 0.2;
const slit_sep = 1.5;
const slit_width = 0.3;

for (let i=0;i<Ny;i++){
  for (let j=0;j<Nx;j++){
    if (Math.abs(y[i]-barrier_y)<thickness){
      if (!(Math.abs(x[j]-slit_sep/2)<slit_width || Math.abs(x[j]+slit_sep/2)<slit_width)){
        V[i*Nx+j] = 1e4;
      }
    }
  }
}

// Initial Gaussian wavepacket
const kx = 0.0, ky = 15.0;
const sigma = 0.35;

// Complex wavefunction arrays
const psiRe = new Float32Array(Nx*Ny);
const psiIm = new Float32Array(Nx*Ny);

for (let i=0;i<Ny;i++){
  for (let j=0;j<Nx;j++){
    const idx = i*Nx+j;
    const g = Math.exp(-((x[j]**2 + (y[i]+3)**2)/(2*sigma**2)));
    psiRe[idx] = g * Math.cos(kx*x[j] + ky*y[i]);
    psiIm[idx] = g * Math.sin(kx*x[j] + ky*y[i]);
  }
}

// FFT precompute
const FFT = fftjs.FFT;
const fft = new FFT(Nx);
const fftRowRe = new Float32Array(Nx);
const fftRowIm = new Float32Array(Nx);
const kVals = new Float32Array(Nx);
for(let i=0;i<Nx;i++){
  kVals[i] = 2*Math.PI*(i<Nx/2 ? i/Nx : (i-Nx)/Nx)/ (Lx/Nx);
}

// Absorbing boundary
const absorb = new Float32Array(Nx*Ny).fill(1);
const edge = Math.floor(0.08*Nx);
for(let i=0;i<Ny;i++){
  for(let j=0;j<Nx;j++){
    const di = Math.min(i, Ny-i-1);
    const dj = Math.min(j, Nx-j-1);
    const d = Math.min(di,dj);
    if(d<edge) absorb[i*Nx+j] = Math.exp(-((edge-d)/edge)**2 * 4);
  }
}

// Split-step evolution
function evolve(){
  // Potential half-step
  for(let i=0;i<Nx*Ny;i++){
    const theta = -V[i]*dt/(2*hbar);
    const re = psiRe[i], im = psiIm[i];
    psiRe[i] = re*Math.cos(theta)-im*Math.sin(theta);
    psiIm[i] = re*Math.sin(theta)+im*Math.cos(theta);
  }

  // Kinetic full-step (row-wise FFT)
  for(let i=0;i<Ny;i++){
    for(let j=0;j<Nx;j++){
      fftRowRe[j] = psiRe[i*Nx+j];
      fftRowIm[j] = psiIm[i*Nx+j];
    }
    fft.transform(fftRowRe, fftRowIm);
    for(let j=0;j<Nx;j++){
      const k2 = kVals[j]**2; // 1D approx
      const phase = -hbar*k2*dt/(2*m);
      const re = fftRowRe[j], im = fftRowIm[j];
      fftRowRe[j] = re*Math.cos(phase)-im*Math.sin(phase);
      fftRowIm[j] = re*Math.sin(phase)+im*Math.cos(phase);
    }
    fft.inverseTransform(fftRowRe, fftRowIm);
    for(let j=0;j<Nx;j++){
      psiRe[i*Nx+j] = fftRowRe[j]/Nx;
      psiIm[i*Nx+j] = fftRowIm[j]/Nx;
    }
  }

  // Potential half-step & absorb
  for(let i=0;i<Nx*Ny;i++){
    const theta = -V[i]*dt/(2*hbar);
    const re = psiRe[i], im = psiIm[i];
    psiRe[i] = (re*Math.cos(theta)-im*Math.sin(theta))*absorb[i];
    psiIm[i] = (re*Math.sin(theta)+im*Math.cos(theta))*absorb[i];
  }
}

// Render function
function render(){
  evolve();
  for(let i=0;i<Ny;i++){
    for(let j=0;j<Nx;j++){
      const idx = i*Nx+j;
      const p = Math.sqrt(psiRe[idx]**2 + psiIm[idx]**2)**1.3; // glow
      const c = Math.min(255, Math.floor(p*500));
      const pix = (i*Nx+j)*4;
      imageData.data[pix] = c;
      imageData.data[pix+1] = Math.floor(c*0.2);
      imageData.data[pix+2] = 0;
      imageData.data[pix+3] = 255;
    }
  }
  ctx.putImageData(imageData,0,0);
  requestAnimationFrame(render);
}

render();
