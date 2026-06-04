FROM mcr.microsoft.com/playwright:v1.44.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install Xvfb for non-headless browser support (visible login on headless VPS)
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 3001

# Use xvfb-run to provide a virtual X display so Playwright can open visible windows
ENV DISPLAY=:99
CMD ["xvfb-run", "--server-args=-screen 0 1280x800x24", "node", "dist/index.js"]

