#!/bin/bash

echo "🧪 TURN Server Connectivity Test"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "\n${BLUE}🔍 Testing: ${test_name}${NC}"
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS: ${test_name}${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL: ${test_name}${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to test port connectivity
test_port() {
    local port="$1"
    local protocol="$2"
    local description="$3"
    
    echo -e "\n${BLUE}🔍 Testing: ${description} (${protocol}:${port})${NC}"
    
    if command -v nc >/dev/null 2>&1; then
        if [ "$protocol" = "tcp" ]; then
            if timeout 3 nc -z localhost "$port" 2>/dev/null; then
                echo -e "${GREEN}✅ PASS: ${description} - Port ${port}/${protocol} is open${NC}"
                ((TESTS_PASSED++))
                return 0
            fi
        elif [ "$protocol" = "udp" ]; then
            if timeout 3 nc -u -z localhost "$port" 2>/dev/null; then
                echo -e "${GREEN}✅ PASS: ${description} - Port ${port}/${protocol} is open${NC}"
                ((TESTS_PASSED++))
                return 0
            fi
        fi
    elif command -v telnet >/dev/null 2>&1 && [ "$protocol" = "tcp" ]; then
        if timeout 3 telnet localhost "$port" 2>/dev/null | grep -q "Connected"; then
            echo -e "${GREEN}✅ PASS: ${description} - Port ${port}/${protocol} is open${NC}"
            ((TESTS_PASSED++))
            return 0
        fi
    else
        echo -e "${YELLOW}⚠️  SKIP: ${description} - No suitable tool (nc/telnet) available${NC}"
        return 0
    fi
    
    echo -e "${RED}❌ FAIL: ${description} - Port ${port}/${protocol} is not accessible${NC}"
    ((TESTS_FAILED++))
    return 1
}

echo -e "\n${YELLOW}Starting TURN Server Tests...${NC}"

# Test 1: Check if Docker is running
run_test "Docker service" "docker info"

# Test 2: Check if LiveKit container is running
run_test "LiveKit container running" "docker-compose ps | grep -q 'livekit.*Up'"

# Test 3: Check LiveKit container health
echo -e "\n${BLUE}🔍 Testing: LiveKit container health${NC}"
if docker-compose ps | grep -q "livekit.*Up"; then
    echo -e "${GREEN}✅ PASS: LiveKit container is running${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL: LiveKit container is not running${NC}"
    echo "Try running: docker-compose up -d"
    ((TESTS_FAILED++))
fi

# Test 4-8: Port connectivity tests
test_port "7880" "tcp" "LiveKit HTTP/WebSocket"
test_port "7881" "tcp" "LiveKit RTC TCP"
test_port "3478" "udp" "TURN UDP"
test_port "3478" "tcp" "TURN TCP"
test_port "5349" "tcp" "TURN TLS"

# Test 9: Check LiveKit logs for TURN-related messages
echo -e "\n${BLUE}🔍 Testing: LiveKit server startup logs${NC}"
if docker-compose logs livekit 2>/dev/null | grep -q "starting LiveKit server"; then
    echo -e "${GREEN}✅ PASS: LiveKit server started successfully${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL: LiveKit server startup issues detected${NC}"
    echo "Check logs with: docker-compose logs livekit"
    ((TESTS_FAILED++))
fi

# Test 10: TURN server configuration validation
echo -e "\n${BLUE}🔍 Testing: TURN server configuration${NC}"
if grep -q "enabled: true" livekit.yaml && grep -q "secret:" livekit.yaml; then
    echo -e "${GREEN}✅ PASS: TURN server is enabled in configuration${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL: TURN server configuration issues${NC}"
    ((TESTS_FAILED++))
fi

# Test 11: Create a simple WebRTC test HTML file for manual testing
echo -e "\n${BLUE}🔍 Creating: WebRTC connectivity test file${NC}"
cat > webrtc-test.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>WebRTC TURN Server Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .result { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .success { background-color: #d4edda; color: #155724; }
        .error { background-color: #f8d7da; color: #721c24; }
        .info { background-color: #d1ecf1; color: #0c5460; }
        button { padding: 10px 20px; margin: 5px; }
    </style>
</head>
<body>
    <h1>WebRTC TURN Server Test</h1>
    <button onclick="testICEServers()">Test ICE Servers</button>
    <button onclick="testSTUN()">Test STUN</button>
    <button onclick="testTURN()">Test TURN</button>
    <div id="results"></div>

    <script>
        function log(message, type = 'info') {
            const results = document.getElementById('results');
            const div = document.createElement('div');
            div.className = `result ${type}`;
            div.textContent = new Date().toLocaleTimeString() + ': ' + message;
            results.appendChild(div);
        }

        async function testICEServers() {
            log('Testing ICE servers configuration...', 'info');
            
            const iceServers = [
                { urls: 'stun:localhost:3478' },
                { urls: 'turn:localhost:3478', username: '', credential: '' }
            ];

            try {
                const pc = new RTCPeerConnection({ iceServers });
                
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        log(`ICE Candidate: ${event.candidate.candidate}`, 'success');
                    } else {
                        log('ICE gathering complete', 'success');
                    }
                };

                pc.onicegatheringstatechange = () => {
                    log(`ICE Gathering State: ${pc.iceGatheringState}`, 'info');
                };

                // Create a data channel to trigger ICE gathering
                pc.createDataChannel('test');
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                
                log('ICE gathering started...', 'info');
                
                setTimeout(() => {
                    pc.close();
                    log('Test completed', 'info');
                }, 5000);
                
            } catch (error) {
                log(`Error: ${error.message}`, 'error');
            }
        }

        async function testSTUN() {
            log('Testing STUN server...', 'info');
            
            try {
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:localhost:3478' }]
                });
                
                pc.onicecandidate = (event) => {
                    if (event.candidate && event.candidate.candidate.includes('srflx')) {
                        log('STUN server working - Server reflexive candidate found!', 'success');
                    }
                };

                pc.createDataChannel('stun-test');
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                
                setTimeout(() => {
                    pc.close();
                }, 3000);
                
            } catch (error) {
                log(`STUN test error: ${error.message}`, 'error');
            }
        }

        async function testTURN() {
            log('Testing TURN server...', 'info');
            
            try {
                const pc = new RTCPeerConnection({
                    iceServers: [{ 
                        urls: 'turn:localhost:3478',
                        username: '',
                        credential: ''
                    }]
                });
                
                pc.onicecandidate = (event) => {
                    if (event.candidate && event.candidate.candidate.includes('relay')) {
                        log('TURN server working - Relay candidate found!', 'success');
                    }
                };

                pc.createDataChannel('turn-test');
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                
                setTimeout(() => {
                    pc.close();
                }, 3000);
                
            } catch (error) {
                log(`TURN test error: ${error.message}`, 'error');
            }
        }

        // Auto-run basic test on page load
        window.onload = () => {
            log('WebRTC TURN Test Page Loaded', 'info');
            log('Click buttons above to test different aspects of the TURN server', 'info');
        };
    </script>
</body>
</html>
EOF

echo -e "${GREEN}✅ PASS: WebRTC test file created (webrtc-test.html)${NC}"
((TESTS_PASSED++))

# Test 12: Network connectivity test using curl
echo -e "\n${BLUE}🔍 Testing: LiveKit HTTP endpoint${NC}"
if command -v curl >/dev/null 2>&1; then
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:7880 | grep -q "404\|200\|400"; then
        echo -e "${GREEN}✅ PASS: LiveKit HTTP endpoint is responding${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL: LiveKit HTTP endpoint not responding${NC}"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${YELLOW}⚠️  SKIP: HTTP endpoint test - curl not available${NC}"
fi

# Summary
echo -e "\n${YELLOW}===============================${NC}"
echo -e "${YELLOW}Test Summary${NC}"
echo -e "${YELLOW}===============================${NC}"
echo -e "${GREEN}Tests Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Tests Failed: ${TESTS_FAILED}${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! TURN server appears to be working correctly.${NC}"
    echo -e "\n${BLUE}📝 Next steps:${NC}"
    echo "1. Open webrtc-test.html in your browser to test WebRTC connectivity"
    echo "2. Test with multiple users in your application"
    echo "3. Monitor logs: docker-compose logs livekit -f"
else
    echo -e "\n${RED}⚠️  Some tests failed. Please check the configuration.${NC}"
    echo -e "\n${BLUE}📝 Troubleshooting:${NC}"
    echo "1. Ensure Docker is running: docker-compose up -d"
    echo "2. Check logs: docker-compose logs livekit"
    echo "3. Verify ports are not blocked by firewall"
    echo "4. Restart services: ./restart-livekit.sh"
fi

echo -e "\n${BLUE}📋 Manual Testing:${NC}"
echo "1. Open webrtc-test.html in your browser"
echo "2. Click 'Test ICE Servers' to verify WebRTC connectivity"
echo "3. Check browser console for detailed WebRTC logs"

exit $TESTS_FAILED 