FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CALENDLY_URL
ARG NEXT_PUBLIC_WHATSAPP_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_CALENDLY_URL=$NEXT_PUBLIC_CALENDLY_URL
ENV NEXT_PUBLIC_WHATSAPP_URL=$NEXT_PUBLIC_WHATSAPP_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/app ./app
COPY --from=builder /app/components ./components
COPY --from=builder /app/lib ./lib
EXPOSE 3001
CMD ["npm", "run", "start"]
