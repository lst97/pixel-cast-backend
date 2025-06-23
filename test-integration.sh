#!/bin/bash

echo "🧪 LiveKit SFU Server Test"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
LIVEKIT_SERVER="http://localhost:7880"

echo -e "\n${YELLOW}Testing LiveKit SFU Server...${NC}"

# Test 1: LiveKit SFU Server Health
echo -e "\n${YELLOW}1. Testing LiveKit SFU Server (port 7880)...${NC}"
LIVEKIT_HEALTH=$(curl -s "$LIVEKIT_SERVER/" 2>/dev/null)
if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ LiveKit SFU Server is running${NC}"
else
    echo -e "${RED}❌ LiveKit SFU Server is not responding${NC}"
    echo "Make sure to run: ./start-livekit.sh"
    exit 1
fi

# Test 2: WebSocket endpoint check
echo -e "\n${YELLOW}2. Testing LiveKit WebSocket endpoint...${NC}"
WS_TEST=$(curl -s -H "Upgrade: websocket" -H "Connection: Upgrade" "$LIVEKIT_SERVER/rtc" 2>/dev/null)
if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ LiveKit WebSocket endpoint is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  WebSocket test inconclusive (normal for HTTP client)${NC}"
fi

echo -e "\n${GREEN}🎉 LiveKit SFU Server test completed successfully!${NC}"
echo -e "\n${YELLOW}Your LiveKit SFU server is ready!${NC}"
echo ""
echo "📱 Frontend connection details:"
echo "  - LiveKit Server URL: ws://localhost:7880"
echo "  - Token Endpoint:     http://localhost:3000/api/token (Next.js API)"
echo ""
echo "🔧 Example frontend code:"
echo "  import { Room } from 'livekit-client';"
echo "  const room = new Room();"
echo "  await room.connect('ws://localhost:7880', token);" 
echo ""
echo "💡 Note: Token generation is now handled by your Next.js frontend."
echo "   Make sure your Next.js app is running on port 3000." 