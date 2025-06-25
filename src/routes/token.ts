import { Context } from "oak";
import { TokenResponse } from "../types.ts";
import {
	parseSearchParams,
	generateUUID,
	generateShortId,
	formatTimestamp,
} from "../utils.ts";

// Token generation handler
export async function handleTokenGeneration(ctx: Context) {
	try {
		const url = ctx.request.url;
		const searchParams = parseSearchParams(url.toString());

		const roomName = searchParams.get("roomName") || generateUUID();
		const identity =
			searchParams.get("identity") || `Guest-${generateShortId()}`;
		const name = searchParams.get("name") || "Guest";

		const streamKey = `${roomName}/${identity}`;
		const timestamp = formatTimestamp();

		const token: TokenResponse = {
			roomName,
			identity,
			name,
			streamKey,
			timestamp,
			// WHIP/WHEP URLs using proxy endpoints
			whipUrl: `/api/srs-proxy/whip?app=${encodeURIComponent(
				roomName
			)}&stream=${encodeURIComponent(identity)}`,
			whepUrl: `/api/srs-proxy/whep?app=${encodeURIComponent(
				roomName
			)}&stream=${encodeURIComponent(identity)}`,
			hlsUrl: `http://localhost:8080/${roomName}/${identity}.m3u8`,
			iceServers: [
				{ urls: "stun:stun.l.google.com:19302" },
				{ urls: "stun:stun1.l.google.com:19302" },
				{ urls: "stun:stun2.l.google.com:19302" },
			],
		};

		ctx.response.body = token;
	} catch (error) {
		console.error("❌ Error generating SRS room access:", error);
		ctx.response.status = 500;
		ctx.response.body = { error: "Internal Server Error" };
	}
}
