# PixelCast Backend

A high-performance backend for screen sharing and RTMP streaming built with Deno, SRS (Simple Realtime Server), and PGLite database.

## Features

- **🎥 RTMP Streaming**: Full RTMP support for OBS/FFmpeg streaming
- **🖥️ Screen Sharing**: WebRTC-based screen sharing with WHIP/WHEP
- **💾 Database Storage**: PGLite (lightweight PostgreSQL) for room management
- **🔗 Discord Integration**: Automatic Discord webhook notifications for new rooms
- **⚡ Low Latency**: Optimized for real-time streaming
- **🔄 Room Management**: Create, manage, and track streaming rooms
- **📊 Health Monitoring**: Built-in health checks and database monitoring

## Quick Start

### Prerequisites

- [Deno](https://deno.land/) installed
- SRS server running (see SRS Setup section)

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 2. Start the Backend

```bash
# Development mode (with auto-reload)
deno task dev

# Production mode
deno task start
```

### 3. Verify Setup

```bash
# Check health (includes database status)
curl http://localhost:3001/health

# Test database specifically
curl http://localhost:3001/api/test/database
```

### 4. Test Database

```bash
# Run comprehensive database tests
deno task test:db
```

## Architecture

The following diagram illustrates the high-level architecture of PixelCast, showing both WebRTC and RTMP streaming workflows.

```bash
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Frontend      │      │                 │      │   Viewers       │
│  (WebRTC WHIP)  ├──────►   SRS Server    ◄──────┤  (WebRTC WHEP)  │
└─────────────────┘      │    (Port 8000)  │      └─────────────────┘
                         │                 │
┌─────────────────┐      │                 │      ┌─────────────────┐
│   OBS/FFmpeg    │      │                 │      │   Viewers       │
│     (RTMP)      ├──────► (Port 8080/1935)◄──────┤  (HLS Player)   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

- **WebRTC Flow**: The frontend publishes a screen share using WebRTC (WHIP) to SRS on port 8000. Viewers subscribe using WebRTC (WHEP).
- **RTMP Flow**: Streaming software like OBS sends an RTMP stream to SRS on port 1935. Viewers can watch this stream via HLS from SRS's HTTP server on port 8080.
- **Backend Server**: A Deno backend (not pictured) manages rooms, handles API requests, and interacts with SRS.

## Configuration

### Environment Variables (.env)

```env
# Server Configuration
PORT=3001                    # Backend server port
HOST=localhost              # Server host
ALLOWED_ORIGINS=http://localhost:3000  # Frontend URLs (comma-separated)

# SRS Server Configuration
SRS_SERVER_IP=127.0.0.1     # SRS server IP address
SRS_API_PORT=1985           # SRS API port
SRS_WEBRTC_PORT=8000        # SRS WebRTC port
SRS_HTTP_PORT=8080          # SRS HTTP port

# Discord Integration (optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

### SRS Configuration (`srs.conf`)

- **WebRTC Server**: Port 8000
- **HTTP API**: Port 1985  
- **HTTP Server**: Port 8080
- **RTMP**: Port 1935

## API Endpoints

### Room Management

- `POST /api/rooms` - Create a new RTMP room
- `GET /api/rooms` - List all rooms
- `GET /api/rooms/by-stream-key?streamKey=KEY` - Get room by stream key

### SRS Webhooks

- `POST /api/srs/connect` - User connects to SRS
- `POST /api/srs/close` - User disconnects from SRS  
- `POST /api/srs/publish` - User starts streaming
- `POST /api/srs/unpublish` - User stops streaming
- `POST /api/srs/play` - Viewer starts watching

### SRS Proxy

- `POST /api/srs-proxy/whip` - WebRTC WHIP (publish)
- `POST /api/srs-proxy/whep` - WebRTC WHEP (subscribe)
- `GET /api/srs-proxy/streams` - Get active streams
- `GET /api/srs-proxy/streams/sse` - Server-sent events for streams

### RTMP & HLS

- `GET /api/rtmp/ingest` - Get RTMP ingest URL
- `GET /api/rtmp/status` - Get stream status
- `GET /api/hls/player` - Get HLS player info

### Monitoring

- `GET /health` - Health check with database status
- `GET /api/test/database` - Database connection test

## Database (PGLite)

PixelCast uses **PGLite** - a lightweight, WASM-powered PostgreSQL database that runs entirely in-process.

### Features

- ✅ **Zero Configuration**: No separate database server needed
- ✅ **Full PostgreSQL Compatibility**: Real SQL with ACID transactions
- ✅ **Lightweight**: ~3MB WebAssembly bundle
- ✅ **Persistent**: Data stored in `./data/pixelcast.db`
- ✅ **Fast**: In-memory performance with disk persistence

### Database Schema

```sql
CREATE TABLE rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stream_key TEXT NOT NULL UNIQUE,
    room_type TEXT NOT NULL CHECK (room_type IN ('rtmp', 'webrtc')),
    room_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    discord_webhook_sent BOOLEAN DEFAULT FALSE
);
```

**Note**: All rooms now use unified URL structure `/room/{stream_key}` regardless of type. The system automatically migrates existing RTMP rooms from `/rtmp/{stream_key}` to the unified format.

### Testing Database

```bash
# Run comprehensive database tests
deno task test:db

# Check database status via API
curl http://localhost:3001/api/test/database
```

## Discord Integration

When users create RTMP rooms, the backend can automatically send notifications to Discord.

### Setup Discord Webhook

1. Go to your Discord server settings
2. Navigate to **Integrations** → **Webhooks**
3. Create a new webhook
4. Copy the webhook URL
5. Add it to your `.env` file:

   ```env
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN
   ```

### Discord Notification Features

- 🎥 **Room Creation Alerts**: Automatic notifications when rooms are created
- 🔗 **Direct Links**: Clickable links to join the stream
- 🔑 **Stream Keys**: Easy copy-paste stream keys
- 📺 **Setup Instructions**: Built-in OBS/FFmpeg setup guide

## Room Cleanup System

PixelCast includes an automated cleanup system to remove unused rooms and prevent database bloat.

### How Cleanup Works

1. **SRS Webhooks**: When streams end, SRS sends `on_unpublish` webhook to `/api/srs/unpublish`
2. **Immediate Cleanup**: Backend deletes room from database when stream ends
3. **Scheduled Cleanup**: Backup cleanup job runs every 15 minutes for orphaned rooms
4. **Age-Based Removal**: Rooms older than 24 hours are automatically removed

### Cleanup Configuration

```typescript
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
```

### Manual Cleanup

```bash
# Check cleanup status
curl http://localhost:3001/api/cleanup/status

# Run manual cleanup
curl -X POST http://localhost:3001/api/cleanup/manual

# Response example:
{
  "success": true,
  "message": "Manual cleanup completed",
  "cleaned": 3,
  "total": 10,
  "remaining": 7
}
```

### SRS Webhook Setup

Add to your SRS configuration (`srs.conf`):

```nginx
http_hooks {
    enabled on;
    on_publish http://localhost:3001/api/srs/publish;
    on_unpublish http://localhost:3001/api/srs/unpublish;
}
```

## Streaming Workflows

### Unified Room System

Both RTMP and WebRTC rooms now use the same URL structure: `/room/{stream_key}`

#### RTMP Streaming (OBS/FFmpeg)

1. **Create Room**: Frontend calls `POST /api/rooms` with `{"type": "rtmp"}`
2. **Database Storage**: Room saved with unified URL `/room/{stream_key}`
3. **Discord Notification**: Webhook sent with room details (if configured)
4. **Access Room**: User visits `/room/{stream_key}` → sees RTMP interface
5. **Stream Setup**: User configures OBS with `rtmp://{srs_server}` and stream key
6. **Go Live**: Stream appears in HLS player for viewers

#### WebRTC Screen Sharing

1. **Create Room**: Frontend calls `POST /api/rooms` with `{"type": "webrtc"}`
2. **Database Storage**: Room saved with unified URL `/room/{stream_key}`
3. **Discord Notification**: Webhook sent with room details (if configured)
4. **Access Room**: User visits `/room/{stream_key}` → sees WebRTC interface
5. **Start Screen Share**: User clicks "Share Screen" → WebRTC WHIP to SRS
6. **Viewers Join**: Other users connect via WebRTC WHEP from SRS
7. **Real-time Streaming**: SRS handles WebRTC peer connections and media relay

## Available Tasks

```bash
# Start backend in production mode
deno task start

# Start backend in development mode (auto-reload)
deno task dev

# Run comprehensive database tests
deno task test:db
```

## Troubleshooting

### Database Issues

```bash
# Test database connection
curl http://localhost:3001/api/test/database

# Run database tests
deno task test:db

# Check health endpoint
curl http://localhost:3001/health

# Reset database (delete data directory)
rm -rf ./data && deno task start
```

### Discord Webhook Issues

- ✅ Verify webhook URL is correct in `.env`
- ✅ Test webhook manually with curl
- ✅ Check Discord server permissions
- ✅ Room creation works even if webhook fails

### SRS Connection Issues

```bash
# Check SRS status
curl http://localhost:1985/api/v1/versions

# Verify SRS ports are accessible
netstat -tulpn | grep -E "(1985|8000|8080|1935)"

# Check SRS logs
docker-compose logs srs
```

### WebRTC Connection Issues

- Check firewall settings for ports 8000, 1985, 8080
- Verify STUN servers are accessible  
- Check browser console for WebRTC errors
- Ensure SRS_SERVER_IP is correctly configured

### Performance Optimization

- Monitor database size: `du -sh ./data`
- Check memory usage: `ps aux | grep deno`
- Adjust video quality settings in frontend
- Monitor SRS resource usage: `docker stats`

## Development vs Production

### Development

- Uses `localhost` for all connections
- Single SRS instance
- Basic STUN server configuration

### Production

- Configure proper external IP addresses
- Use TURN servers for NAT traversal
- Load balancing for multiple SRS instances
- SSL/TLS termination

## Migration from LiveKit

This backend has been migrated from LiveKit to SRS:

### What Changed

- **Media Server**: LiveKit → SRS
- **Protocol**: LiveKit SDK → Native WebRTC with WHIP/WHEP
- **Configuration**: `livekit.yaml` → `srs.conf`
- **Ports**: LiveKit ports → SRS ports (8000, 1985, 8080)

### What Stayed the Same

- Frontend React architecture
- Room-based organization
- User authentication flow
- Docker-based deployment

## Resources

### Core Technologies

- [Deno](https://deno.land/) - Modern JavaScript/TypeScript runtime
- [PGLite](https://github.com/electric-sql/pglite) - Lightweight PostgreSQL
- [SRS](https://ossrs.io/) - Simple Realtime Server
- [Oak](https://deno.land/x/oak) - HTTP middleware framework for Deno

### Documentation

- [SRS Documentation](https://ossrs.io/)
- [PGLite Documentation](https://pglite.dev/)
- [WebRTC WHIP/WHEP Specification](https://www.ietf.org/archive/id/draft-ietf-wish-whip-01.html)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)

### Example API Usage

```bash
# Create an RTMP room
curl -X POST http://localhost:3001/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"type": "rtmp"}'

# Create a WebRTC room  
curl -X POST http://localhost:3001/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"type": "webrtc"}'

# List all rooms  
curl http://localhost:3001/api/rooms

# Get room by stream key
curl "http://localhost:3001/api/rooms/by-stream-key?streamKey=YOUR_KEY"

# Check cleanup status
curl http://localhost:3001/api/cleanup/status

# Run manual cleanup
curl -X POST http://localhost:3001/api/cleanup/manual

# Check health
curl http://localhost:3001/health
```
