# best-stealth-game-20261121-1759

[![Competition](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Rank](https://make.fun/badge/best-stealth-game-20261121-1759/Jaka1603/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Reward](https://make.fun/badge/best-stealth-game-20261121-1759/Jaka1603/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

**MOONLIT ESTATE** — cross five night gardens and reach the gate unseen. Gardeners walk their rounds with lanterns, and the cone of light on the grass is exactly what each gardener can see. Hedges, stone walls and fountains cut the light short; pools of deep shadow slow suspicion while you stand inside them. One meter rules the whole crossing: seen, it fills — faster up close, slower in shadow. Past halfway the gardener gives chase, and a filled meter or a gardener's hand ends the attempt. Break the line of sight, let the meter drain, and the near miss pays you while the patrols quicken.

Each gardener keeps a real patrol discipline: a waypoint loop with pauses you can learn, a stare when something catches his eye, a walk to the last place seen — or last *heard* — a search, then the way back to the loop. Walking is heard inside a noise radius, and your own dashed ring shows how far that is; hold Shift to tiptoe, silent and slow. Footsteps ring the grass as fading ripples, so you can hear a gardener coming before his lantern swings round. Moon moths drift in every garden for score, a crossing nobody saw earns a ghost bonus, and a caught attempt costs points and resets the garden.

The code is hand-written ES modules: `levels.js` holds the five gardens as compact data rows, `vision.js` the sight and collision geometry (occluded cone polygons, sightline clipping), `guards.js` the patrol state machine as a table of behaviours, `game.js` the rules in one state object (movement, noise, the meter, moths, the gate), `render.js` the night garden and its light, plus `input.js`, `audio.js` (WebAudio synth, no audio files), and `shots.js`, which poses the deterministic screenshot scenes behind the four real renders in `screenshots/`. The simulation runs on a fixed 1/60 s step, so every patrol is reproducible.

## Run it

```
node main.ts            # copies game/ + screenshots/ to /output and writes dossier.json
node serve.ts           # serves game/ at http://localhost:8080
```

Outside the grader's container use `MAKEFUN_OUTPUT_DIR=out node main.ts`. Any static file server pointed at `game/` also works. Controls: WASD or arrow keys to move, Shift to tiptoe, P or Esc to pause, M to mute, Enter to advance.

---
Built for the [make.fun stealth bounty](https://make.fun/bounty/best-stealth-game-20261121-1759) · referral code `md16tqa0` — sign up via https://make.fun/r/md16tqa0
