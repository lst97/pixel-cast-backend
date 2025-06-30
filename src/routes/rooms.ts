import { Context } from "oak";
import { config } from "../config.ts";
import { db } from "../database.ts";
import { cleanupService } from "../cleanup.ts";

export async function handleCreateRoom(ctx: Context) {
	try {
		const body = await ctx.request.body({ type: "json" }).value;
		const { type = "rtmp" } = body; // Default to RTMP, can be "rtmp" or "webrtc"

		if (type !== "rtmp" && type !== "webrtc") {
			ctx.response.status = 400;
			ctx.response.body = { error: "Room type must be 'rtmp' or 'webrtc'" };
			return;
		}

		// Generate unique stream key and room name
		const streamKey = crypto.randomUUID();
		const roomName = `${type.toUpperCase()} Room ${streamKey.slice(0, 8)}`;

		// Generate unified room URL - both types use /room/{streamKey}
		const roomUrl = `/room/${streamKey}`;

		// Create room in database
		const room = await db.createRoom(roomName, streamKey, type, roomUrl);

		// Full URL for frontend
		const fullRoomUrl = `${config.frontendBaseUrl}${roomUrl}`;

		// Send Discord webhook if configured
		if (config.discordWebhookUrl) {
			try {
				await sendDiscordWebhook(room.name, fullRoomUrl, streamKey, type);
				await db.markDiscordWebhookSent(room.id);
				console.log(`✅ Discord webhook sent for room: ${room.name}`);
			} catch (error) {
				console.error("❌ Failed to send Discord webhook:", error);
				// Don't fail the room creation if webhook fails
			}
		}

		console.log(
			`🏠 ${type.toUpperCase()} room created: ${room.name} (${streamKey})`
		);

		ctx.response.headers.set("Content-Type", "application/json");
		ctx.response.body = {
			success: true,
			room: {
				id: room.id,
				name: room.name,
				streamKey: room.stream_key,
				type: room.room_type,
				roomUrl: fullRoomUrl,
				createdAt: room.created_at,
			},
		};
	} catch (error) {
		console.error("❌ Error creating room:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function handleGetRooms(ctx: Context) {
	try {
		const rooms = await db.getAllRooms();

		const roomsWithUrls = rooms.map((room) => ({
			id: room.id,
			name: room.name,
			streamKey: room.stream_key,
			type: room.room_type,
			roomUrl: `${config.frontendBaseUrl}${room.room_url}`,
			createdAt: room.created_at,
			discordWebhookSent: room.discord_webhook_sent,
		}));

		ctx.response.headers.set("Content-Type", "application/json");
		ctx.response.body = {
			success: true,
			rooms: roomsWithUrls,
		};
	} catch (error) {
		console.error("❌ Error getting rooms:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function handleGetRoomByStreamKey(ctx: Context) {
	try {
		const url = ctx.request.url;
		const streamKey = url.searchParams.get("streamKey");

		if (!streamKey) {
			ctx.response.status = 400;
			ctx.response.body = { error: "Stream key is required" };
			return;
		}

		const room = await db.getRoomByStreamKey(streamKey);

		if (!room) {
			ctx.response.status = 404;
			ctx.response.body = { error: "Room not found" };
			return;
		}

		ctx.response.headers.set("Content-Type", "application/json");
		ctx.response.body = {
			success: true,
			room: {
				id: room.id,
				name: room.name,
				streamKey: room.stream_key,
				type: room.room_type,
				roomUrl: `${config.frontendBaseUrl}${room.room_url}`,
				createdAt: room.created_at,
				discordWebhookSent: room.discord_webhook_sent,
			},
		};
	} catch (error) {
		console.error("❌ Error getting room:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function handleValidateRoomUrl(ctx: Context) {
	try {
		const url = ctx.request.url;
		const roomUrl = url.searchParams.get("roomUrl");

		if (!roomUrl) {
			ctx.response.status = 400;
			ctx.response.body = { error: "Room URL is required" };
			return;
		}

		// Extract the path from the room URL (remove domain if present)
		const urlPath = roomUrl.startsWith("http")
			? new URL(roomUrl).pathname
			: roomUrl;

		const room = await db.getRoomByUrl(urlPath);

		if (!room) {
			ctx.response.status = 404;
			ctx.response.body = {
				success: false,
				exists: false,
				error: "Room not found",
			};
			return;
		}

		ctx.response.headers.set("Content-Type", "application/json");
		ctx.response.body = {
			success: true,
			exists: true,
			room: {
				id: room.id,
				name: room.name,
				streamKey: room.stream_key,
				type: room.room_type,
				roomUrl: `${config.frontendBaseUrl}${room.room_url}`,
				createdAt: room.created_at,
			},
		};
	} catch (error) {
		console.error("❌ Error validating room URL:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			success: false,
			exists: false,
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

async function sendDiscordWebhook(
	roomName: string,
	roomUrl: string,
	streamKey: string,
	roomType: "rtmp" | "webrtc"
) {
	if (!config.discordWebhookUrl) {
		throw new Error("Discord webhook URL not configured");
	}

	const isRTMP = roomType === "rtmp";
	const embed = {
		title: isRTMP
			? "🎥 New RTMP Stream Room Created"
			: "🖥️ New WebRTC Room Created",
		description: `**${roomName}** is ready for ${
			isRTMP ? "streaming" : "screen sharing"
		}!\n\n🔒 **Access Control**: Only users who receive this Discord message can access the room.`,
		color: 0x5865f2, // Discord blurple
		fields: [
			{
				name: "🔗 Click to Access Room",
				value: `[**Join ${
					isRTMP ? "Stream" : "Room"
				} →**](${roomUrl})\n\n⚠️ **Important**: Save this link! This is the only way to access your ${
					isRTMP ? "stream" : "room"
				}.`,
				inline: false,
			},
			{
				name: "🔑 Stream Key",
				value: `\`${streamKey}\``,
				inline: false,
			},
			{
				name: isRTMP ? "📺 How to Stream" : "🖥️ How to Share Screen",
				value: isRTMP
					? `1. Click the room link above\n2. Copy the RTMP server URL and stream key\n3. Open OBS or your streaming software\n4. Set Server to: \`${config.srs.rtmpUrl}\`\n5. Set Stream Key to the key above\n6. Start streaming!`
					: "1. Click the room link above\n2. Click 'Share Screen'\n3. Select the screen/window to share\n4. Start sharing!",
				inline: false,
			},
			{
				name: "🛡️ Security Notice",
				value:
					"This room is private and only accessible via this Discord link. Do not share this link with unauthorized users.",
				inline: false,
			},
		],
		timestamp: new Date().toISOString(),
		footer: {
			text: "PixelCast • Private Room Access",
		},
	};

	const webhookPayload = {
		embeds: [embed],
	};

	const response = await fetch(config.discordWebhookUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(webhookPayload),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Discord webhook failed: ${response.status} - ${errorText}`
		);
	}
}

// Cleanup management endpoints
export async function handleGetCleanupStatus(ctx: Context) {
	try {
		const status = cleanupService.getStatus();
		const rooms = await db.getAllRooms();

		ctx.response.headers.set("Content-Type", "application/json");
		ctx.response.body = {
			success: true,
			cleanup: status,
			currentRoomCount: rooms.length,
			rooms: rooms.map((room) => ({
				id: room.id,
				name: room.name,
				type: room.room_type,
				createdAt: room.created_at,
				ageHours: Math.round(
					(Date.now() - new Date(room.created_at).getTime()) / 1000 / 60 / 60
				),
			})),
		};
	} catch (error) {
		console.error("❌ Error getting cleanup status:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function handleManualCleanup(ctx: Context) {
	try {
		const result = await cleanupService.manualCleanup();

		ctx.response.headers.set("Content-Type", "application/json");
		ctx.response.body = {
			success: true,
			message: `Manual cleanup completed`,
			...result,
		};
	} catch (error) {
		console.error("❌ Error during manual cleanup:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
