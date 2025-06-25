import { Context } from "oak";
import { PresenceInfo } from "../types.ts";
import { parseSearchParams, formatTimestamp } from "../utils.ts";

// Simple in-memory store for room participants
// In production, you'd use Redis or another persistent store
const roomParticipants = new Map<string, Set<string>>();
const participantLastSeen = new Map<string, number>();

// Handle presence updates (POST)
export async function handlePresenceUpdate(ctx: Context) {
	try {
		const url = ctx.request.url;
		const searchParams = parseSearchParams(url.toString());
		const roomName = searchParams.get("room");
		const identity = searchParams.get("identity");
		const action = searchParams.get("action"); // "join" or "leave"

		if (!roomName || !identity) {
			ctx.response.status = 400;
			ctx.response.body = { error: "Missing room or identity parameter" };
			return;
		}

		const participantKey = `${roomName}:${identity}`;

		if (action === "leave") {
			// Remove participant from room
			if (roomParticipants.has(roomName)) {
				roomParticipants.get(roomName)?.delete(identity);
			}
			participantLastSeen.delete(participantKey);
			console.log(`👋 ${identity} left room ${roomName}`);
		} else {
			// Add participant to room (default action)
			if (!roomParticipants.has(roomName)) {
				roomParticipants.set(roomName, new Set());
			}
			roomParticipants.get(roomName)?.add(identity);
			participantLastSeen.set(participantKey, Date.now());
			console.log(`👋 ${identity} joined room ${roomName}`);
		}

		ctx.response.body = { success: true };
	} catch (error) {
		console.error("❌ Presence tracking error:", error);
		ctx.response.status = 500;
		ctx.response.body = { error: "Internal server error" };
	}
}

// Get presence information (GET)
export async function handleGetPresence(ctx: Context) {
	try {
		const url = ctx.request.url;
		const searchParams = parseSearchParams(url.toString());
		const roomName = searchParams.get("room");

		if (!roomName) {
			ctx.response.status = 400;
			ctx.response.body = { error: "Missing room parameter" };
			return;
		}

		// Clean up stale participants (inactive for more than 30 seconds)
		const now = Date.now();
		const staleThreshold = 30000; // 30 seconds

		for (const [key, lastSeen] of participantLastSeen.entries()) {
			if (now - lastSeen > staleThreshold) {
				const [room, identity] = key.split(":");
				if (roomParticipants.has(room)) {
					roomParticipants.get(room)?.delete(identity);
				}
				participantLastSeen.delete(key);
				console.log(
					`🧹 Cleaned up stale participant: ${identity} from ${room}`
				);
			}
		}

		const participants = Array.from(roomParticipants.get(roomName) || []);

		const response: PresenceInfo = {
			room: roomName,
			participants,
			count: participants.length,
		};

		ctx.response.body = response;
	} catch (error) {
		console.error("❌ Get presence error:", error);
		ctx.response.status = 500;
		ctx.response.body = { error: "Internal server error" };
	}
}
