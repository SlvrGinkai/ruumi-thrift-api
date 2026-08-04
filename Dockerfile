# Use Node.js 22 LTS
FROM node:22-alpine

# Create application directory
WORKDIR /app

# Copy package.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the project
COPY . .

# Expose the future API port
EXPOSE 3000

# Keep the container alive for now
CMD ["tail", "-f", "/dev/null"]