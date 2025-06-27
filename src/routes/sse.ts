import { Context } from "oak";
import { StreamInfo, SRSStreamsResponse, StreamController } from "../types.ts";
import { parseSearchParams } from "../utils.ts";
import { srsUrls } from "../config.ts";

// Global state to track connected clients and current streams
const connectedClients = new Map<string, StreamController>();
// Map stream KEY to its info, not app-name to array.
const currentStreams = new Map<string, StreamInfo>(); // stream.name -> streamInfo

// Cleanup disconnected clients
setInterval(() => {
	for (const [clientId, controller] of connectedClients.entries()) {
		try {
			// Try to enqueue a heartbeat to test if connection is alive
			controller.enqueue(`data: {"type":"heartbeat"}\n\n`);
		} catch {
			// Client disconnected, remove from map
			console.log(`🧹 Removing disconnected client: ${clientId}`);
			connectedClients.delete(clientId);
		}
	}
}, 30000); // Check every 30 seconds

// Poll SRS for stream changes and broadcast to clients
async function pollAndBroadcastStreams() {
	try {
		const apiUrl = `${srsUrls.api}/streams`;

		const srsResponse = await fetch(apiUrl, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!srsResponse.ok) {
			console.error(`❌ SRS streams polling failed: ${srsResponse.status}`);
			return;
		}

		const streamsData: SRSStreamsResponse = await srsResponse.json();
		const allStreams = streamsData.streams || [];

		// Create a new map of streams from the latest fetch, keyed by stream name.
		const newStreamsByName = new Map<string, StreamInfo>();
		allStreams.forEach((stream) => {
			newStreamsByName.set(stream.name, stream);
		});

		// Get a unique set of all stream keys that are either currently active or were active in the last poll.
		const allStreamKeys = new Set([
			...currentStreams.keys(),
			...newStreamsByName.keys(),
		]);

		// For each potentially changed stream, check and broadcast if needed.
		for (const streamKey of allStreamKeys) {
			const previousStream = currentStreams.get(streamKey);
			const newStream = newStreamsByName.get(streamKey);

			const getStatusSignature = (s: StreamInfo | undefined) =>
				s ? `${s.publish.active}:${s.clients || 0}` : "offline";

			const prevSignature = getStatusSignature(previousStream);
			const newSignature = getStatusSignature(newStream);

			if (prevSignature !== newSignature) {
				console.log(
					`❗️ [SSE Polling] Status change for stream ${streamKey}: ${prevSignature} -> ${newSignature}`
				);

				// Update the central state
				if (newStream) {
					currentStreams.set(streamKey, newStream);
				} else {
					currentStreams.delete(streamKey);
				}

				// Broadcast only to clients subscribed to this specific streamKey
				const message = `data: ${JSON.stringify({
					type: "streams_update",
					roomName: streamKey,
					streams: newStream ? [newStream] : [], // Frontend expects an array
				})}\n\n`;

				for (const [clientId, controller] of connectedClients.entries()) {
					if (clientId.startsWith(`${streamKey}-`)) {
						console.log(`📡 Broadcasting to ${clientId} for room ${streamKey}`);
						try {
							controller.enqueue(message);
						} catch (error) {
							console.warn(
								`⚠️ Failed to send to client ${clientId}, removing.`,
								error
							);
							connectedClients.delete(clientId);
						}
					}
				}
			}
		}
	} catch (error) {
		console.error("❌ Error polling streams for SSE:", error);
	}
}

// Start background polling
const POLLING_INTERVAL = 5000; // 5 seconds
setInterval(pollAndBroadcastStreams, POLLING_INTERVAL);

// Initial poll
pollAndBroadcastStreams();

// SSE handler
export function handleSSE(ctx: Context) {
	const url = ctx.request.url;
	const searchParams = parseSearchParams(url.toString());
	const roomName = searchParams.get("room");

	if (!roomName) {
		ctx.response.status = 400;
		ctx.response.body = "Room name is required";
		return;
	}

	const clientId = `${roomName}-${Date.now()}-${Math.random()
		.toString(36)
		.substr(2, 9)}`;
	console.log(`🔗 New SSE client connected: ${clientId} for room: ${roomName}`);

	// Create a custom readable stream
	const encoder = new TextEncoder();

	const readable = new ReadableStream({
		start(controller) {
			// Store the controller for this client
			connectedClients.set(clientId, controller);

			const sendMessage = (data: Record<string, unknown>) => {
				const message = `data: ${JSON.stringify(data)}\n\n`;
				try {
					controller.enqueue(encoder.encode(message));
				} catch (error) {
					console.error(`Failed to send message to ${clientId}:`, error);
					connectedClients.delete(clientId);
				}
			};

			// Send initial connection message
			sendMessage({
				type: "connected",
				clientId,
				roomName,
			});

			// Send current streams for this room if available
			const currentRoomStreams = currentStreams.get(roomName);
			if (currentRoomStreams) {
				sendMessage({
					type: "streams_update",
					roomName,
					streams: [currentRoomStreams],
				});
			}

			// Replace the controller with a wrapper that uses the encoder
			const originalController = controller;
			const wrappedController = {
				enqueue: (data: string) => {
					try {
						originalController.enqueue(encoder.encode(data));
					} catch (error) {
						console.error(`Failed to enqueue to ${clientId}:`, error);
						connectedClients.delete(clientId);
					}
				},
			};
			connectedClients.set(clientId, wrappedController);
		},
		cancel() {
			console.log(`🔌 SSE client disconnected: ${clientId}`);
			connectedClients.delete(clientId);
		},
	});

	// Set SSE headers
	ctx.response.headers.set("Content-Type", "text/event-stream");
	ctx.response.headers.set("Cache-Control", "no-cache");
	ctx.response.headers.set("Connection", "keep-alive");

	// Set CORS headers for SSE
	ctx.response.headers.set("Access-Control-Allow-Origin", "*");
	ctx.response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
	ctx.response.headers.set(
		"Access-Control-Allow-Headers",
		"Content-Type, Authorization"
	);
	ctx.response.headers.set("Access-Control-Allow-Credentials", "false");

	ctx.response.body = readable;
}
