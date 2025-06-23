# TURN Server Testing Guide

This guide provides comprehensive testing tools to verify that your TURN server is working correctly and can handle WebRTC connections.

## 🧪 Available Test Tools

### 1. **Bash Test Script** (`test-turn-server.sh`)

Comprehensive shell-based test that checks:

- Docker container status
- Port connectivity
- LiveKit server logs
- Configuration validation
- Creates WebRTC test HTML file

**Usage:**

```bash
./test-turn-server.sh
```

### 2. **Node.js Test Script** (`test-turn-connectivity.js`)

Programmatic connectivity test using Node.js:

- Fast port connectivity checks
- Docker container verification
- Cleaner output format

**Usage:**

```bash
node test-turn-connectivity.js
```

### 3. **WebRTC Browser Test** (`webrtc-test.html`)

Interactive browser-based test for real WebRTC functionality:

- ICE candidate gathering
- STUN/TURN server verification
- Real-time connectivity analysis

**Usage:**

```bash
# Open in your browser
open webrtc-test.html
# or
python3 -m http.server 8000
# Then visit: http://localhost:8000/webrtc-test.html
```

## 🚀 Quick Test Commands

### Run All Tests

```bash
# Basic connectivity test
node test-turn-connectivity.js

# Comprehensive test (creates WebRTC test file)
./test-turn-server.sh

# Then open the browser test
open webrtc-test.html
```

### Individual Tests

```bash
# Check if services are running
docker-compose ps

# Check LiveKit logs
docker-compose logs livekit

# Test specific ports
nc -z localhost 7880  # LiveKit HTTP
nc -z localhost 3478  # TURN TCP
nc -u -z localhost 3478  # TURN UDP
```

## 📊 Test Results Interpretation

### ✅ **All Tests Pass**

- TURN server is properly configured
- All required ports are accessible
- Ready for multi-user WebRTC connections

### ⚠️ **Some Port Tests Fail**

- This is often normal for UDP ports with certain network tools
- The important thing is that LiveKit responds on HTTP (7880)
- Run the browser test for definitive WebRTC functionality

### ❌ **Docker/LiveKit Tests Fail**

- Ensure Docker is running: `docker --version`
- Start services: `docker-compose up -d`
- Check logs: `docker-compose logs livekit`

## 🌐 Browser Testing (Most Important)

The WebRTC browser test (`webrtc-test.html`) is the most accurate test because it uses the actual WebRTC APIs that your application will use.

### Key Test Buttons

1. **Test ICE Servers** - Verifies both STUN and TURN
2. **Test STUN** - Checks STUN server specifically  
3. **Test TURN** - Checks TURN relay functionality

### What to Look For

- **Host candidates** - Local network interfaces
- **STUN candidates (srflx)** - Server reflexive (through NAT)
- **TURN candidates (relay)** - Relayed through TURN server

### Success Indicators

```sh
✅ ICE Candidate: candidate:... typ srflx ...  (STUN working)
✅ ICE Candidate: candidate:... typ relay ...  (TURN working)
```

## 🔧 Troubleshooting Common Issues

### Issue: No ICE Candidates Found

**Solution:**

```bash
# Restart LiveKit services
./restart-livekit.sh

# Check configuration
grep -A 10 "turn:" livekit.yaml
```

### Issue: Only Host Candidates

**Cause:** STUN/TURN servers not accessible
**Solution:**

```bash
# Verify ports are exposed
docker-compose ps
netstat -an | grep -E "(3478|5349)"

# Check firewall settings
sudo ufw status  # Ubuntu/Debian
```

### Issue: WebRTC Test Shows Errors

**Common Causes:**

1. **Mixed content** - Serving over HTTP instead of HTTPS
2. **Browser security** - Some browsers block localhost WebRTC
3. **Network restrictions** - Corporate firewalls

**Solutions:**

```bash
# Serve over HTTPS (for production)
# Or test in Chrome with --disable-web-security flag (development only)

# Alternative: Test with different browsers
# Firefox is often more permissive for localhost testing
```

## 📈 Testing Multiple Users

### Simulation Test

1. Open your frontend application in multiple browser windows/tabs
2. Use different browsers (Chrome, Firefox, Safari)
3. Use incognito/private browsing modes
4. Join the same room from different windows

### Expected Behavior

- All users should connect without "ICE failed" errors
- Video/audio should work between all participants
- Connection should be stable

### Monitor During Testing

```bash
# Watch LiveKit logs in real-time
docker-compose logs livekit -f

# Check active connections
curl -s http://localhost:7880/debug/stats
```

## 🔍 Advanced Debugging

### WebRTC Debug Information

1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for WebRTC-related messages
4. Check `chrome://webrtc-internals/` (Chrome) for detailed stats

### LiveKit Debug Logs

```bash
# Enable debug logging in livekit.yaml
logging:
  level: debug
  pion_level: debug

# Restart and monitor
./restart-livekit.sh
docker-compose logs livekit -f
```

### Network Analysis

```bash
# Check what ports are actually listening
sudo netstat -tulpn | grep -E "(7880|7881|3478|5349)"

# Test external connectivity (if needed)
telnet your-domain.com 3478
```

## 📝 Test Results Log

Keep track of your testing results:

| Test Type | Status | Notes |
|-----------|--------|--------|
| Node.js Connectivity | ✅/❌ | All ports accessible |
| Bash Script | ✅/❌ | Docker + config OK |
| Browser WebRTC | ✅/❌ | ICE candidates found |
| Multi-user Test | ✅/❌ | 2+ users connected |

## 🎯 Production Testing

Before deploying to production:

1. **Test from different networks** (home, office, mobile)
2. **Test with actual domain names** (not localhost)
3. **Test with HTTPS** (required for production WebRTC)
4. **Load test with multiple concurrent users**
5. **Monitor resource usage** during peak load

## 📞 Support

If tests continue to fail:

1. **Check the logs** first: `docker-compose logs livekit`
2. **Verify your network setup** allows the required ports
3. **Test with public STUN servers** as fallback
4. **Consider using external TURN services** for production

The test tools provided should give you confidence that your TURN server is working correctly and ready to handle real WebRTC connections without ICE failures.
