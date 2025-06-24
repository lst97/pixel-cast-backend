#!/bin/bash

echo "🚀 Starting SRS (Simple Realtime Server) for PixelCast..."

# Stop any existing containers
echo "🛑 Stopping any existing SRS containers..."
docker-compose down

# Start SRS with fresh logs
echo "🐳 Starting SRS Docker container..."
docker-compose up -d

# Wait a moment for container to start
echo "⏳ Waiting for SRS to initialize..."
sleep 5

# Check if SRS is running
echo "🔍 Checking SRS status..."
if curl -s http://localhost:1985/api/v1/versions >/dev/null; then
    echo "✅ SRS is running successfully!"
    echo "🌐 SRS Management API: http://localhost:8080"
    echo "📡 SRS API: http://localhost:1985"
    echo "🎥 WebRTC Endpoint: http://localhost:8000"
    echo ""
    echo "📝 SRS is ready for screen sharing!"
else
    echo "❌ SRS failed to start properly"
    echo "📋 Check logs with: docker-compose logs srs"
fi

echo ""
echo "🔧 To stop SRS: docker-compose down"
echo "📋 To view logs: docker-compose logs -f srs"

# Kill any existing SRS instance
pkill -f srs || true

# Wait a moment for processes to terminate
sleep 2

# Set the candidate IP for WebRTC
export CANDIDATE="192.168.1.100"

# Start SRS with the WebRTC-to-WebRTC configuration
echo "Starting SRS with WebRTC-to-WebRTC audio support..."
./objs/srs -c rtc2rtc.conf 