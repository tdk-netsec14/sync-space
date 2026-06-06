# server/Dockerfile

# 1. Base Image
FROM node:20-alpine

# 2. Set Working Directory
WORKDIR /usr/src/app

# 3. Copy Package Files
COPY package*.json ./

# 4. Install Dependencies
RUN npm ci --only=production

# 5. Copy Source Code
COPY . .

# 6. Expose Port
EXPOSE 5000

# 7. Define Environment Variables (defaults, usually overridden at runtime)
ENV NODE_ENV=production
ENV PORT=5000

# 8. Start the Server
CMD ["node", "index.js"]
