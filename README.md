# This Is Molotov

hellothisismolotov.com — single-page static site.
Also live at thisismolotov.vercel.app. The domain thisismolotov.com is registered but still parked.

## Structure
- `index.html` — the whole site (masthead + Extraction search, hero grid, pull-quote band, three exhibits, full-text reader overlay)
- `images/` — plates
- `docs/` — source text of the letters and the master plan

## Image slots
Drop files with these exact names into `images/`; the page picks them up automatically.

| File | Where it appears |
|---|---|
| `images/tuxedos-2007.jpg` | Plate 01, upper left (currently vacant) |
| `images/molotov-and-orhalla.jpg` | Plate 02, center — falls back to `molotov-alva.jpg` |
| `images/gift-shop.jpg` | Plate 03, right (currently vacant) |

## Deploy
GitHub-connected Vercel project — `git push` deploys. Do not also run `vercel deploy --prod`.
