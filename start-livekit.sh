#!/bin/bash

echo "🚀 Starting LiveKit SFU Server"
echo "=============================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "\n${YELLOW}Starting LiveKit SFU Server...${NC}"
echo "This will start:"
echo "  - LiveKit SFU Server on port 7880 (WebRTC/HTTP)"
echo ""
echo "Note: Token generation is now handled by the Next.js frontend API"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start the services
docker-compose up -d

echo -e "\n${GREEN}✅ LiveKit SFU Server started!${NC}"
echo ""
echo "🎯 Endpoints:"
echo "  - LiveKit SFU:    ws://localhost:7880"
echo ""
echo "📱 In your frontend, use:"
echo "  - Server URL:     ws://localhost:7880"
echo "  - Token Endpoint: http://localhost:3000/api/token (Next.js API)"
echo ""
echo "🔍 To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "🛑 To stop:"
echo "  docker-compose down" 