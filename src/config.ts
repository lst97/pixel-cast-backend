import { load } from "std/dotenv/mod.ts";

// Load environment variables (but don't fail if .env doesn't exist)
try {
	await load({ export: true });
} catch {
	console.log("ℹ️ No .env file found, using defaults");
}

export const config = {
	// Server configuration
	isProduction: Deno.env.get("NODE_ENV") === "production",
	port: parseInt(Deno.env.get("BACKEND_PORT") || "3001"),
	host: Deno.env.get("BACKEND_HOST") || "localhost", // Use localhost for local development

	// Backend configuration
	backendBaseUrl:
		Deno.env.get("BACKEND_BASE_URL") ||
		`http://localhost:${parseInt(Deno.env.get("BACKEND_PORT") || "3001")}`,

	// Frontend configuration
	frontendBaseUrl: Deno.env.get("FRONTEND_BASE_URL") || "http://localhost:3000",

	// SRS server configuration - using URLs instead of separate IP/port
	srs: {
		baseUrl: Deno.env.get("SRS_SERVER_BASE_URL") || "http://127.0.0.1:8080",
		httpApiUrl: Deno.env.get("SRS_HTTP_API_URL") || "http://127.0.0.1:1985",
		rtmpUrl: Deno.env.get("SRS_RTMP_URL") || "rtmp://127.0.0.1",
		hlsUrl: Deno.env.get("SRS_HLS_URL") || "http://127.0.0.1:8080",
		webrtcUrl: Deno.env.get("SRS_WEBRTC_URL") || "http://127.0.0.1:8000",
	},

	// CORS configuration
	allowedOrigins: (Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:3000")
		.split(",")
		.map((origin) => origin.trim()),

	// Discord webhook configuration
	discordWebhookUrl: Deno.env.get("DISCORD_WEBHOOK_URL") || "",
};

// Computed URLs - clean construction
export const srsUrls = {
	api: `${config.srs.httpApiUrl}/api/v1`,
	webrtc: config.srs.webrtcUrl,
	http: config.srs.baseUrl,
	hls: config.srs.hlsUrl,
	rtmp: config.srs.rtmpUrl,
};

// Debug output
console.log("🔧 Configuration loaded:");
console.log(`   Backend: ${config.backendBaseUrl}`);
console.log(`   Frontend Base URL: ${config.frontendBaseUrl}`);
console.log(`   SRS Base URL: ${config.srs.baseUrl}`);
console.log(`   SRS API URL: ${srsUrls.api}`);
console.log(`   SRS RTMP URL: ${srsUrls.rtmp}`);
console.log(`   SRS WebRTC URL: ${srsUrls.webrtc}`);
