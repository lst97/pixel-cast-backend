# PixelCast Backend - SRS (Simple Realtime Server)

This backend uses SRS (Simple Realtime Server) for screen sharing functionality. SRS is a high-performance, open-source media server that supports WebRTC, RTMP, HLS, and other streaming protocols.

## Features

- **Screen Sharing Only**: Focused on screen sharing without camera/microphone
- **WebRTC Support**: Uses WHIP (WebRTC-HTTP Ingestion Protocol) for publishing
- **Low Latency**: Optimized for real-time screen sharing
- **Scalable**: SRS can handle multiple concurrent screen sharing sessions
- **Simple Setup**: Docker-based deployment

## Quick Start

1. **Start SRS Server**:

   ```bash
   ./start-srs.sh
   ```

2. **Check Status**:

   ```bash
   curl http://localhost:1985/api/v1/versions
   ```

3. **View Logs**:

   ```bash
   docker-compose logs -f srs
   ```

## Architecture

```bash
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   SRS Server    │    │   Viewers       │
│   (Publisher)   │────│                 │────│   (Subscribers) │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
    WebRTC WHIP           Port 8000             WebRTC WHEP
```

## Configuration

### SRS Configuration (`srs.conf`)

- **WebRTC Server**: Port 8000
- **HTTP API**: Port 1985
- **HTTP Server**: Port 8080
- **RTMP**: Port 1935 (if needed)

### Environment Variables

- `SRS_API_URL`: SRS API endpoint (default: <http://localhost:1985>)
- `SRS_SERVER_URL`: SRS WebRTC endpoint (default: <http://localhost:8000>)

## API Endpoints

The frontend provides webhook endpoints for SRS:

- `POST /api/srs/connect` - User connects to SRS
- `POST /api/srs/close` - User disconnects from SRS
- `POST /api/srs/publish` - User starts screen sharing
- `POST /api/srs/unpublish` - User stops screen sharing
- `POST /api/srs/play` - Viewer starts watching
- `POST /api/srs/stop` - Viewer stops watching

## Screen Sharing Workflow

1. **User Joins Room**: Frontend generates stream key and WebRTC URLs
2. **Start Screen Share**: User clicks "Share Screen" → WebRTC WHIP to SRS
3. **Viewers Join**: Other users connect via WebRTC WHEP from SRS
4. **Real-time Streaming**: SRS handles WebRTC peer connections and media relay

## Troubleshooting

### SRS Not Starting

```bash
# Check Docker logs
docker-compose logs srs

# Restart SRS
docker-compose restart srs
```

### WebRTC Connection Issues

- Check firewall settings for ports 8000, 1985, 8080
- Verify STUN servers are accessible
- Check browser console for WebRTC errors

### Performance Optimization

- Adjust video quality settings in frontend
- Monitor SRS resource usage: `docker stats`
- Scale horizontally with multiple SRS instances if needed

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

- [SRS Documentation](https://ossrs.io/)
- [SRS GitHub](https://github.com/ossrs/srs)
- [WebRTC WHIP/WHEP Specification](https://www.ietf.org/archive/id/draft-ietf-wish-whip-01.html)
