# ePuzzel

Simple browser jigsaw: **upload an image**, pick **piece count**, choose **snap + dotted guides** or **free placement**, and a **surface** (wood table, wood floor, puzzle mat). Works on **mobile and desktop** — drag pieces from the **pile** to the **board**. Everything runs in the browser (no server upload).

## Piece counts

Grid size is chosen automatically from the image aspect ratio: **3, 5, 10, 15, 20, 50, 100, 150, 200** pieces.

## Run locally

Open `index.html` in a browser, or from this folder:

```bash
npx --yes serve .
# then open http://localhost:3000
```

## Publish (GitHub Pages)

1. Create a new GitHub repo (e.g. `epuzzel`).
2. Push this folder to the `main` branch.
3. **Settings → Pages → Deploy from branch → `main` → / (root)**.
4. Play at `https://YOUR_USERNAME.github.io/epuzzel/`.

## Rights

Only use images you have permission to use.
