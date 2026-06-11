# AnzeigenBoost — AI Image Prompt Pack

Copy-paste prompts for logo, app/extension icon, and marketing images.
Works with Midjourney, DALL·E 3 (ChatGPT), Ideogram (best for text in images),
Adobe Firefly, or Flux.

## Brand cheatsheet (paste this context first if your tool supports it)
- **Name:** AnzeigenBoost — a German SaaS + Chrome extension that pushes
  Kleinanzeigen.de listings back to the top, creates listings from photos with
  AI, and offers 1-click reply templates.
- **Audience:** German private sellers & small resellers. Tone: trustworthy,
  modern, friendly — *not* corporate, *not* flashy crypto/AI-hype.
- **Primary color:** lime green `#A8C300` (Kleinanzeigen-adjacent). Hover/darker `#86AB00`.
- **Accents:** dark slate `#1F2937`, white `#FFFFFF`, soft gray `#F5F5F5`.
- **Motifs:** upward arrow / "boost", a megaphone or rocket, a price tag,
  a chat bubble, a camera→listing transformation.
- **Avoid:** the literal Kleinanzeigen logo/wordmark (trademark), stock-photo
  clichés, neon, 3D chrome, busy gradients.

---

## 1. Logo

### 1a. Primary logo mark (icon + wordmark)
```
Minimalist flat vector logo for "AnzeigenBoost", a German marketplace listing
booster app. An abstract mark combining an upward arrow with a small price tag
or chat bubble, suggesting a listing being pushed to the top. Lime green
#A8C300 with dark slate #1F2937 accents on a white background. Clean geometric
sans-serif wordmark "AnzeigenBoost" to the right of the mark. Modern, friendly,
trustworthy SaaS branding. Flat, no gradients, no 3D, vector, high contrast,
generous whitespace. --ar 3:1
```

### 1b. Icon-only variants (try several, pick one)
```
App icon for "AnzeigenBoost": a single bold upward arrow formed from stacked
horizontal bars (like a rising listing climbing to the top of a list), lime
green #A8C300 on white, rounded geometric, flat vector, minimal, centered,
square. --ar 1:1
```
```
App icon: a green rocket made of a price tag, lime #A8C300, flat minimal vector
mark, friendly, on white, square, generous padding. --ar 1:1
```
```
App icon: a megaphone with a small upward arrow coming out of it, lime green
#A8C300 and dark slate, flat vector, rounded, minimal, square. --ar 1:1
```

### 1c. Chrome extension / favicon (must read at 16–48px)
```
Ultra-simple app icon that stays legible at 16px: a single lime-green #A8C300
upward chevron/arrow on a white rounded square, thick strokes, very high
contrast, no text, no fine detail, flat. --ar 1:1
```

> **Tip:** For the wordmark, use **Ideogram** — it renders the text
> "AnzeigenBoost" far more reliably than Midjourney/DALL·E.

---

## 2. Marketing / landing images

### 2a. Hero image (landing top)
```
Clean modern SaaS hero illustration: a smartphone showing a German classifieds
listing with an upward green arrow lifting it to the top of a feed, floating UI
cards (a photo turning into a listing, a chat bubble with a quick-reply). Flat
vector illustration, lime green #A8C300 + slate + white, lots of whitespace,
friendly and trustworthy, no real logos, no text. --ar 16:9
```

### 2b. Feature: AI listing from photo
```
Flat vector illustration: a hand holding a phone photographing a second-hand
item (e.g. a jacket), an arrow leading to an auto-generated listing card with
title, price and description appearing. Sparkle/AI accent. Lime green #A8C300
palette, white background, minimal, friendly. --ar 4:3
```

### 2c. Feature: auto-repost / boost to top
```
Flat vector illustration of a vertical list of listing cards; one card rises to
the top with a green upward motion trail and a small clock icon (scheduled).
Lime green #A8C300, slate, white, minimal, clean. --ar 4:3
```

### 2d. Feature: 1-click reply templates
```
Flat vector illustration of a chat conversation: an incoming message bubble and
a green "1-Klick-Vorlage" button inserting a friendly reply. Light-blue incoming
bubble, lime-green action, white background, minimal, modern. --ar 4:3
```

### 2e. Social / Open Graph card (1200×630)
```
Open Graph social banner for "AnzeigenBoost": bold short German headline space
on the left, product UI mockup of a listings dashboard with a green upward arrow
on the right. Lime green #A8C300 and slate on white, clean, lots of negative
space, modern SaaS. --ar 1200:630
```

### 2f. Chrome Web Store promo tile (440×280 & 1400×560)
```
Chrome Web Store promotional banner for "AnzeigenBoost" browser extension:
the green logo mark, a short value line area, and a stylized browser window
showing a classifieds listings page with one ad boosted to the top. Lime green
#A8C300, white, slate, flat, clean, professional. --ar 5:2
```

---

## Per-tool notes
- **Midjourney:** keep `--ar`, add `--style raw --v 6` for cleaner vector looks; add `--no text, watermark, logo clutter, 3d, gradient` if needed.
- **DALL·E 3 / ChatGPT:** drop the `--ar` flags; instead write "square 1:1" / "wide 16:9" in the sentence. Ask for "flat vector, SVG-like".
- **Ideogram:** best when the image must contain the word **"AnzeigenBoost"**.
- **Logos:** generate raster, then trace to SVG (e.g. vectorizer.ai / Illustrator Image Trace) so you get scalable assets + proper favicon/extension sizes (16/32/48/128px).

## Negative prompt (reuse everywhere)
```
no real brand logos, no Kleinanzeigen logo, no copyrighted marks, no neon,
no 3d chrome, no busy gradients, no stock-photo people, no gibberish text,
no watermark
```
