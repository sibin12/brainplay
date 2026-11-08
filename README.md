# BrainPlay Kids

Playful 3D memory & brain games for children, grouped by age. Installable PWA, works offline, no ads, no tracking.

| Age band | Games | Skill |
|---|---|---|
| Babies 0–2 | Bubble Pop, Peekaboo Pip | cause & effect, tracking, object permanence |
| Toddlers 2–4 | Shape Sorter, Match Pairs | shape matching, fine motor, visual memory |
| Kids 4–7 | Follow the Lights, What's Missing? | sequence memory, attention & recall |
| Big Kids 7–12 | Memory Grid, Number Recall | spatial working memory, digit span (forward & backward) |

Each game has 8 levels; stars and best level are saved on the device.

## Run locally
```bash
python3 -m http.server 8765
```
Open http://localhost:8765 — Chrome/Edge show an **Install app** button; on iOS use Share → Add to Home Screen.

## Deploy
Static files only (`index.html`, `style.css`, `app.js`, `sw.js`, `manifest.webmanifest`, `icons/`). Any HTTPS static host works (GitHub Pages, Netlify). HTTPS is required for installation and offline mode.

Tech: three.js r128 (one shared WebGL scene), Web Audio for synthesized sounds, no build step.
