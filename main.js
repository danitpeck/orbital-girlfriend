const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// --- Input ---
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

// --- Game state ---
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 16,
  speed: 260,
  color: "#4fc3f7",
};

const orb = {
  angle: 0,
  radius: 50,
  size: 8,
  speed: 3, // radians per second
  color: "#ffeb3b",
  x: 0,
  y: 0,
};

const enemies = [];
const ENEMY_RADIUS = 14;
const ENEMY_SPEED = 80;
const SPAWN_INTERVAL = 1.2; // seconds
let spawnTimer = 0;

// --- Helpers ---
function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function spawnEnemy() {
  // Spawn at a random position along the screen edge
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = Math.random() * canvas.width; y = -ENEMY_RADIUS; }
  else if (side === 1) { x = canvas.width + ENEMY_RADIUS; y = Math.random() * canvas.height; }
  else if (side === 2) { x = Math.random() * canvas.width; y = canvas.height + ENEMY_RADIUS; }
  else { x = -ENEMY_RADIUS; y = Math.random() * canvas.height; }

  enemies.push({ x, y, radius: ENEMY_RADIUS, color: "#ef5350" });
}

// --- Update ---
function update(dt) {
  // Player movement
  let dx = 0;
  let dy = 0;
  if (keys["w"]) dy -= 1;
  if (keys["s"]) dy += 1;
  if (keys["a"]) dx -= 1;
  if (keys["d"]) dx += 1;

  // Normalize diagonal movement
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }

  player.x += dx * player.speed * dt;
  player.y += dy * player.speed * dt;

  // Clamp to canvas bounds
  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

  // Orb rotation
  orb.angle += orb.speed * dt;
  orb.x = player.x + Math.cos(orb.angle) * orb.radius;
  orb.y = player.y + Math.sin(orb.angle) * orb.radius;

  // Enemy spawning
  spawnTimer += dt;
  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnTimer -= SPAWN_INTERVAL;
    spawnEnemy();
  }

  // Enemy movement + collision
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    // Move toward player
    const edx = player.x - e.x;
    const edy = player.y - e.y;
    const elen = Math.sqrt(edx * edx + edy * edy);
    if (elen > 0) {
      e.x += (edx / elen) * ENEMY_SPEED * dt;
      e.y += (edy / elen) * ENEMY_SPEED * dt;
    }

    // Check orb hit
    if (dist(orb, e) < orb.size + e.radius) {
      enemies.splice(i, 1);
    }
  }
}

// --- Draw ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Enemies
  for (const e of enemies) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fillStyle = e.color;
    ctx.fill();
  }

  // Player
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();

  // Orb
  ctx.beginPath();
  ctx.arc(orb.x, orb.y, orb.size, 0, Math.PI * 2);
  ctx.fillStyle = orb.color;
  ctx.fill();
}

// --- Game loop ---
let lastTime = 0;

function loop(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.1); // cap dt to avoid spiral of death
  lastTime = time;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame((time) => {
  lastTime = time;
  requestAnimationFrame(loop);
});
