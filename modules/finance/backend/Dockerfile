FROM node:20-alpine

WORKDIR /app

# Dipendenze prima (cache layer)
COPY package*.json ./
RUN npm ci --only=production

# Sorgenti
COPY . .

# Compila TypeScript
RUN npm run build

# Cartella dati persistente
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/index.js"]
