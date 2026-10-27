FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SCREEN_MONITOR_WS_URL
ARG NEXT_PUBLIC_BUSINESS_TIME_ZONE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SCREEN_MONITOR_WS_URL=$NEXT_PUBLIC_SCREEN_MONITOR_WS_URL
ENV NEXT_PUBLIC_BUSINESS_TIME_ZONE=$NEXT_PUBLIC_BUSINESS_TIME_ZONE
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
# UK project time: pin the container system clock to Europe/London.
RUN apk add --no-cache tzdata
ENV TZ=Europe/London
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/app ./app
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/types ./types
EXPOSE 3000
CMD ["npm", "run", "start"]
