import { PGlite } from "pglite";

export interface Room {
	id: string;
	name: string;
	stream_key: string;
	room_type: "rtmp" | "webrtc";
	room_url: string;
	created_at: string;
	discord_webhook_sent: boolean;
	idle_since: string | null;
}

interface PgliteError {
	code: string;
}

class DatabaseService {
	private db: PGlite;
	private initialized = false;

	constructor() {
		this.db = new PGlite("./data/pixelcast.db");
	}

	async initialize() {
		if (this.initialized) return;

		try {
			// Create rooms table
			await this.db.exec(`
				CREATE TABLE IF NOT EXISTS rooms (
					id TEXT PRIMARY KEY,
					name TEXT NOT NULL,
					stream_key TEXT NOT NULL UNIQUE,
					room_type TEXT NOT NULL CHECK (room_type IN ('rtmp', 'webrtc')),
					room_url TEXT NOT NULL,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					discord_webhook_sent BOOLEAN DEFAULT FALSE
				);
			`);

			// Add idle_since column if it doesn't exist (for migration)
			try {
				await this.db.query("SELECT idle_since FROM rooms LIMIT 1");
			} catch (e) {
				const error = e as PgliteError;
				// PostgreSQL error code for 'undefined_column'
				if (error.code === "42703") {
					console.log(
						"🔄 Migrating database: adding 'idle_since' column to rooms table..."
					);
					await this.db.exec(
						"ALTER TABLE rooms ADD COLUMN idle_since TIMESTAMP NULL"
					);
					console.log("✅ Migration complete.");
				}
			}

			// Migrate existing RTMP rooms to unified URL structure
			await this.migrateRtmpUrls();

			console.log("✅ Database initialized successfully");
			this.initialized = true;
		} catch (error) {
			console.error("❌ Database initialization failed:", error);
			throw error;
		}
	}

	private async migrateRtmpUrls() {
		try {
			// Update RTMP rooms to use unified /room/{stream_key} URL structure
			const result = await this.db.query(`
				UPDATE rooms 
				SET room_url = '/room/' || stream_key 
				WHERE room_type = 'rtmp' AND room_url LIKE '/rtmp/%'
			`);

			if (result.affectedRows && result.affectedRows > 0) {
				console.log(
					`🔄 Migrated ${result.affectedRows} RTMP rooms to unified URL structure`
				);
			}
		} catch (error) {
			console.error("❌ Failed to migrate RTMP URLs:", error);
			// Don't fail initialization if migration fails
		}
	}

	async createRoom(
		name: string,
		streamKey: string,
		roomType: "rtmp" | "webrtc",
		roomUrl: string
	): Promise<Room> {
		await this.initialize();

		const id = crypto.randomUUID();
		const result = await this.db.query(
			`INSERT INTO rooms (id, name, stream_key, room_type, room_url) 
			 VALUES ($1, $2, $3, $4, $5) 
			 RETURNING *`,
			[id, name, streamKey, roomType, roomUrl]
		);

		return result.rows[0] as Room;
	}

	async getRoomByStreamKey(streamKey: string): Promise<Room | null> {
		await this.initialize();

		const result = await this.db.query(
			`SELECT * FROM rooms WHERE stream_key = $1`,
			[streamKey]
		);

		return (result.rows[0] as Room) || null;
	}

	async getRoomById(id: string): Promise<Room | null> {
		await this.initialize();

		const result = await this.db.query(`SELECT * FROM rooms WHERE id = $1`, [
			id,
		]);

		return (result.rows[0] as Room) || null;
	}

	async getRoomByUrl(roomUrl: string): Promise<Room | null> {
		await this.initialize();

		const result = await this.db.query(
			`SELECT * FROM rooms WHERE room_url = $1`,
			[roomUrl]
		);

		return result.rows.length > 0 ? (result.rows[0] as Room) : null;
	}

	async markDiscordWebhookSent(roomId: string): Promise<void> {
		await this.initialize();

		await this.db.query(
			`UPDATE rooms SET discord_webhook_sent = TRUE WHERE id = $1`,
			[roomId]
		);
	}

	async getAllRooms(): Promise<Room[]> {
		await this.initialize();

		const result = await this.db.query(
			`SELECT * FROM rooms ORDER BY created_at DESC`
		);
		return result.rows as Room[];
	}

	async deleteRoom(id: string): Promise<void> {
		await this.initialize();

		await this.db.query(`DELETE FROM rooms WHERE id = $1`, [id]);
	}

	async setRoomIdleStatus(streamKey: string, isIdle: boolean): Promise<void> {
		await this.initialize();
		const idleSince = isIdle ? new Date() : null;
		await this.db.query(
			`UPDATE rooms SET idle_since = $1 WHERE stream_key = $2`,
			[idleSince]
		);
	}

	async deleteIdleRooms(timeoutMinutes: number): Promise<Room[]> {
		await this.initialize();
		const timeout = new Date(Date.now() - timeoutMinutes * 60 * 1000);

		const result = await this.db.query(
			`DELETE FROM rooms WHERE idle_since IS NOT NULL AND idle_since < $1 RETURNING *`,
			[timeout.toISOString()]
		);
		return result.rows as Room[];
	}

	async deleteRoomByStreamKey(streamKey: string): Promise<Room | null> {
		await this.initialize();

		// Get the room before deleting for logging
		const room = await this.getRoomByStreamKey(streamKey);
		if (room) {
			await this.db.query(`DELETE FROM rooms WHERE stream_key = $1`, [
				streamKey,
			]);
		}
		return room;
	}

	async updateRoomIdleStates(
		idleStreamKeys: string[],
		activeStreamKeys: string[]
	): Promise<void> {
		await this.initialize();
		const now = new Date().toISOString();

		await this.db.transaction(async (tx) => {
			if (idleStreamKeys.length > 0) {
				const idlePlaceholders = idleStreamKeys
					.map((_, i) => `$${i + 2}`)
					.join(",");
				await tx.query(
					`UPDATE rooms 
					 SET idle_since = $1 
					 WHERE stream_key IN (${idlePlaceholders}) AND idle_since IS NULL`,
					[now, ...idleStreamKeys]
				);
			}

			if (activeStreamKeys.length > 0) {
				const activePlaceholders = activeStreamKeys
					.map((_, i) => `$${i + 1}`)
					.join(",");
				await tx.query(
					`UPDATE rooms 
					 SET idle_since = NULL 
					 WHERE stream_key IN (${activePlaceholders}) AND idle_since IS NOT NULL`,
					[...activeStreamKeys]
				);
			}
		});
	}

	// Test methods
	async testConnection(): Promise<boolean> {
		try {
			await this.initialize();
			const result = await this.db.query("SELECT 1 as test");
			return (
				result.rows.length > 0 &&
				(result.rows[0] as { test: number }).test === 1
			);
		} catch (error) {
			console.error("Database connection test failed:", error);
			return false;
		}
	}

	async getStats(): Promise<{
		roomCount: number;
		tablesInfo: { name: string; schema: string }[];
	}> {
		await this.initialize();

		const roomCountResult = await this.db.query(
			"SELECT COUNT(*) as count FROM rooms"
		);
		const roomCount =
			(roomCountResult.rows[0] as { count: number })?.count || 0;

		const tablesResult = await this.db.query(`
			SELECT table_name as name, table_schema as schema 
			FROM information_schema.tables 
			WHERE table_schema = 'public'
		`);

		return {
			roomCount: Number(roomCount),
			tablesInfo: tablesResult.rows as { name: string; schema: string }[],
		};
	}
}

export const db = new DatabaseService();
