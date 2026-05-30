FROM mcr.microsoft.com/playwright:v1.44.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
EXPOSE 3001
CMD ["node", "dist/index.js"]
