# AnzeigenBoost — Master Project Generation Prompt
# Paste this ENTIRE file into Claude Code, Cursor, Windsurf, or any AI coding tool.
# It will scaffold the complete production-ready project from scratch.

---

## 1. WHAT YOU ARE BUILDING

**AnzeigenBoost** (anzeigenboost.de) — a German-market SaaS that automates
Kleinanzeigen.de ad reposting. Sellers pay a monthly subscription to keep their
ads always at the top of search results without manual work.

Core value proposition: "Deine Kleinanzeigen immer ganz oben — vollautomatisch."

---

## 2. FULL MONOREPO STRUCTURE

Scaffold exactly this:

```
anzeigenboost/
├── backend/                          # NestJS 10 API
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── refresh.strategy.ts
│   │   │   └── dto/
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.service.ts
│   │   │   └── dto/
│   │   ├── ads/
│   │   │   ├── ads.module.ts
│   │   │   ├── ads.controller.ts
│   │   │   ├── ads.service.ts
│   │   │   └── dto/
│   │   ├── scheduler/
│   │   │   ├── scheduler.module.ts
│   │   │   └── scheduler.service.ts
│   │   ├── automation/
│   │   │   ├── automation.module.ts
│   │   │   └── automation.service.ts
│   │   ├── credentials/
│   │   │   ├── credentials.module.ts
│   │   │   ├── credentials.service.ts
│   │   │   └── dto/
│   │   ├── firebase/
│   │   │   ├── firebase.module.ts
│   │   │   └── firebase.service.ts
│   │   ├── ai/
│   │   │   ├── ai.module.ts
│   │   │   ├── ai.controller.ts
│   │   │   └── ai.service.ts
│   │   └── common/
│   │       ├── guards/
│   │       ├── interceptors/
│   │       ├── decorators/
│   │       └── filters/
│   ├── test/
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
│
├── frontend/                         # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Landing.tsx           # Public marketing + landing page
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Ads.tsx
│   │   │   ├── Schedule.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── Logs.tsx
│   │   │   ├── AiAssistant.tsx       # AI features page
│   │   │   ├── Auth.tsx
│   │   │   ├── Impressum.tsx
│   │   │   ├── Datenschutz.tsx
│   │   │   └── AGB.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── TopBar.tsx
│   │   │   ├── ads/
│   │   │   ├── schedule/
│   │   │   ├── ai/
│   │   │   │   └── AiChat.tsx        # Floating AI chat widget
│   │   │   ├── landing/
│   │   │   │   ├── Hero.tsx
│   │   │   │   ├── Features.tsx
│   │   │   │   ├── Pricing.tsx
│   │   │   │   ├── FAQ.tsx
│   │   │   │   ├── SupportMe.tsx     # PayPal donation widget
│   │   │   │   └── Footer.tsx
│   │   │   └── ui/                   # shadcn/ui components
│   │   ├── hooks/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   └── hooks/
│   │   ├── store/
│   │   │   └── auth.store.ts
│   │   └── styles/
│   │       └── globals.css
│   ├── public/
│   ├── index.html
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── .env.example
│   └── package.json
│
├── automation/                       # Playwright worker service (Node + Express)
│   ├── src/
│   │   ├── index.ts                  # Express server
│   │   ├── browser.ts
│   │   ├── login.ts
│   │   ├── fetch-ads.ts
│   │   └── repost.ts
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml                # Local dev
├── docker-compose.prod.yml           # VPS production
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
└── README.md
```

---

## 3. BACKEND — NestJS 10

### 3.1 Package.json dependencies

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/schedule": "^4.0.0",
    "@nestjs/throttler": "^5.0.0",
    "firebase-admin": "^12.0.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.0",
    "bcryptjs": "^2.4.3",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "helmet": "^7.0.0",
    "axios": "^1.6.0",
    "openai": "^4.0.0",
    "cookie-parser": "^1.4.6"
  }
}
```

### 3.2 Firebase Firestore schema

Implement full TypeScript interfaces and Firebase service CRUD methods for:

```typescript
// Collection: users/{userId}
interface User {
  uid: string;
  email: string;
  passwordHash: string;
  plan: 'free' | 'starter' | 'pro';
  displayName?: string;
  location?: string;          // e.g. "Berlin" — used when reposting ads
  createdAt: FirebaseFirestore.Timestamp;
  stripeCustomerId?: string;
  repostCount: number;        // total lifetime reposts
  monthlyRepostCount: number; // resets monthly via cron
}

// Collection: credentials/{userId}
interface StoredCredentials {
  userId: string;
  encryptedEmail: string;
  encryptedPassword: string;
  iv: string;
  authTag: string;
  encryptedSession?: string;  // Playwright cookies, also encrypted
  sessionIv?: string;
  sessionAuthTag?: string;
  lastVerifiedAt?: FirebaseFirestore.Timestamp;
}

// Collection: ads/{adId}
interface Ad {
  id: string;
  userId: string;
  title: string;
  description: string;
  price: number;
  category: string;
  kleinanzeigenId: string;
  kleinanzeigenUrl: string;
  images: string[];           // Firebase Storage URLs
  repostIntervalDays: number;
  lastPostedAt: FirebaseFirestore.Timestamp;
  nextRepostAt: FirebaseFirestore.Timestamp;
  status: 'active' | 'paused' | 'error' | 'pending';
  repostCount: number;
  errorMessage?: string;
  aiOptimizedTitle?: string;        // AI-generated improved title
  aiOptimizedDescription?: string;  // AI-generated improved description
  aiSuggestedPrice?: number;        // AI price suggestion
  createdAt: FirebaseFirestore.Timestamp;
}

// Collection: repostLogs/{logId}
interface RepostLog {
  id: string;
  adId: string;
  userId: string;
  adTitle: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  executedAt: FirebaseFirestore.Timestamp;
  durationMs: number;
  newKleinanzeigenId?: string;
}

// Collection: aiUsage/{userId}
interface AiUsage {
  userId: string;
  monthlyTokensUsed: number;
  monthlyTokenLimit: number;  // free: 5000, starter: 50000, pro: unlimited
  lastResetAt: FirebaseFirestore.Timestamp;
}
```

### 3.3 API routes

Implement all with proper DTOs, guards, and validation:

```
# Auth
POST   /auth/register          body: { email, password, displayName }
POST   /auth/login             body: { email, password } → sets httpOnly refresh cookie
POST   /auth/refresh           reads httpOnly cookie → new access token
POST   /auth/logout            clears cookie
GET    /auth/me                returns current user (no passwordHash)

# Credentials
POST   /credentials            body: { kleinanzeigenEmail, kleinanzeigenPassword }
GET    /credentials/status     → { connected: bool, lastVerified: Date | null }
POST   /credentials/verify     triggers a test Playwright login
DELETE /credentials

# Ads
GET    /ads                    query: ?page=1&limit=20&status=active
POST   /ads                    body: CreateAdDto
GET    /ads/:id
PATCH  /ads/:id                body: UpdateAdDto
DELETE /ads/:id
POST   /ads/:id/repost         manual repost now
POST   /ads/:id/pause
POST   /ads/:id/resume
POST   /ads/sync               trigger fetch-ads to pull from Kleinanzeigen

# Schedule
GET    /schedule               query: ?days=30 → upcoming reposts list

# Logs
GET    /logs                   query: ?page=1&limit=50&adId=...

# AI endpoints
POST   /ai/optimize-ad         body: { adId } → improves title + description using GPT-4o-mini
POST   /ai/suggest-price       body: { adId } → market price suggestion
POST   /ai/chat                body: { message, context? } → general assistant
GET    /ai/usage               returns token usage this month

# Support / donation
GET    /support/config         → { paypalUrl, githubUrl, message }
```

### 3.4 Credential encryption — implement exactly this

```typescript
// backend/src/credentials/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32-byte hex key

export function encrypt(plaintext: string): {
  ciphertext: string;
  iv: string;
  authTag: string;
} {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

export function decrypt(ciphertext: string, iv: string, authTag: string): string {
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
// RULE: decrypt() is called ONLY inside automation.service.ts, never in controllers
// RULE: never log any variable that holds decrypted values
```

### 3.5 Scheduler service

```typescript
// backend/src/scheduler/scheduler.service.ts
@Injectable()
export class SchedulerService implements OnModuleInit {
  // Run every 10 minutes via @Cron('0 */10 * * * *')
  // Query Firestore: ads where nextRepostAt <= now AND status == 'active'
  // Enforce plan limits:
  //   free: max 2 active ads, max 10 reposts/month
  //   starter: max 10 active ads, max 100 reposts/month
  //   pro: unlimited
  // For each due ad:
  //   1. Call automation.service.triggerRepost(adId, userId)
  //   2. On success: update lastPostedAt, nextRepostAt, increment repostCount
  //   3. On failure: set status='error', set errorMessage, write to repostLogs
  //   4. Always write to repostLogs with durationMs
  //
  // Also run @Cron('0 0 1 * *') monthly:
  //   Reset monthlyRepostCount for all users
  //   Reset monthlyTokensUsed in aiUsage collection
}
```

### 3.6 AI service — full implementation

```typescript
// backend/src/ai/ai.service.ts
// Uses openai npm package with model: gpt-4o-mini (cheapest, fast)

@Injectable()
export class AiService {

  // 1. optimizeAd(adId, userId): Promise<OptimizeAdResult>
  //    - Fetch ad from Firestore
  //    - Check + deduct token budget (aiUsage collection)
  //    - System prompt: "Du bist ein Experte für deutsche Kleinanzeigen.
  //      Optimiere den folgenden Titel und die Beschreibung um mehr Käufer
  //      anzuziehen. Antworte auf Deutsch. Sei präzise und überzeugend.
  //      Beachte: Kleinanzeigen-Titel max 60 Zeichen."
  //    - User prompt: title + description + category + price
  //    - Parse JSON response: { optimizedTitle, optimizedDescription, reasoning }
  //    - Save to ad.aiOptimizedTitle, ad.aiOptimizedDescription in Firestore
  //    - Return result

  // 2. suggestPrice(adId, userId): Promise<PriceSuggestionResult>
  //    - System prompt: "Du bist ein Preisexperte für den deutschen Gebrauchtmarkt.
  //      Analysiere das folgende Produkt und schlage einen optimalen Verkaufspreis vor.
  //      Begründe deinen Vorschlag kurz auf Deutsch."
  //    - User prompt: title + description + category + currentPrice
  //    - Return: { suggestedPrice, minPrice, maxPrice, reasoning }

  // 3. chat(message, userId, context?): Promise<string>
  //    - Context can include: user's current ads list, recent repost stats
  //    - System prompt: "Du bist AnzeigenBoost Assistent. Du hilfst deutschen
  //      Kleinanzeigen-Verkäufern ihre Anzeigen zu optimieren und mehr zu verkaufen.
  //      Antworte immer auf Deutsch. Sei freundlich, praktisch und konkret.
  //      Du hast Zugriff auf die Anzeigen des Nutzers (im Kontext)."
  //    - Streaming response using OpenAI stream API
  //    - Return stream to controller which pipes to SSE response

  // 4. enforceTokenLimit(userId): checks aiUsage, throws if over limit
  //    Token limits: free=5000/mo, starter=50000/mo, pro=500000/mo
}
```

### 3.7 Support/donation endpoint

```typescript
// backend/src/common/support.controller.ts
@Get('/support/config')
getSupportConfig() {
  return {
    paypalDonateUrl: process.env.PAYPAL_DONATE_URL,
    // e.g. https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID
    githubUrl: 'https://github.com/yourusername/anzeigenboost',
    message: 'AnzeigenBoost ist ein Einzelprojekt. '
      + 'Wenn das Tool dir hilft, freue ich mich über eine kleine Unterstützung! ☕',
    kofiUrl: process.env.KOFI_URL, // optional: https://ko-fi.com/yourusername
  };
}
```

---

## 4. AUTOMATION SERVICE — Playwright

Standalone Express + TypeScript service. Runs in its own Docker container.
Only reachable from the backend container via Docker internal network.
Every request must include header: `X-Internal-Secret: <AUTOMATION_SECRET env var>`

### 4.1 package.json

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "playwright": "^1.44.0",
    "@types/express": "^4.17.0"
  }
}
```

### 4.2 browser.ts

```typescript
// Creates and returns a Playwright BrowserContext
// - Launch chromium headless
// - German locale: de-DE, timezone: Europe/Berlin
// - Viewport: 1280x800
// - User agent: realistic Chrome on Windows UA string
// - If sessionCookies string provided: parse JSON and addCookies()
// - Add random delay helper: randomDelay(min=300, max=1200) using setTimeout
// - Export: createContext(sessionCookies?: string): Promise<BrowserContext>
// - Export: randomDelay(min?: number, max?: number): Promise<void>
```

### 4.3 login.ts — POST /automate/login

```typescript
// Called once per user to capture session
// Steps:
// 1. createContext() — no cookies yet
// 2. page.goto('https://www.kleinanzeigen.de/einloggen.html')
// 3. Fill email field: input[name="loginId"] or #loginId
// 4. randomDelay()
// 5. Fill password field: input[name="loginPassword"] or #loginPassword
// 6. randomDelay()
// 7. Click submit: button[type="submit"] or .btn-login
// 8. Wait for navigation or logged-in indicator (.usernav--username or similar)
// 9. If login fails (error message visible): throw new Error('Login fehlgeschlagen')
// 10. Capture all cookies: context.cookies()
// 11. Return: { success: true, sessionCookies: JSON.stringify(cookies) }
// Handle: incorrect credentials, CAPTCHA (return { success: false, needsManual: true })
```

### 4.4 fetch-ads.ts — POST /automate/fetch-ads

```typescript
// Input: { sessionCookies: string }
// Steps:
// 1. createContext(sessionCookies)
// 2. page.goto('https://www.kleinanzeigen.de/m-meine-anzeigen.html')
// 3. Check if redirected to login page → throw SessionExpiredError
// 4. Wait for ad list: await page.waitForSelector('.cardbox', { timeout: 10000 })
// 5. Handle pagination: check for next page button, loop until no more pages
// 6. For each ad card, extract:
//    - title: .cardbox-title or h2 inside card
//    - ad URL: href of the card link (contains /s-anzeige/...)
//    - kleinanzeigenId: extract numeric ID from URL (last segment before .html)
//    - price: .cardbox-price or similar
//    - postedDate: .cardbox-date or time element
//    - category: breadcrumb or category label
// 7. Return: { ads: AdData[], count: number }
```

### 4.5 repost.ts — POST /automate/repost

```typescript
// Input: { sessionCookies, ad: { kleinanzeigenId, kleinanzeigenUrl, title,
//           description, price, category, images, userLocation } }
// Steps:
// 1. createContext(sessionCookies)
// 2. page.goto(ad.kleinanzeigenUrl)
// 3. Check session still valid
// 4. Click options menu or "Anzeige löschen" button
//    Selector: button[aria-label*="löschen"] or .icon-delete-ad
// 5. Confirm delete dialog: click confirm button
// 6. randomDelay(2000, 3000)
// 7. Verify ad is deleted: page.goto(ad.kleinanzeigenUrl) → should show 404 or error
// 8. page.goto('https://www.kleinanzeigen.de/anzeige-aufgeben.html')
// 9. Select category: navigate category selector matching ad.category
// 10. Fill title field: #postad-title
// 11. Fill description: #pstad-descrptn (note: Kleinanzeigen's actual ID has a typo)
// 12. Fill price: #postad-price
// 13. For each image URL: download to temp file, then upload via file input
// 14. Fill location: #postad-zip or location autocomplete
// 15. Click publish: #postad-publish or .btn-post-ad
// 16. Wait for success confirmation or new ad URL
// 17. Extract new ad ID from confirmation page URL
// 18. Clean up temp image files
// 19. Return: { success: true, newKleinanzeigenId, newUrl }
// On any step failure: return { success: false, step: N, error: message }
```

---

## 5. FRONTEND — React 18 + Vite + TypeScript

### 5.1 package.json dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.5.0",
    "axios": "^1.6.0",
    "react-hook-form": "^7.51.0",
    "zod": "^3.23.0",
    "@hookform/resolvers": "^3.3.0",
    "recharts": "^2.12.0",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.383.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

### 5.2 Tailwind config — Kleinanzeigen-inspired palette

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ka: {
          green:     '#A8C300',
          'green-dark': '#86A000',
          'green-light': '#D4E680',
          orange:    '#FF6500',
          'orange-light': '#FFE0CC',
          gray: {
            50:  '#F5F5F5',
            100: '#EBEBEB',
            200: '#D4D4D4',
            400: '#9A9A9A',
            600: '#666666',
            700: '#333333',
            900: '#1A1A1A',
          }
        }
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      }
    }
  }
}
```

### 5.3 Landing page — Landing.tsx

Generate a complete, production-quality German landing page with these sections:

**Navbar:**
- Logo: "AnzeigenBoost" with a green lightning bolt icon
- Links: Funktionen, Preise, FAQ
- Buttons: "Anmelden" (outline), "Kostenlos starten" (green filled)
- Sticky on scroll with subtle shadow

**Hero section:**
- Headline: "Deine Kleinanzeigen immer ganz oben"
- Subline: "AnzeigenBoost repostet deine Anzeigen automatisch – du musst nichts tun."
- Two CTAs: "Jetzt kostenlos testen" + "Wie es funktioniert ↓"
- Animated mockup: a fake Kleinanzeigen search results page where the top ad
  gets a subtle "glow" effect showing it just got reposted to position #1
- Social proof bar: "Bereits 340 Verkäufer sparen täglich Zeit"

**How it works (3 steps):**
1. "Verbinde dein Konto" — Lock icon — Sicher verschlüsselt
2. "Lege dein Intervall fest" — Calendar icon — Täglich, alle 3 Tage, wöchentlich
3. "Lehne dich zurück" — Sparkles icon — Wir erledigen den Rest

**Features grid (6 cards):**
- Automatisches Reposten
- KI-Optimierung (Titel + Beschreibung verbessern)
- Repost-Zeitplan
- Aktivitäts-Protokoll
- Sicherheit (AES-256 Verschlüsselung)
- Mehrere Anzeigen verwalten

**Pricing table (3 tiers):**

| | Kostenlos | Starter | Pro |
|---|---|---|---|
| Preis | 0 € | 4,99 €/Monat | 12,99 €/Monat |
| Anzeigen | 2 | 10 | Unbegrenzt |
| Reposts/Monat | 10 | 100 | Unbegrenzt |
| KI-Optimierung | — | 50/Monat | Unbegrenzt |
| Priorität-Support | — | — | ✓ |
| CTA | Starten | Jetzt testen | Jetzt testen |

Highlight Starter as "Beliebteste Wahl" with green border.

**"Unterstütze mich" section (SupportMe component):**

```tsx
// This is important — generate this as its own component: SupportMe.tsx
// A warm, personal section on the landing page:
//
// Heading: "☕ Dieses Tool unterstützen"
// Text: "AnzeigenBoost ist ein Seitenprojekt das ich in meiner Freizeit entwickle.
//        Wenn es dir hilft, freue ich mich sehr über eine kleine Unterstützung!"
//
// Two donation buttons side by side:
//
// PayPal button:
//   - Opens paypalDonateUrl from /support/config API in new tab
//   - Style: PayPal blue (#003087 background, white text)
//   - Icon: PayPal logo SVG (inline, simple P shape)
//   - Text: "Mit PayPal unterstützen"
//   - Below: "Sicher & anonym • Jeder Betrag hilft"
//
// Ko-fi button (optional, show only if kofiUrl set):
//   - Opens kofiUrl in new tab
//   - Style: warm orange (#FF5E5B)
//   - Icon: coffee cup emoji via lucide Coffee icon
//   - Text: "Kaffee ausgeben ☕"
//
// GitHub star button:
//   - Opens github URL
//   - Style: dark gray, GitHub Octocat SVG
//   - Text: "Auf GitHub ⭐ geben"
//
// Small disclaimer: "Du wirst zu PayPal/Ko-fi weitergeleitet.
//                    Keine Daten werden an Dritte weitergegeben."
//
// The whole section has a warm cream/light background to stand out.
// Use a subtle hand-drawn style border or dashed border for personality.
```

**FAQ (6 questions):**
- Sind meine Zugangsdaten sicher?
- Verletzt das die Kleinanzeigen-Nutzungsbedingungen?
- Was passiert wenn mein Repost fehlschlägt?
- Kann ich das Intervall jederzeit ändern?
- Wie kündige ich?
- Funktioniert das auch auf dem Handy?

**Footer:**
- Links: Impressum, Datenschutz, AGB, Kontakt
- "Made with ♥ in Germany"
- Social icons

### 5.4 App dashboard pages

**Dashboard.tsx:**
- Top stats row: Total Anzeigen, Heute fällig, Reposts diesen Monat, Erfolgsrate %
- "Demnächst" timeline: next 7 days repost schedule
- Bar chart (Recharts): repost history last 30 days (success=green, failed=red)
- Recent activity feed (last 10 repostLogs)
- KI-Assistent teaser card: "Lass KI deinen Titel verbessern →" (links to AI page)

**Ads.tsx:**
- Top bar: "Anzeigen synchronisieren" button + "Anzeige hinzufügen" button
- Table columns: Bild, Titel, Preis, Intervall, Nächster Repost, Status, Aktionen
- Status badges: aktiv (green), pausiert (gray), fehler (red), ausstehend (yellow)
- Row actions: Jetzt reposten, Pausieren/Fortsetzen, KI-Optimierung, Löschen
- Inline expansion: click row to see description + image thumbnails
- Empty state: "Noch keine Anzeigen. Synchronisiere deinen Kleinanzeigen-Account."

**AiAssistant.tsx:**
- Split layout: left = chat interface, right = ad selector + results panel
- Chat interface (AiChat.tsx component):
  - Message history with user/assistant bubbles
  - Input box at bottom: "Frag mich zu deinen Anzeigen..."
  - Streaming response (SSE) — show typing indicator dots while streaming
  - Suggested prompts: "Optimiere meine beste Anzeige", "Welche Anzeige läuft am schlechtesten?", "Wie kann ich mehr verkaufen?"
- Right panel: "Anzeige optimieren"
  - Dropdown to select which ad to optimize
  - "Titel optimieren" button → shows before/after comparison
  - "Preis vorschlagen" button → shows market price range
  - "Übernehmen" button to apply AI suggestions to the ad
- Token usage bar: "KI-Kontingent: 3.200 / 50.000 Tokens diesen Monat"

**Settings.tsx:**
- Account section: Name, Email, Passwort ändern
- Kleinanzeigen-Verbindung:
  - If not connected: form with email + password fields
    - "Verbindung herstellen" button
    - Security notice with lock icon: "Ende-zu-Ende verschlüsselt mit AES-256"
  - If connected: green checkmark badge "Verbunden seit [date]"
    - "Verbindung testen" button
    - "Verbindung trennen" (red)
- Plan & Abrechnung: current plan, usage bars, upgrade CTA
- "Unterstütze mich" card (reuse SupportMe component)
- Benachrichtigungen: toggles for email on repost success/failure
- Gefahrenzone: "Konto löschen" (red, requires confirmation)

**Schedule.tsx:**
- Month calendar view
- Each day: colored dots showing how many reposts that day
- Click a day: slide-out panel with list of ads reposting that day
- "Nächste 30 Tage" list view toggle

**Logs.tsx:**
- Table: Datum, Anzeige, Status, Dauer, Fehler (if any)
- Filter: by date range, by ad, by status
- Export CSV button

### 5.5 API client

```typescript
// frontend/src/api/client.ts
// axios instance with:
// - baseURL: import.meta.env.VITE_API_URL
// - withCredentials: true (for refresh token cookie)
// - Request interceptor: inject Authorization: Bearer <accessToken from Zustand>
// - Response interceptor:
//     on 401: call POST /auth/refresh, update Zustand store, retry original request
//     on 403: navigate to /login, clear auth state
//     on network error: show toast notification

// Generate typed React Query hooks for every endpoint listed in section 3.3
// Name them: useAds, useAd, useCreateAd, usePatchAd, useDeleteAd,
//            useRepostNow, usePauseAd, useResumeAd, useSyncAds,
//            useCredentialStatus, useSaveCredentials, useVerifyCredentials,
//            useSchedule, useLogs, useDashboardStats,
//            useOptimizeAd, useSuggestPrice, useAiChat, useAiUsage,
//            useSupportConfig
```

### 5.6 Auth store (Zustand)

```typescript
// frontend/src/store/auth.store.ts
interface AuthStore {
  accessToken: string | null;
  user: { uid: string; email: string; plan: string; displayName?: string } | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthStore['user']) => void;
  clearAuth: () => void;
  updateUser: (partial: Partial<AuthStore['user']>) => void;
}
// Persist to sessionStorage (not localStorage — clears on tab close for security)
```

---

## 6. DOCKER

### 6.1 automation/Dockerfile

```dockerfile
FROM mcr.microsoft.com/playwright:v1.44.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### 6.2 backend/Dockerfile

```dockerfile
# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: run
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 6.3 frontend/Dockerfile

```dockerfile
# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: serve
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 6.4 frontend/nginx.conf

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://backend:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  gzip on;
  gzip_types text/plain text/css application/json application/javascript;
}
```

### 6.5 docker-compose.yml (local dev)

```yaml
version: '3.9'
services:
  backend:
    build: ./backend
    ports: ["3000:3000"]
    env_file: ./backend/.env
    volumes:
      - ./backend/src:/app/src
    networks: [anzeigenboost]
    depends_on: [automation]

  frontend:
    build: ./frontend
    ports: ["5173:80"]
    env_file: ./frontend/.env
    networks: [anzeigenboost]

  automation:
    build: ./automation
    ports: ["3001:3001"]
    env_file: ./automation/.env
    networks: [anzeigenboost]
    # No external port exposure — only reachable from backend

networks:
  anzeigenboost:
    driver: bridge
```

### 6.6 docker-compose.prod.yml (VPS)

```yaml
version: '3.9'
services:
  backend:
    image: ghcr.io/YOURUSERNAME/anzeigenboost-backend:latest
    restart: always
    env_file: /opt/anzeigenboost/.env.backend
    networks: [anzeigenboost]
    expose: ["3000"]

  frontend:
    image: ghcr.io/YOURUSERNAME/anzeigenboost-frontend:latest
    restart: always
    ports: ["80:80", "443:443"]
    volumes:
      - certbot-www:/var/www/certbot
      - certbot-conf:/etc/letsencrypt
    networks: [anzeigenboost]

  automation:
    image: ghcr.io/YOURUSERNAME/anzeigenboost-automation:latest
    restart: always
    env_file: /opt/anzeigenboost/.env.automation
    networks: [anzeigenboost]
    # NOT exposed externally — Docker network only

  certbot:
    image: certbot/certbot
    volumes:
      - certbot-www:/var/www/certbot
      - certbot-conf:/etc/letsencrypt

volumes:
  certbot-www:
  certbot-conf:

networks:
  anzeigenboost:
    driver: bridge
```

---

## 7. GITHUB ACTIONS

### .github/workflows/ci.yml

```yaml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Lint & test backend
        run: cd backend && npm ci && npm run lint && npm run test
      - name: Lint frontend
        run: cd frontend && npm ci && npm run lint
      - name: Build check automation
        run: cd automation && npm ci && npm run build
```

### .github/workflows/deploy.yml

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and push backend
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/anzeigenboost-backend:latest
      - name: Build and push frontend
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/anzeigenboost-frontend:latest
      - name: Build and push automation
        uses: docker/build-push-action@v5
        with:
          context: ./automation
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/anzeigenboost-automation:latest
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/anzeigenboost
            docker-compose -f docker-compose.prod.yml pull
            docker-compose -f docker-compose.prod.yml up -d --remove-orphans
            docker system prune -f
      - name: Health check
        run: sleep 15 && curl -f https://anzeigenboost.de/api/health || exit 1
```

---

## 8. ENVIRONMENT VARIABLES

### backend/.env.example

```env
NODE_ENV=production
PORT=3000

# JWT — generate with: openssl rand -hex 64
JWT_SECRET=REPLACE_WITH_64_CHAR_HEX
JWT_REFRESH_SECRET=REPLACE_WITH_DIFFERENT_64_CHAR_HEX
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Encryption — generate with: openssl rand -hex 32
ENCRYPTION_KEY=REPLACE_WITH_32_BYTE_HEX

# Firebase — from Firebase Console > Project Settings > Service Account
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXX\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

# Internal services
AUTOMATION_SERVICE_URL=http://automation:3001
AUTOMATION_INTERNAL_SECRET=REPLACE_WITH_32_CHAR_RANDOM

# OpenAI
OPENAI_API_KEY=sk-...

# CORS
FRONTEND_URL=https://anzeigenboost.de

# Donations
PAYPAL_DONATE_URL=https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID
KOFI_URL=https://ko-fi.com/yourusername
GITHUB_URL=https://github.com/yourusername/anzeigenboost
```

### frontend/.env.example

```env
VITE_API_URL=https://anzeigenboost.de/api
VITE_APP_NAME=AnzeigenBoost
VITE_APP_VERSION=1.0.0
```

### automation/.env.example

```env
PORT=3001
AUTOMATION_INTERNAL_SECRET=REPLACE_WITH_SAME_SECRET_AS_BACKEND
NODE_ENV=production
```

---

## 9. SECURITY IMPLEMENTATION CHECKLIST

Implement ALL of the following:

- [ ] AES-256-GCM credential encryption (section 3.4) — unique IV per write
- [ ] JWT access tokens (15min) + httpOnly refresh cookies (7 days)
- [ ] bcrypt password hashing (rounds: 12)
- [ ] Automation service only on internal Docker network, X-Internal-Secret header
- [ ] Helmet.js on all routes
- [ ] CORS: only FRONTEND_URL
- [ ] Rate limiting: @nestjs/throttler — 5 req/min auth, 60 req/min API
- [ ] Global ValidationPipe with whitelist:true, forbidNonWhitelisted:true
- [ ] Resource ownership guard: every controller checks req.user.uid === resource.userId
- [ ] Firestore security rules: allow read, write: if request.auth.uid == resource.data.userId
- [ ] Never log password, encryptedPassword, ENCRYPTION_KEY, sessionCookies
- [ ] HTTPS redirect in nginx prod config + HSTS header
- [ ] npm audit in CI pipeline
- [ ] .env files in .gitignore (verify this explicitly)
- [ ] Secrets only via GitHub Secrets, never hardcoded

---

## 10. AI INTEGRATION — HOW IT FITS IN

The AI layer has 4 concrete features. Generate all of them:

### Feature 1: Ad title + description optimizer
- Button "KI-Optimierung" on each ad row in Ads.tsx
- Calls POST /ai/optimize-ad → GPT-4o-mini improves German ad copy
- Shows before/after diff in a modal
- "Übernehmen" saves optimized version, "Ablehnen" discards

### Feature 2: Price suggester
- Button "Preis prüfen" on ad detail
- Calls POST /ai/suggest-price
- Returns { suggestedPrice, minPrice, maxPrice, reasoning }
- Shows as a price range bar with the current price marked

### Feature 3: AI chat assistant (AiAssistant.tsx)
- Floating chat bubble in bottom-right corner of all dashboard pages
- Streams responses via SSE (EventSource)
- Injected context per message: user's ads list, last 7 days stats
- Example queries it handles:
  - "Welche Anzeige soll ich als nächstes optimieren?"
  - "Warum schlägt mein Repost fehl?"
  - "Schreib mir eine bessere Beschreibung für mein iPhone"

### Feature 4: Smart repost timing (Pro plan only)
- AI analyzes repostLogs to find which time-of-day + day-of-week gets most views
- Suggests optimal repost schedule for each ad
- Future: integrate with Kleinanzeigen's ad view counter (scraped from ad stats page)

### Token cost management
- GPT-4o-mini: ~$0.00015/1K input tokens, ~$0.00060/1K output tokens
- A typical optimize-ad call: ~500 tokens = $0.00008 per call (essentially free)
- Monthly token limits enforced in backend (aiUsage Firestore collection)
- Free: 5,000 tokens/mo (≈60 optimize calls)
- Starter: 50,000 tokens/mo (≈600 calls)
- Pro: 500,000 tokens/mo (≈6,000 calls)

---

## 11. PAYPAL DONATION SETUP INSTRUCTIONS

Include these exact steps in README.md:

```
## Setting up PayPal Donate button

1. Go to https://www.paypal.com/donate/buttons
2. Log in to your PayPal account (create one if needed — free)
3. Create a donation button:
   - Button type: Donate
   - Organization name: AnzeigenBoost
   - Purpose: Unterstützung des Projekts
   - No fixed amount (let donors choose)
4. Copy the "hosted_button_id" from the generated HTML
5. Your donate URL will be:
   https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID
6. Set PAYPAL_DONATE_URL in backend .env

## Optional: Ko-fi (even simpler)
1. Create free account at ko-fi.com
2. Your URL is simply: https://ko-fi.com/yourusername
3. Set KOFI_URL in backend .env
```

---

## 12. DOMAIN + VPS SETUP (include in README)

```
## Domain
Register anzeigenboost.de at:
- Hetzner (recommended, German company, GDPR-friendly): domain.hetzner.com
- IONOS: ionos.de
- Cost: ~€12/year for .de

## VPS
Provider: Hetzner Cloud (hetzner.com/cloud)
Server: CX22 (2 vCPU, 4 GB RAM, 40 GB SSD) — €4.51/month
Location: Nuremberg or Falkenstein (Germany — fast for .de users, GDPR compliant)
OS: Ubuntu 22.04 LTS

## First-time VPS setup
ssh root@YOUR_VPS_IP
apt update && apt upgrade -y
apt install -y docker.io docker-compose git
systemctl enable docker
mkdir -p /opt/anzeigenboost
cd /opt/anzeigenboost
git clone https://github.com/yourusername/anzeigenboost .
# Copy .env files
docker-compose -f docker-compose.prod.yml up -d

## SSL (Let's Encrypt)
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d anzeigenboost.de -d www.anzeigenboost.de \
  --email your@email.com --agree-tos

## Monthly cost summary at launch
VPS CX22:          €4.51/mo
Domain .de:        €1.00/mo (€12/year)
Firebase Spark:    €0.00 (free tier)
OpenAI API:        ~€2-5/mo (light usage)
Email (Resend):    €0.00 (100 emails/day free)
Total:             ~€8-11/month
```

---

## 13. MONETIZATION ROADMAP

### Month 1-2: Free launch + validation
- Launch free tier (2 ads)
- Post in: Facebook "Kleinanzeigen Verkäufer" groups, r/de, r/finanzen
- Make a 60-second screen recording showing before/after (views increase)
- Goal: 100 free users, 10 honest reviews

### Month 2-3: Paid tier launch
- Offer 50 lifetime deals at €49 one-time (use Lemon Squeezy, no Stripe setup needed)
- This generates €2,450 fast and creates advocates
- Use Lemon Squeezy (easier than Stripe for solopreneurs, handles EU VAT automatically)

### Month 3-6: SEO content
- Blog at anzeigenboost.de/blog (add to React Router)
- Target keywords (low competition, high intent):
  - "Kleinanzeigen Anzeige oben halten" — 320 searches/mo
  - "Kleinanzeigen Anzeige automatisch erneuern" — 210 searches/mo
  - "Kleinanzeigen mehr Sichtbarkeit" — 590 searches/mo
- Each article: 1,000 words, German, practical tips, ends with CTA

### Month 6+: Scale
- Add Willhaben.at (Austria) — same codebase, new automation scripts
- Add Ricardo.ch (Switzerland)
- Browser extension (Chrome): repost button directly on Kleinanzeigen pages
- B2B: agencies managing 50+ ads/month → enterprise plan €49/mo

### Revenue projections
```
50 users  @ avg €6/mo = €300 MRR  (break even)
200 users @ avg €6/mo = €1,200 MRR
500 users @ avg €7/mo = €3,500 MRR
1000 users @ avg €8/mo = €8,000 MRR

Costs at 1000 users:
- VPS upgrade CX41: €15/mo
- Firebase Blaze: ~€20/mo
- OpenAI: ~€30/mo
- Stripe/Lemon Squeezy fees (~3%): ~€240/mo
- Total costs: ~€305/mo
- Net profit at 1000 users: ~€7,700/mo
```

### Acquisition value
At €5k MRR with <5% monthly churn:
- Acquire.com / MicroAcquire valuation: 24-36x MRR = €120,000 - €180,000
- Keep clean bookkeeping from day 1 (just a spreadsheet is fine)

---

## 14. LEGAL PAGES (German law — required)

Generate these as React pages with real placeholder content:

**Impressum.tsx** — required by §5 TMG:
- Vollständiger Name des Betreibers
- Anschrift
- Kontakt: E-Mail + Telefon (or contact form link)
- Hinweis: "Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV"

**Datenschutz.tsx** — GDPR §13 DSGVO:
- Controller identity
- What data is collected (email, encrypted credentials, usage logs)
- Why (service provision)
- Firebase (data processor) — mention Alphabet Inc.
- Stripe/Lemon Squeezy (payment processor)
- OpenAI (AI features, data not used for training)
- User rights: access, deletion, portability
- Contact for DSGVO requests
- "Deine Kleinanzeigen-Zugangsdaten werden AES-256 verschlüsselt und niemals
   im Klartext gespeichert oder weitergegeben."

**AGB.tsx** — Terms of service:
- Acceptable use (no spam, no fake ads, personal accounts only)
- Subscription: monthly, cancel anytime, no refund for started period
- Liability: tool provided "as is", no guarantee if Kleinanzeigen changes their platform
- Account deletion: data purged within 30 days

---

## 15. README.md

Generate a complete README with:
1. Project description + screenshot placeholder
2. Features list
3. Tech stack diagram (ASCII)
4. Local development (step by step, copy-paste commands)
5. Environment variables table
6. VPS deployment guide (section 12)
7. AI features documentation
8. Contributing guide
9. License: MIT
10. "Support this project" section with PayPal + Ko-fi links

