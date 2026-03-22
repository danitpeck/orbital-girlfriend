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
  hp: 3,
  maxHp: 3,
  iframes: 0, // seconds of invincibility remaining
  iframeDuration: 1.0,
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
const BASE_ENEMY_SPEED = 80;
const BASE_SPAWN_INTERVAL = 1.2; // seconds
let spawnTimer = 0;
let runTime = 0; // seconds since run started

let score = 0;
let gameOver = false;
let shopping = false; // true = showing the shop after game over
let titleScreen = true; // start on title
let titleOrb = { angle: 0 }; // decorative orb for title screen

// --- Meta-progression (persists between runs) ---
const SAVE_KEY = "orbital-girlfriend-save";

function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || defaultMeta();
  } catch { return defaultMeta(); }
}

function defaultMeta() {
  return { lovePoints: 0, bonusHp: 0, bonusSpeed: 0, bonusOrbSpeed: 0, bonusOrbitRadius: 0 };
}

function saveMeta() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(meta));
}

const meta = loadMeta();

const META_UPGRADES = [
  {
    name: () => `starting hp + (${meta.bonusHp})`,
    cost: () => 10 + meta.bonusHp * 15,
    apply: () => { meta.bonusHp++; },
  },
  {
    name: () => `starting speed + (${meta.bonusSpeed})`,
    cost: () => 8 + meta.bonusSpeed * 12,
    apply: () => { meta.bonusSpeed++; },
  },
  {
    name: () => `orb speed + (${meta.bonusOrbSpeed})`,
    cost: () => 8 + meta.bonusOrbSpeed * 12,
    apply: () => { meta.bonusOrbSpeed++; },
  },
  {
    name: () => `orbit radius + (${meta.bonusOrbitRadius})`,
    cost: () => 10 + meta.bonusOrbitRadius * 14,
    apply: () => { meta.bonusOrbitRadius++; },
  },
];

// --- Leveling ---
let xp = 0;
let level = 1;
let xpToNext = 5; // kills needed for first level up
const XP_SCALE = 1.4; // each level needs 40% more xp

let pickingUpgrade = false;
let upgradeChoices = [];

const UPGRADES = [
  { name: "orb speed +",    apply: () => { orb.speed += 0.8; } },
  { name: "orb size +",     apply: () => { orb.size += 3; } },
  { name: "orbit radius +", apply: () => { orb.radius += 15; } },
  { name: "player speed +", apply: () => { player.speed += 40; } },
  { name: "max hp +1",      apply: () => { player.maxHp++; player.hp++; } },
];

// --- Helpers ---
function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// --- Particles ---
const particles = [];

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 140;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + Math.random() * 3,
      color,
      life: 0.3 + Math.random() * 0.3,
      maxLife: 0.3 + Math.random() * 0.3,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- Screen shake ---
let shakeTimer = 0;
let shakeIntensity = 0;

function triggerShake(intensity, duration) {
  shakeIntensity = intensity;
  shakeTimer = duration;
}

// --- Orb trail ---
const orbTrail = [];
const ORB_TRAIL_LENGTH = 12;

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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function triggerLevelUp() {
  level++;
  xp = 0;
  xpToNext = Math.ceil(xpToNext * XP_SCALE);
  pickingUpgrade = true;
  upgradeChoices = shuffle([...UPGRADES]).slice(0, 3);
}

function resetGame() {
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.speed = 260 + meta.bonusSpeed * 20;
  player.hp = 3 + meta.bonusHp;
  player.maxHp = 3 + meta.bonusHp;
  player.iframes = 0;
  orb.angle = 0;
  orb.speed = 3 + meta.bonusOrbSpeed * 0.4;
  orb.size = 8;
  orb.radius = 50 + meta.bonusOrbitRadius * 8;
  enemies.length = 0;
  particles.length = 0;
  orbTrail.length = 0;
  spawnTimer = 0;
  runTime = 0;
  score = 0;
  xp = 0;
  level = 1;
  xpToNext = 5;
  pickingUpgrade = false;
  upgradeChoices = [];
  shakeTimer = 0;
  shopping = false;
  titleScreen = false;
  gameOver = false;
}

// --- Update ---
function update(dt) {
  // Title screen
  if (titleScreen) {
    titleOrb.angle += 2 * dt;
    if (keys[" "]) {
      titleScreen = false;
      keys[" "] = false;
      resetGame();
    }
    return;
  }

  if (gameOver) {
    // Still let shake + particles wind down
    updateParticles(dt);
    if (shakeTimer > 0) shakeTimer -= dt;

    // Shop mode — buy meta upgrades
    if (shopping) {
      for (let i = 0; i < META_UPGRADES.length; i++) {
        if (keys[String(i + 1)]) {
          const u = META_UPGRADES[i];
          if (meta.lovePoints >= u.cost()) {
            meta.lovePoints -= u.cost();
            u.apply();
            saveMeta();
          }
          keys[String(i + 1)] = false;
        }
      }
      if (keys["r"]) resetGame();
      return;
    }
    // First press after death — award love points, open shop
    if (keys[" "] || keys["r"]) {
      meta.lovePoints += score;
      saveMeta();
      shopping = true;
      keys[" "] = false;
      keys["r"] = false;
    }
    return;
  }

  // Upgrade pick — pause everything while choosing
  if (pickingUpgrade) {
    for (let i = 0; i < 3; i++) {
      if (keys[String(i + 1)]) {
        upgradeChoices[i].apply();
        pickingUpgrade = false;
        keys[String(i + 1)] = false;
        break;
      }
    }
    return;
  }

  runTime += dt;

  // Player iframes countdown
  if (player.iframes > 0) player.iframes -= dt;

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

  // Orb trail
  orbTrail.push({ x: orb.x, y: orb.y });
  if (orbTrail.length > ORB_TRAIL_LENGTH) orbTrail.shift();

  // Difficulty scaling — spawns get faster, enemies get speedier
  const difficulty = 1 + runTime / 60; // ramps over minutes
  const spawnInterval = BASE_SPAWN_INTERVAL / difficulty;
  const enemySpeed = BASE_ENEMY_SPEED * difficulty;

  // Enemy spawning
  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer -= spawnInterval;
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
      e.x += (edx / elen) * enemySpeed * dt;
      e.y += (edy / elen) * enemySpeed * dt;
    }

    // Check orb hit
    if (dist(orb, e) < orb.size + e.radius) {
      spawnParticles(e.x, e.y, "#ef5350", 8);
      enemies.splice(i, 1);
      score++;
      xp++;
      if (xp >= xpToNext) triggerLevelUp();
      continue;
    }

    // Check enemy hitting player
    if (player.iframes <= 0 && dist(player, e) < player.radius + e.radius) {
      player.hp--;
      player.iframes = player.iframeDuration;
      triggerShake(6, 0.25);
      spawnParticles(player.x, player.y, "#4fc3f7", 12);
      if (player.hp <= 0) {
        gameOver = true;
        return;
      }
    }
  }

  // Update particles
  updateParticles(dt);

  // Update screen shake
  if (shakeTimer > 0) shakeTimer -= dt;
}

// --- Draw ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // --- Title screen ---
  if (titleScreen) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Decorative player circle
    ctx.beginPath();
    ctx.arc(cx, cy + 20, 28, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();

    // Decorative orbiting girlfriend
    const ox = cx + Math.cos(titleOrb.angle) * 70;
    const oy = cy + 20 + Math.sin(titleOrb.angle) * 70;
    ctx.beginPath();
    ctx.arc(ox, oy, 14, 0, Math.PI * 2);
    ctx.fillStyle = orb.color;
    ctx.fill();

    // Trail on title too because she deserves it
    const trailLen = 8;
    for (let i = 1; i <= trailLen; i++) {
      const a = titleOrb.angle - i * 0.15;
      const tx = cx + Math.cos(a) * 70;
      const ty = cy + 20 + Math.sin(a) * 70;
      ctx.globalAlpha = (1 - i / trailLen) * 0.35;
      ctx.beginPath();
      ctx.arc(tx, ty, 14 * (1 - i / trailLen) * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = orb.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Title text
    ctx.textAlign = "center";
    ctx.font = "52px monospace";
    ctx.fillStyle = "#fff";
    ctx.fillText("orbital girlfriend", cx, cy - 80);

    ctx.font = "18px monospace";
    ctx.fillStyle = "#f48fb1";
    ctx.fillText("she protecc. she orbicc. she attacc.", cx, cy - 45);

    ctx.font = "20px monospace";
    ctx.fillStyle = "#aaa";
    ctx.fillText("press space to start", cx, cy + 120);

    // Show love points if you have any
    if (meta.lovePoints > 0) {
      ctx.font = "16px monospace";
      ctx.fillStyle = "#f48fb1";
      ctx.fillText(`\u2665 ${meta.lovePoints}`, cx, cy + 155);
    }
    return;
  }

  // Apply screen shake
  ctx.save();
  if (shakeTimer > 0) {
    const sx = (Math.random() - 0.5) * shakeIntensity * 2;
    const sy = (Math.random() - 0.5) * shakeIntensity * 2;
    ctx.translate(sx, sy);
  }

  // Enemies
  for (const e of enemies) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fillStyle = e.color;
    ctx.fill();
  }

  // Particles
  drawParticles();

  // Player (blinks during iframes)
  const visible = player.iframes <= 0 || Math.floor(player.iframes * 10) % 2 === 0;
  if (visible) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.iframes > 0 ? "#fff" : player.color;
    ctx.fill();
  }

  // Orb trail
  for (let i = 0; i < orbTrail.length; i++) {
    const t = orbTrail[i];
    const alpha = (i / orbTrail.length) * 0.4;
    const r = orb.size * (i / orbTrail.length) * 0.7;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.fillStyle = orb.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Orb
  ctx.beginPath();
  ctx.arc(orb.x, orb.y, orb.size, 0, Math.PI * 2);
  ctx.fillStyle = orb.color;
  ctx.fill();

  ctx.restore(); // end screen shake

  // --- HUD ---
  ctx.fillStyle = "#fff";
  ctx.font = "20px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`♥ ${player.hp}`, 20, 32);
  ctx.fillText(`lv ${level}`, 20, 58);
  ctx.textAlign = "right";
  ctx.fillText(`score: ${score}`, canvas.width - 20, 32);

  // XP bar
  const barW = 160;
  const barH = 8;
  const barX = 20;
  const barY = 68;
  ctx.fillStyle = "#333";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = "#ab47bc";
  ctx.fillRect(barX, barY, barW * (xp / xpToNext), barH);

  // --- Upgrade pick screen ---
  if (pickingUpgrade) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffeb3b";
    ctx.textAlign = "center";
    ctx.font = "36px monospace";
    ctx.fillText("level up!", canvas.width / 2, canvas.height / 2 - 80);

    ctx.font = "22px monospace";
    for (let i = 0; i < upgradeChoices.length; i++) {
      const y = canvas.height / 2 - 20 + i * 44;
      ctx.fillStyle = "#fff";
      ctx.fillText(`[${i + 1}] ${upgradeChoices[i].name}`, canvas.width / 2, y);
    }
  }

  // --- Game over screen ---
  if (gameOver && !shopping) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "48px monospace";
    ctx.fillText("game over", canvas.width / 2, canvas.height / 2 - 50);
    ctx.font = "24px monospace";
    ctx.fillText(`score: ${score}`, canvas.width / 2, canvas.height / 2);
    ctx.font = "20px monospace";
    ctx.fillStyle = "#ab47bc";
    ctx.fillText(`level ${level}`, canvas.width / 2, canvas.height / 2 + 35);
    ctx.font = "20px monospace";
    ctx.fillStyle = "#f48fb1";
    ctx.fillText(`+${score} ♥ love points`, canvas.width / 2, canvas.height / 2 + 70);
    ctx.font = "18px monospace";
    ctx.fillStyle = "#aaa";
    ctx.fillText("press space to continue", canvas.width / 2, canvas.height / 2 + 110);
  }

  // --- Shop screen ---
  if (shopping) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";
    ctx.font = "36px monospace";
    ctx.fillStyle = "#f48fb1";
    ctx.fillText(`♥ ${meta.lovePoints} love points`, canvas.width / 2, canvas.height / 2 - 110);

    ctx.font = "28px monospace";
    ctx.fillStyle = "#ffeb3b";
    ctx.fillText("upgrades", canvas.width / 2, canvas.height / 2 - 65);

    ctx.font = "20px monospace";
    for (let i = 0; i < META_UPGRADES.length; i++) {
      const u = META_UPGRADES[i];
      const cost = u.cost();
      const canAfford = meta.lovePoints >= cost;
      const y = canvas.height / 2 - 20 + i * 38;
      ctx.fillStyle = canAfford ? "#fff" : "#666";
      ctx.fillText(`[${i + 1}] ${u.name()}  (♥${cost})`, canvas.width / 2, y);
    }

    ctx.font = "18px monospace";
    ctx.fillStyle = "#aaa";
    ctx.fillText("press R to start new run", canvas.width / 2, canvas.height / 2 + 140);
  }
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
