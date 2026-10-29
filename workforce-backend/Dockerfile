FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
# UK project time: pin the container system clock so server-local Date calls,
# logs and maintenance timers run in Europe/London.
# Fontconfig + DejaVu are required for the screenshot contact-sheet captions:
# without them librsvg renders every label as missing-glyph boxes.
RUN apk add --no-cache tzdata fontconfig font-dejavu
ENV TZ=Europe/London
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 5000
CMD ["npm", "start"]
