# BrainPlay Kids

Playful 3D memory & brain games for children, grouped by age. Installable PWA, works offline, no ads, no tracking.

| Age band | Games | Skill |
|---|---|---|
| Babies 0–2 | Bubble Pop, Peekaboo Pip, Find the Animal | cause & effect, tracking, object permanence, first words |
| Toddlers 2–4 | Shape Sorter, Match Pairs, How Many? | shape matching, fine motor, visual memory, counting |
| Kids 4–7 | Follow the Lights, What's Missing?, Odd One Out, Catch the Fruit | sequence memory, attention & recall, discrimination, impulse control |
| Big Kids 7–12 | Memory Grid, Number Recall, Math Pop, Spin Match | spatial working memory, digit span, arithmetic, mental rotation |
| Adults 13+ | N-Back, Stroop, Mental Chain, Schulte Table | working memory, inhibition, chained arithmetic, attention |

Bo, an original 3D cartoon mascot, hosts the home screen and reacts in the kids' games. Each game has 8 levels; stars and best level are saved on the device.

## Run locally
```bash
python3 -m http.server 8765
```
Open http://localhost:8765 — Chrome/Edge show an **Install app** button; on iOS use Share → Add to Home Screen.

## Deploy
Static files only (`index.html`, `style.css`, `app.js`, `sw.js`, `manifest.webmanifest`, `icons/`). Any HTTPS static host works (GitHub Pages, Netlify). HTTPS is required for installation and offline mode.

Tech: three.js r128 (one shared WebGL scene), Web Audio for synthesized sounds, no build step.
