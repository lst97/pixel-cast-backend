import { Context } from "oak";
import { SRSWebhookBody } from "../types.ts";
import {
	createSuccessResponse,
	createErrorResponse,
	formatTimestamp,
} from "../utils.ts";
import { db } from "../database.ts";

// SRS Connect webhook handler
export async function handleConnect(ctx: Context) {
	try {
		const body: SRSWebhookBody = await ctx.request.body({ type: "json" }).value;

		console.log("🔗 SRS Connect:", {
			action: body.action,
			client_id: body.client_id,
			ip: body.ip,
			vhost: body.vhost,
			app: body.app,
			stream: body.stream,
			param: body.param,
			timestamp: formatTimestamp(),
		});

		// Log the connection for room management
		// You can add database logging here if needed

		// Return success to allow the connection
		ctx.response.body = { code: 0, message: "success" };
	} catch (error) {
		console.error("❌ SRS Connect Error:", error);
		ctx.response.status = 400;
		ctx.response.body = { code: 1, message: "connection rejected" };
	}
}

// SRS Close webhook handler
export async function handleClose(ctx: Context) {
	try {
		const body: SRSWebhookBody = await ctx.request.body({ type: "json" }).value;

		console.log("🔌 SRS Close:", {
			action: body.action,
			client_id: body.client_id,
			ip: body.ip,
			vhost: body.vhost,
			app: body.app,
			stream: body.stream,
			timestamp: formatTimestamp(),
		});

		// Log the disconnection for room management
		// You can add database logging here if needed

		ctx.response.body = { code: 0, message: "success" };
	} catch (error) {
		console.error("❌ SRS Close Error:", error);
		ctx.response.body = { code: 0, message: "success" };
	}
}

// SRS Publish webhook handler
export async function handlePublish(ctx: Context) {
	try {
		const body: SRSWebhookBody = await ctx.request.body({ type: "json" }).value;

		console.log("📺 SRS Publish (Stream Started):", {
			action: body.action,
			client_id: body.client_id,
			ip: body.ip,
			vhost: body.vhost,
			app: body.app,
			stream: body.stream,
			param: body.param,
			timestamp: formatTimestamp(),
		});

		// Validation can be added here if needed

		ctx.response.body = { code: 0, message: "success" };
	} catch (error) {
		console.error("❌ SRS Publish Error:", error);
		ctx.response.status = 400;
		ctx.response.body = { code: 1, message: "publish rejected" };
	}
}

// SRS Unpublish webhook handler
export async function handleUnpublish(ctx: Context) {
	try {
		const body: SRSWebhookBody = await ctx.request.body({ type: "json" }).value;

		console.log("📺 SRS Unpublish (Stream Stopped):", {
			action: body.action,
			client_id: body.client_id,
			ip: body.ip,
			vhost: body.vhost,
			app: body.app,
			stream: body.stream,
			timestamp: formatTimestamp(),
		});

		// The cleanup service will handle idle room deletion.
		// No immediate action is required here.

		ctx.response.body = { code: 0, message: "success" };
	} catch (error) {
		console.error("❌ SRS Unpublish Error:", error);
		ctx.response.body = { code: 0, message: "success" };
	}
}

// SRS Play webhook handler
export async function handlePlay(ctx: Context) {
	try {
		const body: SRSWebhookBody = await ctx.request.body({ type: "json" }).value;

		console.log("👀 SRS Play (Viewer Joined):", {
			action: body.action,
			client_id: body.client_id,
			ip: body.ip,
			vhost: body.vhost,
			app: body.app,
			stream: body.stream,
			param: body.param,
			timestamp: formatTimestamp(),
		});

		// Log viewer joining to watch screen share
		// You can add analytics or room management here

		ctx.response.body = { code: 0, message: "success" };
	} catch (error) {
		console.error("❌ SRS Play Error:", error);
		ctx.response.status = 400;
		ctx.response.body = { code: 1, message: "play rejected" };
	}
}
