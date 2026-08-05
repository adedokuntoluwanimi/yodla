# Yodla — Coming Soon

A single-page "under construction" landing page for Yodla, featuring an animated SVG construction scene with workers building a drink house.

## Quick start

Open `index.html` in a browser, or serve locally:

```bash
# Python
python -m http.server 8080

# Node (npx)
npx serve .
```

Then visit `http://localhost:8080`.

## Before launch — update these

### 1. Email signup (Formspree)

1. Create a free account at [formspree.io](https://formspree.io)
2. Create a new form and copy your form endpoint (e.g. `https://formspree.io/f/xyzabcde`)
3. Open `js/main.js` and replace `YOUR_FORM_ID` in `formspreeEndpoint`:

```js
formspreeEndpoint: "https://formspree.io/f/xyzabcde",
```

Until you update this, the form shows a success message locally without actually sending emails.

### 2. Social media links

In `js/main.js`, update the `social` array with your real URLs:

```js
social: [
  { name: "Instagram", url: "https://instagram.com/yourhandle", ... },
  { name: "X", url: "https://x.com/yourhandle", ... },
  { name: "Facebook", url: "https://facebook.com/yourpage", ... },
],
```

## Deploy

### Netlify

1. Push this folder to a GitHub repository
2. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
3. Select the repo; build command and publish directory are not needed (static site)
4. Set publish directory to `.` (root)
5. Deploy — Netlify gives you a `*.netlify.app` URL
6. Add your custom domain under **Domain settings**

### Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. Framework preset: **Other** (no build step)
4. Deploy

### GitHub Pages

1. Push to GitHub
2. Repo **Settings** → **Pages** → Source: `main` branch, folder `/ (root)`
3. Site will be at `https://yourusername.github.io/repo-name/`

## Project structure

```
Yodla/
├── index.html          # Page structure + inline SVG scene
├── css/
│   ├── styles.css      # Layout, typography, card, form
│   └── animations.css  # Scene animations + reduced-motion
├── js/
│   └── main.js         # Form handling, social links config
└── README.md
```

## Features

- Animated construction scene (crane, workers, forklift, neon sign, steam, dust)
- Glassmorphism overlay card with Yodla branding
- Email signup with Formspree integration
- Social media links (Instagram, X, Facebook)
- Mobile responsive with performance optimizations on small screens
- `prefers-reduced-motion` support for accessibility

## Replacing with the full store

When the real e-commerce site is ready, either:

- Replace the contents of this repo and redeploy, or
- Point your domain to the new hosting and archive this repo

Export your Formspree subscriber list before switching.
