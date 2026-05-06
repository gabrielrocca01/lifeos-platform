# Stage 1 — build Angular
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2 — serve con nginx
FROM nginx:alpine

COPY --from=builder /app/dist/finance-os-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
