#!/bin/bash

echo "🎵 Testing PixelCast Audio Setup..."
echo ""

# Check if SRS binary exists
if [ ! -f "./objs/srs" ]; then
    echo "❌ SRS binary not found at ./objs/srs"
    echo "   Please build SRS first"
    exit 1
fi

# Check if rtc2rtc.conf exists
if [ ! -f "./rtc2rtc.conf" ]; then
    echo "❌ rtc2rtc.conf not found"
    echo "   Please ensure the audio configuration file exists"
    exit 1
fi

echo "✅ SRS binary found"
echo "✅ Audio configuration found"
echo ""

# Check configuration for audio support
echo "🔍 Checking configuration for audio support..."
echo ""

if grep -q "transcode.*enabled.*on" rtc2rtc.conf; then
    echo "✅ Transcoding enabled"
else
    echo "❌ Transcoding not enabled - audio won't work"
fi

if grep -q "acodec.*opus" rtc2rtc.conf; then
    echo "✅ Opus audio codec configured"
else
    echo "❌ Opus audio codec not configured"
fi

if grep -q "rtmp_to_rtc.*on" rtc2rtc.conf; then
    echo "✅ RTMP to RTC conversion enabled"
else
    echo "❌ RTMP to RTC conversion not enabled"
fi

if grep -q "rtc_to_rtmp.*on" rtc2rtc.conf; then
    echo "✅ RTC to RTMP conversion enabled"
else
    echo "❌ RTC to RTMP conversion not enabled"
fi

echo ""
echo "🚀 Configuration test complete!"
echo ""
echo "To start SRS with audio support:"
echo "   export CANDIDATE=\"YOUR_IP_ADDRESS\""
echo "   ./objs/srs -c rtc2rtc.conf"
echo ""
echo "To test audio:"
echo "   1. Start SRS with above command"
echo "   2. Open PixelCast in browser"
echo "   3. Share screen with 'Share system audio' enabled"
echo "   4. Another user should hear audio when viewing your stream"
echo ""
echo "For troubleshooting, check:"
echo "   - Browser console for audio track logs"
echo "   - SRS logs: tail -f ./objs/srs.log"
echo "   - Audio setup guide: cat AUDIO_SETUP.md" 