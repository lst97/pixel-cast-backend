import { db } from "./database.ts";
import { formatTimestamp } from "./utils.ts";
import { config, srsUrls } from "./config.ts";
import { SrsStream } from "./types.ts";

export class CleanupService {
	private cleanupInterval: number | null = null;
	private readonly CLEANUP_INTERVAL_MS = 1 * 60 * 1000; // 1 minute
	private readonly ROOM_IDLE_TIMEOUT_MINUTES = 15; // 15 minutes
	private readonly SRS_CLIENT_THRESHOLD = 0; // Number of clients to consider a room "active"

	private lastRun: Date | null = null;
	private lastSuccess: Date | null = null;
	private lastError: string | null = null;

	/**
	 * Start the scheduled cleanup job
	 */
	start() {
		if (this.cleanupInterval) {
			console.log("🧹 Cleanup service already running");
			return;
		}

		console.log(
			`🧹 Starting cleanup service (runs every ${
				this.CLEANUP_INTERVAL_MS / 1000 / 60
			} minutes)`
		);

		// Run cleanup immediately on start
		this.runCleanup();

		// Schedule periodic cleanup
		this.cleanupInterval = setInterval(() => {
			this.runCleanup();
		}, this.CLEANUP_INTERVAL_MS);
	}

	/**
	 * Stop the scheduled cleanup job
	 */
	stop() {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
			console.log("🛑 Cleanup service stopped");
		}
	}

	/**
	 * Run the cleanup job
	 */
	async runCleanup() {
		console.log(`🧹 Running room cleanup at ${formatTimestamp()}`);
		this.lastRun = new Date();

		try {
			// 1. Fetch all streams from SRS
			const srsStreams = await this.getSrsStreams();
			const srsStreamMap = new Map<string, SrsStream>();
			srsStreams.forEach((s) => srsStreamMap.set(s.name, s));

			// 2. Fetch all rooms from our database
			const allRooms = await db.getAllRooms();
			if (allRooms.length === 0) {
				console.log("🧹 No rooms in the database to check.");
				this.lastSuccess = new Date();
				return;
			}

			// 3. Determine idle and active rooms
			const idleStreamKeys: string[] = [];
			const activeStreamKeys: string[] = [];

			for (const room of allRooms) {
				const srsStream = srsStreamMap.get(room.stream_key);
				// A room is idle if not in SRS or has no clients
				if (!srsStream || srsStream.clients <= this.SRS_CLIENT_THRESHOLD) {
					idleStreamKeys.push(room.stream_key);
				} else {
					activeStreamKeys.push(room.stream_key);
				}
			}

			// 4. Update idle status in the database
			if (idleStreamKeys.length > 0 || activeStreamKeys.length > 0) {
				await db.updateRoomIdleStates(idleStreamKeys, activeStreamKeys);
				console.log(
					`📊 Room status updated: ${idleStreamKeys.length} idle, ${activeStreamKeys.length} active.`
				);
			}

			// 5. Delete rooms that have been idle for too long
			const cleanedRooms = await db.deleteIdleRooms(
				this.ROOM_IDLE_TIMEOUT_MINUTES
			);

			if (cleanedRooms.length > 0) {
				console.log(
					`🧹 Cleanup completed: Removed ${
						cleanedRooms.length
					} idle rooms. Details: ${JSON.stringify(
						cleanedRooms.map((r) => ({ id: r.id, name: r.name }))
					)}`
				);
			} else {
				console.log("🧹 Cleanup completed: No idle rooms to remove.");
			}
			this.lastSuccess = new Date();
		} catch (error) {
			console.error("❌ Cleanup job failed:", error);
			this.lastError = error instanceof Error ? error.message : "Unknown error";
		}
	}

	private async getSrsStreams(): Promise<SrsStream[]> {
		try {
			const response = await fetch(`${srsUrls.api}/streams`);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch streams from SRS: ${response.statusText}`
				);
			}
			const data = (await response.json()) as { streams: SrsStream[] };
			return data.streams || [];
		} catch (error) {
			console.error("Error fetching SRS streams:", error);
			return []; // Return empty array on error to prevent incorrect cleanup
		}
	}

	/**
	 * Manually trigger the cleanup job
	 */
	async manualCleanup() {
		console.log("⚙️ Manual cleanup triggered");
		const cleanedRooms = await db.deleteIdleRooms(
			this.ROOM_IDLE_TIMEOUT_MINUTES
		);
		const allRooms = await db.getAllRooms();

		return {
			cleanedCount: cleanedRooms.length,
			remainingRooms: allRooms.length,
			cleanedRooms: cleanedRooms.map((r) => ({ id: r.id, name: r.name })),
		};
	}

	/**
	 * Get the current status of the cleanup service
	 */
	getStatus() {
		return {
			running: this.cleanupInterval !== null,
			intervalMinutes: this.CLEANUP_INTERVAL_MS / 1000 / 60,
			idleTimeoutMinutes: this.ROOM_IDLE_TIMEOUT_MINUTES,
			lastRun: this.lastRun,
			lastSuccess: this.lastSuccess,
			lastError: this.lastError,
		};
	}
}

export const cleanupService = new CleanupService();
