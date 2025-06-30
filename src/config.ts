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

	// Frontend configuration
	frontendBaseUrl: Deno.env.get("FRONTEND_BASE_URL") || "http://localhost:3000",

	// SRS server configuration
	srs: {
		ip: Deno.env.get("SRS_SERVER_IP") || "127.0.0.1",
		apiPort: parseInt(Deno.env.get("SRS_API_PORT") || "1985"),
		webrtcPort: parseInt(Deno.env.get("SRS_WEBRTC_PORT") || "8000"),
		httpPort: parseInt(Deno.env.get("SRS_HTTP_PORT") || "8080"),
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
	api: `http://${config.srs.ip}:${config.srs.apiPort}/api/v1`,
	webrtc: `http://${config.srs.ip}:${config.srs.webrtcPort}`,
	http: `http://${config.srs.ip}:${config.srs.httpPort}`,
};

// Debug output
console.log("🔧 Configuration loaded:");
console.log(`   Server: ${config.host}:${config.port}`);
console.log(`   Frontend Base URL: ${config.frontendBaseUrl}`);
console.log(`   SRS IP: ${config.srs.ip}`);
console.log(`   SRS API URL: ${srsUrls.api}`);
