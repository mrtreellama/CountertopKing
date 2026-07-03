# 🐾 Countertop King

A browser endless-runner starring **Kyle** (orange & white) and **Malcolm** (all black) — two cats
on a mission to rule the kitchen counter.

Run along the countertop, eat the good food, knock stuff off, jump the gaps, dodge the stoves and
sinks, and above all: **avoid the spray bottle.**

## How to play

| Key | Action |
| --- | --- |
| ← / → | Switch lanes (going right from the right-most lane hops down to the floor; ← from the floor hops back up) |
| ↑ | Jump |
| ↓ | Dive (fall faster mid-air) |
| P / Esc | Pause |
| M | Mute |

### Scoring

- 🏃 +1 point per meter run
- 🍗🥩🐟🥓 Meat: **+50 to +70**
- 🥦🍎🥕🍌 Fruits & veggies: **−20 to −30** (yuck)
- ☕ Knock mugs, glasses, plates, and vases off the counter: **+25**
- 💦 Hit by the spray bottle: **−100**
- 🧹 On the floor: **−3 per second** — get back up!

Hitting a stove or sink, or falling into a gap between counters, ends the run.

## Run it locally

No build step. Just open `index.html` in a browser (double-click it), or serve the folder:

```
npx http-server -p 8123
```

then visit http://localhost:8123. (Three.js loads from a CDN, so you need an internet connection.)

## Host on GitHub Pages

1. Create a new repository on GitHub (e.g. `CountertopKing`).
2. From this folder:
   ```
   git init
   git add .
   git commit -m "Countertop King"
   git branch -M main
   git remote add origin https://github.com/<your-username>/CountertopKing.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. After a minute the game is live at `https://<your-username>.github.io/CountertopKing/`.
