FROM node:18-alpine

# Prevent Railway from using Nginx
ENV NGINX_ENTRYPOINT_QUIET_LOGS=0

WORKDIR /app

# Copy only package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Expose the port
EXPOSE 3001

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Start the server
CMD ["node", "index.js"]
