let canvasSize = 600;
let slits = [];
let particles = [];
let numParticles = 4000;
let slitWidth = 10;
let slitSep = 60;

function setup() {
  createCanvas(canvasSize, canvasSize);
  noStroke();

  // Define slits
  let centerX = width/2;
  slits.push(centerX - slitSep/2);
  slits.push(centerX + slitSep/2);

  // Initialize particles at top
  for (let i=0; i<numParticles; i++){
    let x = random(width);
    let y = 0;
    let vx = 0;
    let vy = random(1,2);
    particles.push({x,y,vx,vy});
  }
}

function draw() {
  background(17,17,17,40); // semi-transparent for cinematic trail

  fill(255,100,0, 80);

  for (let p of particles){
    // move particle
    p.x += p.vx;
    p.y += p.vy;

    // simulate double-slit diffraction
    if (p.y > height/3 && p.y < height/3 + 5){
      let passed = false;
      for (let s of slits){
        if (abs(p.x - s) < slitWidth){
          p.vx = random(-0.5,0.5);
          passed = true;
        }
      }
      if (!passed){
        p.vx = 0;
        p.vy = 0; // blocked by barrier
      }
    }

    // draw particle
    ellipse(p.x, p.y, 2, 2);

    // reset if out of screen
    if (p.y > height){
      p.y = 0;
      p.x = random(width);
      p.vx = 0;
      p.vy = random(1,2);
    }
  }

  // draw barrier
  fill(255);
  rect(0, height/3, width, 5);
  for (let s of slits){
    fill(17); // cutout for slits
    rect(s - slitWidth, height/3, slitWidth*2, 5);
  }
}
