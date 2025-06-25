# PixelCast Deno Backend - Quick Setup

## Prerequisites

- [Deno](https://deno.land/) installed
- Docker & Docker Compose (for SRS server)

## Quick Start (3 commands)

```bash
# 1. Create environment file
cp env.template .env

# 2. Start SRS server
docker-compose up -d srs

# 3. Start Deno backend
deno task start
```

## Verify Setup

```bash
# Check backend health
curl http://localhost:3001/health

# Generate a test token
curl -X POST "http://localhost:3001/api/token?roomName=test&identity=user1"

# Check SRS streams
curl http://localhost:3001/api/srs-proxy/streams
```

## Available Endpoints

- **API Documentation**: <http://localhost:3001/>
- **Health Check**: <http://localhost:3001/health>
- **Token Generation**: `POST /api/token`
- **WebRTC Publishing**: `POST /api/srs-proxy/whip`
- **WebRTC Playback**: `POST /api/srs-proxy/whep`
- **Stream Status**: `GET /api/srs-proxy/streams`
- **Real-time Updates**: `GET /api/srs-proxy/streams/sse`

## Frontend Integration

Update your frontend to use the new backend:

```javascript
// Change API base URL from Next.js routes to Deno backend
const API_BASE = 'http://localhost:3001';

// Example: Generate token
const response = await fetch(`${API_BASE}/api/token?roomName=${roomName}&identity=${identity}`, {
  method: 'POST'
});
const token = await response.json();
```

## Architecture

```
Frontend (Next.js) → Deno Backend → SRS Server
     :3000              :3001         :1985/:8000
```

The Deno backend acts as a proxy and API layer between your frontend and the SRS media server, handling WebRTC signaling, stream management, and real-time updates.

## Next Steps

1. Update frontend to point to Deno backend
2. Test WebRTC publishing/playback
3. Configure production environment variables
4. Deploy with proper process management
