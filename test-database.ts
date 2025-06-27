#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

import { db } from "./src/database.ts";
import { cleanupService } from "./src/cleanup.ts";

async function testDatabase() {
	console.log("🧪 Starting PGLite Database Tests\n");

	try {
		// Test 1: Connection Test
		console.log("1️⃣ Testing database connection...");
		const connected = await db.testConnection();
		console.log(`   ✅ Connection: ${connected ? "SUCCESS" : "FAILED"}\n`);

		if (!connected) {
			console.error("❌ Database connection failed. Stopping tests.");
			Deno.exit(1);
		}

		// Test 2: Get initial stats
		console.log("2️⃣ Getting database statistics...");
		const initialStats = await db.getStats();
		console.log(`   📊 Initial room count: ${initialStats.roomCount}`);
		console.log(`   📋 Tables created: ${initialStats.tablesInfo.length}`);
		initialStats.tablesInfo.forEach((table) => {
			console.log(`      - ${table.name}`);
		});
		console.log("");

		// Test 3: Create test rooms
		console.log("3️⃣ Creating test rooms...");
		const testRooms = [
			{
				name: "Test Room 1",
				streamKey: "test-key-1",
				type: "rtmp" as const,
				url: "/room/test-key-1",
			},
			{
				name: "Test Room 2",
				streamKey: "test-key-2",
				type: "webrtc" as const,
				url: "/room/test-key-2",
			},
			{
				name: "Gaming Stream",
				streamKey: "gaming-123",
				type: "rtmp" as const,
				url: "/room/gaming-123",
			},
		];

		const createdRooms = [];
		for (const roomData of testRooms) {
			const room = await db.createRoom(
				roomData.name,
				roomData.streamKey,
				roomData.type,
				roomData.url
			);
			createdRooms.push(room);
			console.log(
				`   ✅ Created: "${room.name}" (${room.stream_key}) - ${room.room_type}`
			);
		}
		console.log("");

		// Test 4: Retrieve rooms by stream key
		console.log("4️⃣ Testing room retrieval by stream key...");
		for (const testRoom of testRooms) {
			const room = await db.getRoomByStreamKey(testRoom.streamKey);
			if (room) {
				console.log(
					`   ✅ Found: "${room.name}" by key "${testRoom.streamKey}"`
				);
			} else {
				console.log(`   ❌ Not found: "${testRoom.streamKey}"`);
			}
		}
		console.log("");

		// Test 5: Retrieve rooms by ID
		console.log("5️⃣ Testing room retrieval by ID...");
		for (const createdRoom of createdRooms) {
			const room = await db.getRoomById(createdRoom.id);
			if (room) {
				console.log(`   ✅ Found: "${room.name}" by ID "${createdRoom.id}"`);
			} else {
				console.log(`   ❌ Not found: ID "${createdRoom.id}"`);
			}
		}
		console.log("");

		// Test 6: Get all rooms
		console.log("6️⃣ Testing get all rooms...");
		const allRooms = await db.getAllRooms();
		console.log(`   📋 Total rooms found: ${allRooms.length}`);
		allRooms.forEach((room) => {
			console.log(
				`      - "${room.name}" (${room.stream_key}) - ${room.created_at}`
			);
		});
		console.log("");

		// Test 7: Test room URL validation
		console.log("7️⃣ Testing room URL validation...");
		for (const testRoom of testRooms) {
			const room = await db.getRoomByUrl(testRoom.url);
			if (room) {
				console.log(`   ✅ Found: "${room.name}" by URL "${testRoom.url}"`);
			} else {
				console.log(`   ❌ Not found: "${testRoom.url}"`);
			}
		}
		console.log("");

		// Test 8: Mark Discord webhook sent
		console.log("8️⃣ Testing Discord webhook marking...");
		if (createdRooms.length > 0) {
			await db.markDiscordWebhookSent(createdRooms[0].id);
			const updatedRoom = await db.getRoomById(createdRooms[0].id);
			if (updatedRoom?.discord_webhook_sent) {
				console.log(
					`   ✅ Discord webhook marked as sent for "${updatedRoom.name}"`
				);
			} else {
				console.log(
					`   ❌ Failed to mark Discord webhook for "${createdRooms[0].name}"`
				);
			}
		}
		console.log("");

		// Test 9: Final stats
		console.log("9️⃣ Getting final statistics...");
		const finalStats = await db.getStats();
		console.log(`   📊 Final room count: ${finalStats.roomCount}`);
		console.log(
			`   📈 Rooms created in this test: ${
				finalStats.roomCount - initialStats.roomCount
			}`
		);
		console.log("");

		// Test 10: Test deleteRoomByStreamKey
		console.log("🔟 Testing delete room by stream key...");
		if (createdRooms.length > 0) {
			const roomToDelete = createdRooms[0];
			const deletedRoom = await db.deleteRoomByStreamKey(
				roomToDelete.stream_key
			);
			if (deletedRoom) {
				console.log(`   ✅ Deleted room by stream key: "${deletedRoom.name}"`);
				// Remove from our tracking array
				createdRooms.shift();
			} else {
				console.log(`   ❌ Failed to delete room by stream key`);
			}
		}
		console.log("");

		// Test 11: Test cleanup service status
		console.log("1️⃣1️⃣ Testing cleanup service...");
		const cleanupStatus = cleanupService.getStatus();
		console.log(`   📊 Cleanup service running: ${cleanupStatus.running}`);
		console.log(
			`   ⏰ Cleanup interval: ${cleanupStatus.intervalMinutes} minutes`
		);
		console.log(
			`   🕐 Max room age: ${cleanupStatus.idleTimeoutMinutes} minutes`
		);
		console.log("");

		// Test 12: Test manual cleanup
		console.log("1️⃣2️⃣ Testing manual cleanup...");
		const cleanupResult = await cleanupService.manualCleanup();
		console.log(
			`   🧹 Manual cleanup result: ${cleanupResult.cleanedCount}/${cleanupResult.remainingRooms} rooms cleaned`
		);
		console.log("");

		// Test 13: Cleanup remaining test rooms
		console.log("1️⃣3️⃣ Cleaning up remaining test rooms...");
		for (const room of createdRooms) {
			await db.deleteRoom(room.id);
			console.log(`   🗑️ Deleted: "${room.name}"`);
		}

		// Verify cleanup
		const afterCleanupStats = await db.getStats();
		console.log(
			`   📊 Room count after cleanup: ${afterCleanupStats.roomCount}`
		);
		console.log("");

		console.log("🎉 All database tests completed successfully!");
		console.log("✅ PGLite is working correctly with PixelCast backend");
		console.log("🧹 Cleanup service is ready for automatic room management");
	} catch (error) {
		console.error("❌ Database test failed:", error);
		Deno.exit(1);
	}
}

// Run tests if this script is executed directly
if (import.meta.main) {
	await testDatabase();
}
