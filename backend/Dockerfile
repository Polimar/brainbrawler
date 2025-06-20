FROM node:18-alpine

# Installa dependencies per Prisma
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy package files first per cache optimization
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Development command con nodemon per hot reload
CMD ["npm", "run", "dev"]
