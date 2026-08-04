FROM node:22-alpine

# Prevent Railway from using Nginx
ENV NGINX_ENTRYPOINT_QUIET_LOGS=0

WORKDIR /app

# Copy only package files first for deterministic dependency caching
COPY package*.json ./

# Install production dependencies from the lockfile
RUN npm ci --omit=dev

# Copy server source
COPY . .

# Railway provides PORT at runtime; 8080 is the local/container default
EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "index.js"]
