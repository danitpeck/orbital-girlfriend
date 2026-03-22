# Orbital Girlfriend 💫

a whimsical 2D roguelite browser game where your orbiting orb girlfriend protects you by bonking enemies. it's cute. it's dumb. it's secretly about managing space under pressure. we love it.

## how to play

- **WASD** to move — she does the rest
- your girlfriend (the yellow orb) orbits you automatically and bonks enemies on contact
- survive as long as you can against waves of red circles
- **level up** to pick upgrades — orbit radius is your core decision (tight = control, wide = safety)
- earn **love points** when you die, spend them on permanent upgrades between runs
- press **A** on the title screen to check your **achievements**

## features

- 🌀 **orbital combat** — position yourself so she bonks for you
- 📈 **roguelite loop** — die → earn love points → buy permanent upgrades → run again
- ⬆️ **8 per-run upgrades** — orbit radius +/-, orb speed, orb size, player speed, extra orbs, max hp, heal
- 🏪 **permanent shop** — starting hp, speed, orb speed, iframe duration
- 🏆 **13 achievements** — "useless lesbian", "polycule", "clingy", "long distance relationship", and more
- ✨ **juice** — particles, screen shake, orb trails, damage flash, knockback

## running locally

```bash
npm install
npm run dev
```

then open http://localhost:5173

## building

```bash
npm run build
```

static files land in `dist/` — deploy anywhere (Vercel, itch.io, etc).

## tech

vanilla JS + HTML5 canvas, bundled with Vite. no frameworks, no libraries, just vibes and math.
