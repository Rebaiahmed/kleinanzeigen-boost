# AnzeigenBoost

**AnzeigenBoost** (anzeigenboost.de) — a German-market SaaS that automates Kleinanzeigen.de ad reposting.
"Deine Kleinanzeigen immer ganz oben — vollautomatisch."

![AnzeigenBoost Screenshot Placeholder](https://via.placeholder.com/800x400?text=AnzeigenBoost+Dashboard)

## Features
- **Automatisches Reposten:** Keep your ads at the top of the search results automatically.
- **KI-Optimierung:** Improve titles and descriptions using GPT-4o-mini to attract more buyers.
- **Preis-Vorschläge:** AI-powered market price suggestions.
- **Sicher:** AES-256-GCM encrypted credentials storage.

## Tech Stack
```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│                 │       │                 │       │                 │
│    Frontend     │ ────▶ │     Backend     │ ────▶ │    Automation   │
│                 │       │                 │       │                 │
│ React 18, Vite  │       │   NestJS 10     │       │   Playwright    │
│ TypeScript      │       │ TypeScript      │       │   Node/Express  │
│ TailwindCSS     │       │ Firebase/Auth   │       │   Headless Chrome│
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

## Local Development

### Prerequisites
- Docker & Docker Compose
- Node.js 20+

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/anzeigenboost.git
   cd anzeigenboost
   ```

2. Copy environment files and fill in values (see Environment Variables section):
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   cp automation/.env.example automation/.env
   ```

3. Start services via Docker Compose:
   ```bash
   docker-compose up --build
   ```

4. Access the application:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

## Environment Variables

Check `.env.example` inside `backend/`, `frontend/`, and `automation/` directories for required environment variables. Ensure the internal secrets match between backend and automation.

## AI Features Documentation

AnzeigenBoost uses OpenAI's GPT-4o-mini model to power intelligent features:
1. **Ad Optimization**: Calls `/ai/optimize-ad` to improve German ad copy.
2. **Price Suggestion**: Calls `/ai/suggest-price` to analyze the market and suggest an optimal price range.
3. **AI Chat Assistant**: A floating chat widget (`/ai/chat`) utilizing SSE to provide live ad advice to users.

Monthly token limits are enforced based on the user's subscription tier.

## VPS Deployment

### Domain
Register `anzeigenboost.de` at Hetzner or IONOS.

### VPS Setup
Provider: Hetzner Cloud (CX22 instance recommended)
OS: Ubuntu 22.04 LTS

```bash
# SSH into VPS
ssh root@YOUR_VPS_IP

# Install dependencies
apt update && apt upgrade -y
apt install -y docker.io docker-compose git
systemctl enable docker

# Clone and setup
mkdir -p /opt/anzeigenboost
cd /opt/anzeigenboost
git clone https://github.com/yourusername/anzeigenboost .

# Copy .env files (ensure to rename them appropriately for prod)
# Start services
docker-compose -f docker-compose.prod.yml up -d
```

### SSL Setup
```bash
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d anzeigenboost.de -d www.anzeigenboost.de \
  --email your@email.com --agree-tos
```

## Setting up PayPal Donate button

1. Go to https://www.paypal.com/donate/buttons
2. Log in to your PayPal account
3. Create a donation button (Donate, Organization: AnzeigenBoost, Purpose: Unterstützung des Projekts, No fixed amount)
4. Copy the `hosted_button_id` from the generated HTML
5. Your donate URL: `https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID`
6. Set `PAYPAL_DONATE_URL` in backend `.env`

### Optional: Ko-fi
1. Create free account at ko-fi.com
2. Your URL: `https://ko-fi.com/yourusername`
3. Set `KOFI_URL` in backend `.env`

## Support this project

AnzeigenBoost is a side project developed in free time. If it helps you, consider supporting! ☕
- [Support via PayPal](https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID)
- [Support via Ko-fi](https://ko-fi.com/yourusername)

## Contributing
Contributions are welcome. Please open an issue or pull request.

## License
MIT
