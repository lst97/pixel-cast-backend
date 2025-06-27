import { Application, Router } from "oak";
import { config } from "./src/config.ts";

// Import route handlers
import {
	handleConnect,
	handleClose,
	handlePublish,
	handleUnpublish,
	handlePlay,
} from "./src/routes/srs-webhooks.ts";

import {
	handleWHIP,
	handleWHEP,
	handleGetStreams,
	handleStopStream,
	handleRTMPIngest,
	handleHLSPlayer,
	handleRTMPStreamStatus,
	handleHLSProxy,
	handleGetSrsMonitor,
} from "./src/routes/srs-proxy.ts";

import {
	handlePresenceUpdate,
	handleGetPresence,
} from "./src/routes/presence.ts";

import { handleTokenGeneration } from "./src/routes/token.ts";
import { handleSSE } from "./src/routes/sse.ts";
import {
	handleCreateRoom,
	handleGetRooms,
	handleGetRoomByStreamKey,
	handleValidateRoomUrl,
	handleGetCleanupStatus,
	handleManualCleanup,
} from "./src/routes/rooms.ts";
import { db } from "./src/database.ts";
import { cleanupService } from "./src/cleanup.ts";

const app = new Application();
const router = new Router();

// CORS middleware - add headers to all responses
app.use(async (ctx, next) => {
	await next();

	// Add CORS headers to all responses
	ctx.response.headers.set("Access-Control-Allow-Origin", "*");
	ctx.response.headers.set(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, DELETE, OPTIONS"
	);
	ctx.response.headers.set(
		"Access-Control-Allow-Headers",
		"Content-Type, Authorization, X-Prefer-Low-Latency"
	);
	ctx.response.headers.set("Access-Control-Max-Age", "86400");
});

// Logging middleware
app.use(async (ctx, next) => {
	const start = Date.now();
	await next();
	const ms = Date.now() - start;
	console.log(`${ctx.request.method} ${ctx.request.url.pathname} - ${ms}ms`);
});

// SRS Webhook Routes
router.post("/api/srs/connect", handleConnect);
router.post("/api/srs/close", handleClose);
router.post("/api/srs/publish", handlePublish);
router.post("/api/srs/unpublish", handleUnpublish);
router.post("/api/srs/play", handlePlay);

// SRS Proxy Routes
router.post("/api/srs-proxy/whip", handleWHIP);
router.post("/api/srs-proxy/whep", handleWHEP);
router.get("/api/srs-proxy/streams", handleGetStreams);
router.post("/api/srs-proxy/streams/stop", handleStopStream);
router.get("/api/srs-proxy/streams/sse", handleSSE);
router.get("/api/srs-proxy/monitor", handleGetSrsMonitor);

// RTMP & HLS Routes
router.get("/api/rtmp/ingest", handleRTMPIngest);
router.get("/api/hls/player", handleHLSPlayer);
router.get("/api/hls/proxy", handleHLSProxy);
router.get("/api/rtmp/status", handleRTMPStreamStatus);

// Presence Routes
router.post("/api/srs-proxy/presence", handlePresenceUpdate);
router.get("/api/srs-proxy/presence", handleGetPresence);

// Token Generation Route
router.post("/api/token", handleTokenGeneration);

// Room Management Routes
router.post("/api/rooms", handleCreateRoom);
router.get("/api/rooms", handleGetRooms);
router.get("/api/rooms/by-stream-key", handleGetRoomByStreamKey);
router.get("/api/rooms/validate", handleValidateRoomUrl);

// Cleanup Management Routes
router.get("/api/cleanup/status", handleGetCleanupStatus);
router.post("/api/cleanup/manual", handleManualCleanup);

// Health check route
router.get("/health", async (ctx) => {
	const dbConnected = await db.testConnection();
	const dbStats = dbConnected ? await db.getStats() : null;

	ctx.response.body = {
		status: "ok",
		timestamp: new Date().toISOString(),
		version: "1.0.0",
		database: {
			connected: dbConnected,
			stats: dbStats,
		},
	};
});

// Database test route
router.get("/api/test/database", async (ctx) => {
	try {
		const connected = await db.testConnection();
		const stats = await db.getStats();

		ctx.response.body = {
			success: true,
			connected,
			stats,
			message: connected
				? "Database is working correctly"
				: "Database connection failed",
		};
	} catch (error) {
		ctx.response.status = 500;
		ctx.response.body = {
			success: false,
			connected: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
});

// Root route
router.get("/", (ctx) => {
	ctx.response.body = {
		message: "PixelCast Backend API",
		version: "1.0.0",
		endpoints: {
			webhooks: [
				"POST /api/srs/connect",
				"POST /api/srs/close",
				"POST /api/srs/publish",
				"POST /api/srs/unpublish",
				"POST /api/srs/play",
			],
			proxy: [
				"POST /api/srs-proxy/whip",
				"POST /api/srs-proxy/whep",
				"GET /api/srs-proxy/streams",
				"POST /api/srs-proxy/streams/stop",
				"GET /api/srs-proxy/streams/sse",
				"GET /api/srs-proxy/monitor",
				"POST /api/srs-proxy/presence",
				"GET /api/srs-proxy/presence",
			],
			rtmp: ["GET /api/rtmp/ingest", "GET /api/rtmp/status"],
			hls: ["GET /api/hls/player"],
			tokens: ["POST /api/token"],
			rooms: [
				"POST /api/rooms",
				"GET /api/rooms",
				"GET /api/rooms/by-stream-key",
				"GET /api/rooms/validate",
			],
			cleanup: ["GET /api/cleanup/status", "POST /api/cleanup/manual"],
			test: ["GET /api/test/database"],
			health: ["GET /health"],
		},
	};
});

// Add OPTIONS handler for CORS preflight - MUST be before router
app.use(async (ctx, next) => {
	if (ctx.request.method === "OPTIONS") {
		ctx.response.headers.set("Access-Control-Allow-Origin", "*");
		ctx.response.headers.set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, DELETE, OPTIONS"
		);
		ctx.response.headers.set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization, X-Prefer-Low-Latency"
		);
		ctx.response.headers.set("Access-Control-Max-Age", "86400");
		ctx.response.status = 200;
		return;
	}
	await next();
});

app.use(router.routes());
app.use(router.allowedMethods());

// Error handling middleware
app.use(async (ctx, next) => {
	try {
		await next();
	} catch (err) {
		console.error("❌ Server error:", err);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Internal server error",
			details: err instanceof Error ? err.message : "Unknown error",
		};
	}
});

console.log(`🚀 PixelCast Backend starting...`);
console.log(`📍 Server will listen on ${config.host}:${config.port}`);
console.log(
	`🎯 SRS server configured at ${config.srs.ip}:${config.srs.apiPort}`
);
console.log(`🌐 CORS allowed origins: ${config.allowedOrigins.join(", ")}`);

// Start the cleanup service
cleanupService.start();

console.log(
	`✅ PixelCast Backend running on http://${config.host}:${config.port}`
);

await app.listen({ hostname: config.host, port: config.port });
