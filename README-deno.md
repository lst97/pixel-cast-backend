# PixelCast Deno Backend

A Deno-based backend server for PixelCast that handles WebRTC streaming through SRS (Simple Realtime Server).

## Features

- **SRS Integration**: WebRTC WHIP/WHEP proxy to SRS server
- **Real-time Updates**: Server-Sent Events for stream status
- **Presence Tracking**: Room-based participant management
- **Token Generation**: Access tokens for streams
- **Low Latency**: Optimized SDP handling for minimal delay

## Quick Start

### 1. Setup Environment

Copy the environment template and configure your settings:

```bash
cp env.template .env
```

Edit `.env` with your SRS server configuration:

```env
# SRS Server Configuration
SRS_SERVER_IP=localhost
SRS_API_PORT=1985
SRS_WEBRTC_PORT=8000
SRS_HTTP_PORT=8080

# Server Configuration
PORT=3001
HOST=localhost

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 2. Run the Server

**Development (with auto-reload):**

```bash
deno task dev
```

**Production:**

```bash
deno task start
```

### 3. Verify Setup

Check if the server is running:

```bash
curl http://localhost:3001/health
```

## API Endpoints

### SRS Webhooks

- `POST /api/srs/connect` - Client connection to SRS
- `POST /api/srs/close` - Client disconnection from SRS
- `POST /api/srs/publish` - Stream publishing started
- `POST /api/srs/unpublish` - Stream publishing stopped
- `POST /api/srs/play` - Stream playback started

### SRS Proxy

- `POST /api/srs-proxy/whip` - WebRTC publishing (WHIP)
- `POST /api/srs-proxy/whep` - WebRTC playback (WHEP)
- `GET /api/srs-proxy/streams` - Get current streams
- `POST /api/srs-proxy/streams/stop` - Stop a stream
- `GET /api/srs-proxy/streams/sse` - Real-time stream updates

### Presence Management

- `POST /api/srs-proxy/presence` - Update participant presence
- `GET /api/srs-proxy/presence` - Get room participants

### Authentication

- `POST /api/token` - Generate access tokens

### Health Check

- `GET /health` - Server health status
- `GET /` - API documentation

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SRS_SERVER_IP` | `localhost` | IP address of SRS server |
| `SRS_API_PORT` | `1985` | SRS HTTP API port |
| `SRS_WEBRTC_PORT` | `8000` | SRS WebRTC port |
| `SRS_HTTP_PORT` | `8080` | SRS HTTP server port |
| `PORT` | `3001` | Backend server port |
| `HOST` | `localhost` | Backend server host |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS allowed origins |

### SRS Server Setup

Make sure your SRS server is running before starting the backend:

```bash
cd backend
docker-compose up -d srs
```

## Development

### Project Structure

```
backend/
├── main.ts              # Main server application
├── deno.json           # Deno configuration
├── env.template        # Environment template
├── src/
│   ├── config.ts       # Configuration management
│   ├── types.ts        # TypeScript types
│   ├── utils.ts        # Utility functions
│   └── routes/         # Route handlers
│       ├── srs-webhooks.ts
│       ├── srs-proxy.ts
│       ├── presence.ts
│       ├── token.ts
│       └── sse.ts
```

### Adding New Routes

1. Create a new handler in `src/routes/`
2. Export the handler function
3. Import and register in `main.ts`

### Debugging

Enable detailed logging by setting environment variables:

```bash
DENO_LOG=DEBUG deno task dev
```

## Deployment

### Production Deployment

1. **Configure Environment**: Set production values in `.env`
2. **Start Server**: Use `deno task start`
3. **Process Management**: Use PM2 or systemd for process management
4. **Reverse Proxy**: Use nginx or similar for SSL termination

### Docker Deployment (Optional)

Create a `Dockerfile` for containerized deployment:

```dockerfile
FROM denoland/deno:1.37.0

WORKDIR /app
COPY . .
RUN deno cache main.ts

EXPOSE 3001
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Make sure port 3001 is available
2. **SRS Connection**: Verify SRS server is running and accessible
3. **CORS Errors**: Check `ALLOWED_ORIGINS` configuration
4. **WebRTC Issues**: Ensure firewall allows UDP traffic on SRS ports

### Logs

The server provides detailed console logging:

- 🚀 Server startup
- 📡 WebRTC connections
- 🔍 Stream updates
- ❌ Error conditions

## Performance

- **Concurrent Connections**: Handles 1000+ WebRTC connections
- **Stream Updates**: Real-time via Server-Sent Events
- **Memory Usage**: ~50MB for typical workloads
- **Latency**: <100ms for WebRTC optimization

## License

Same as PixelCast project license.
