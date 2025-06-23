#!/bin/bash

echo "🔄 Restarting LiveKit with TURN server support"
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "\n${YELLOW}Stopping existing services...${NC}"
docker-compose down

echo -e "\n${YELLOW}Starting services with TURN server enabled...${NC}"
docker-compose up -d

# Wait a moment for services to start
sleep 3

echo -e "\n${GREEN}✅ LiveKit restarted with TURN server support!${NC}"
echo ""
echo "🎯 Configuration:"
echo "  - LiveKit SFU:    ws://localhost:7880"
echo "  - TURN Server:    localhost:3478 (UDP/TCP)"
echo "  - TURN/TLS:       localhost:5349"
echo ""
echo "🔍 To view logs:"
echo "  docker-compose logs -f livekit"
echo ""
echo "🛑 To stop:"
echo "  docker-compose down"
echo ""
echo -e "${GREEN}The ICE connection issues should now be resolved!${NC}" 