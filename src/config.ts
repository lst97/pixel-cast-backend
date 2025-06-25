import { load } from "dotenv";

// Load environment variables
await load({ export: true });

export const config = {
	// Server configuration
	port: parseInt(Deno.env.get("PORT") || "3001"),
	host: Deno.env.get("HOST") || "localhost",

	// SRS server configuration
	srs: {
		ip: Deno.env.get("SRS_SERVER_IP") || "localhost",
		apiPort: parseInt(Deno.env.get("SRS_API_PORT") || "1985"),
		webrtcPort: parseInt(Deno.env.get("SRS_WEBRTC_PORT") || "8000"),
		httpPort: parseInt(Deno.env.get("SRS_HTTP_PORT") || "8080"),
	},

	// CORS configuration
	allowedOrigins: (Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:3000")
		.split(",")
		.map((origin) => origin.trim()),
};

// Computed URLs
export const srsUrls = {
	api: `http://${config.srs.ip}:${config.srs.apiPort}`,
	webrtc: `http://${config.srs.ip}:${config.srs.webrtcPort}`,
	http: `http://${config.srs.ip}:${config.srs.httpPort}`,
};
