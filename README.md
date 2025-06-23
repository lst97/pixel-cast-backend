# LiveKit SFU Server Setup

A Docker-based setup for running a self-hosted LiveKit SFU (Selective Forwarding Unit) server for real-time media communication.

## 🚀 Overview

This directory contains the configuration and scripts needed to run a LiveKit SFU server. The token generation is now handled by the Next.js frontend API, simplifying the overall architecture.

## 📋 Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- A running Next.js frontend application (for token generation)

## 🛠️ Setup

### 1. Environment Configuration

The LiveKit server requires API keys configured in a `.env` file. A sample file is already provided with development keys:

```env
# LiveKit Configuration
LIVEKIT_API_KEY=RrpSKRlS2w944fJuI9am6w0TFAhWfBlc19iTPWMfRsSzkej05lLR9QZogflnhJJk
LIVEKIT_API_SECRET=7e3c706cd3eec0686d5d130bcefa622402d16b01110c130b8895173796b5186a
LIVEKIT_KEYS=RrpSKRlS2w944fJuI9am6w0TFAhWfBlc19iTPWMfRsSzkej05lLR9QZogflnhJJk: 7e3c706cd3eec0686d5d130bcefa622402d16b01110c130b8895173796b5186a
```

> ⚠️ **For Production**: Generate new keys using `livekit-cli create-api-key` and update the `.env` file.

### 2. Start LiveKit SFU Server

```bash
# Start the LiveKit SFU server
./start-livekit.sh
```

This will start:

- **LiveKit SFU Server** on `ws://localhost:7880` (handles WebRTC connections)

### 3. Verify Server is Running

```bash
# Test the LiveKit server
./test-integration.sh
```

## 📡 Server Configuration

The LiveKit server is configured via `livekit.yaml` and uses the following ports:

- **7880**: HTTP/WebSocket port (main connection)
- **7881**: TURN/TCP port
- **3478/udp**: TURN/UDP port  
- **50000-50020/udp**: ICE/UDP port range

## 🔑 API Keys

The server uses API keys configured in the `.env` file:

```env
LIVEKIT_API_KEY=RrpSKRlS2w944fJuI9am6w0TFAhWfBlc19iTPWMfRsSzkej05lLR9QZogflnhJJk
LIVEKIT_API_SECRET=7e3c706cd3eec0686d5d130bcefa622402d16b01110c130b8895173796b5186a
LIVEKIT_KEYS=RrpSKRlS2w944fJuI9am6w0TFAhWfBlc19iTPWMfRsSzkej05lLR9QZogflnhJJk: 7e3c706cd3eec0686d5d130bcefa622402d16b01110c130b8895173796b5186a
```

> ⚠️ **Security Note**: These are development keys. For production, generate your own secure keys using the LiveKit CLI and update the `.env` file.

## 🏗️ Architecture

```sh
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Next.js API    │    │  LiveKit SFU    │
│   (React)       │◄──►│  Token Server    │    │    Server       │
│                 │    │  /api/token      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        ▲
                                └────────────────────────┘
                                    WebRTC Connection
```

- **Frontend**: React application with LiveKit client
- **Token Server**: Integrated Next.js API route (`/api/token`)
- **LiveKit SFU**: Media server handling WebRTC connections

## 🔧 Frontend Integration

Configure your Next.js frontend to connect to the LiveKit server:

```typescript
// In your React component
import { Room } from 'livekit-client';

const room = new Room();

// Get token from your Next.js API
const response = await fetch('/api/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    roomName: 'my-room',
    identity: 'user-123'
  })
});
const { token } = await response.json();

// Connect to LiveKit server
await room.connect('ws://localhost:7880', token);
```

## 📊 Management Commands

```bash
# Start the server
./start-livekit.sh

# Test the server
./test-integration.sh

# View logs
docker-compose logs -f

# Stop the server
docker-compose down

# Restart the server
docker-compose restart
```

## 🐳 Docker Configuration

The `docker-compose.yml` file configures:

- **LiveKit Server**: Official LiveKit Docker image
- **Port Mapping**: Exposes necessary ports for WebRTC
- **Volume Mounting**: Mounts `livekit.yaml` configuration
- **Environment Variables**: Loads API keys from `.env` file for security

## 🔒 Security Considerations

1. **Development Keys**: The included API keys are for development only
2. **Production Setup**: Generate new keys for production using:

```bash
   livekit-cli create-api-key
   ```

3. **Network Security**: Configure firewalls appropriately for production
4. **Token Validation**: Tokens are validated using the configured API secret

## 📄 Files Overview

- `docker-compose.yml`: Docker services configuration with environment variable support
- `livekit.yaml`: LiveKit server configuration
- `start-livekit.sh`: Convenience script to start the server
- `test-integration.sh`: Script to test server functionality
- `.env`: Environment variables containing API keys (not committed to git)

## 🆘 Troubleshooting

### Common Issues

1. **Port already in use**:
   - Stop existing LiveKit instances: `docker-compose down`
   - Check for other services on port 7880: `lsof -i :7880`

2. **Docker not running**:
   - Start Docker Desktop or Docker daemon
   - Verify with: `docker info`

3. **Connection refused**:
   - Ensure server is running: `docker-compose ps`
   - Check logs: `docker-compose logs livekit`

4. **WebRTC connection issues**:
   - Verify UDP ports 50000-50020 are available
   - Check firewall settings for UDP traffic

### Debug Mode

For additional debugging:

```bash
# View detailed logs
docker-compose logs -f livekit

# Check server health
curl http://localhost:7880/
```

## 📚 Additional Resources

- [LiveKit Documentation](https://docs.livekit.io/)
- [LiveKit Server Configuration](https://docs.livekit.io/deploy/configuration/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
