# ePuzzle

Simple browser jigsaw: **upload an image**, pick **piece count**, choose **snap + dotted guides** or **free placement**, and a **surface** (wood table, wood floor, puzzle mat). Works on **mobile and desktop** — drag pieces from the **pile** to the **board**. Everything runs in the browser (no server upload).

## Piece counts

Grid size is chosen automatically from the image aspect ratio: **3, 5, 10, 15, 20, 50, 100, 150, 200** pieces.

## Run locally

Open `index.html` in a browser, or from this folder:

```bash
npx --yes serve .
# then open http://localhost:3000
```

## GitHub repo (you create the empty repo; code is already here)

This folder is a **git repo** on your machine (`main` with an initial commit). GitHub **cannot** be created automatically from this environment without your login.

**Option A — GitHub website**

1. On GitHub: **New repository** → name it **`epuzzle`** (or another name) → create **without** README (this folder already has files).
2. In Terminal:

```bash
cd "/Users/b/Vibe Coding/epuzzle"
git remote add origin https://github.com/YOUR_USERNAME/epuzzle.git
git push -u origin main
```

3. **Settings → Pages →** Deploy from **`main`** → **`/` (root)** → site: `https://YOUR_USERNAME.github.io/epuzzle/`

**Option B — GitHub CLI** (`gh auth login` once)

```bash
cd "/Users/b/Vibe Coding/epuzzle"
gh repo create epuzzle --public --source=. --remote=origin --push
```

Then enable **Pages** on that repo as above.

## Rights

Only use images you have permission to use.
