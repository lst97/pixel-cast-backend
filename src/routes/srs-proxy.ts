import { Context } from "oak";
import { config, srsUrls } from "../config.ts";
import { SRSStreamsResponse } from "../types.ts";
import { parseSearchParams, createErrorResponse } from "../utils.ts";

// WHIP proxy handler
export async function handleWHIP(ctx: Context) {
	try {
		const url = ctx.request.url;
		const searchParams = parseSearchParams(url.toString());
		const app = searchParams.get("app");
		const stream = searchParams.get("stream");

		if (!app || !stream) {
			console.error("❌ Missing app or stream parameter");
			ctx.response.status = 400;
			ctx.response.body = { error: "Missing app or stream parameter" };
			return;
		}

		// Get SDP offer from request body
		const sdpOffer = await ctx.request.body({ type: "text" }).value;

		if (!sdpOffer) {
			console.error("❌ Missing SDP offer in request body");
			ctx.response.status = 400;
			ctx.response.body = { error: "Missing SDP offer in request body" };
			return;
		}

		console.log(`🔀 Proxying WHIP request for app: ${app}, stream: ${stream}`);
		console.log(`📤 SDP Offer length: ${sdpOffer.length} chars`);

		// Check if client requested low latency
		const preferLowLatency =
			ctx.request.headers.get("X-Prefer-Low-Latency") === "true";

		// Optimize SDP for low latency if requested
		let optimizedSdp = sdpOffer;
		if (preferLowLatency) {
			console.log("⚡ Applying low-latency SDP optimizations");

			// Add/enhance RTCP feedback for better error recovery
			if (
				!optimizedSdp.includes("a=rtcp-fb:") &&
				optimizedSdp.includes("m=video")
			) {
				optimizedSdp = optimizedSdp.replace(
					/(a=rtpmap:\d+ H264\/90000)/g,
					"$1\r\na=rtcp-fb:* nack\r\na=rtcp-fb:* nack pli\r\na=rtcp-fb:* ccm fir"
				);
			}

			// Add transport-wide congestion control
			if (!optimizedSdp.includes("transport-cc")) {
				optimizedSdp = optimizedSdp.replace(
					/(a=rtpmap:\d+ H264\/90000)/g,
					"$1\r\na=rtcp-fb:* transport-cc"
				);
			}

			// Add low latency preferences in SDP
			optimizedSdp = optimizedSdp.replace(
				/(a=setup:actpass)/g,
				"$1\r\na=x-google-flag:low-latency"
			);
		}

		// Forward request to SRS server - SRS expects JSON format, not raw SDP
		const srsUrl = `${srsUrls.api}/rtc/v1/publish/`;
		console.log(`🎯 SRS URL: ${srsUrl}`);

		// Build streamurl for SRS
		const streamUrl = `webrtc://${srsUrls.api
			.replace("http://", "")
			.replace("https://", "")}/${app}/${stream}`;

		// SRS expects JSON format with streamurl and sdp fields
		const srsRequestBody = JSON.stringify({
			api: srsUrl,
			streamurl: streamUrl,
			sdp: optimizedSdp,
		});

		const srsResponse = await fetch(srsUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(preferLowLatency && { "X-Low-Latency": "true" }),
			},
			body: srsRequestBody,
		});

		console.log(
			`📡 SRS Response status: ${srsResponse.status} ${srsResponse.statusText}`
		);

		if (!srsResponse.ok) {
			const errorText = await srsResponse.text();
			console.error(
				`❌ SRS WHIP request failed: ${srsResponse.status} ${srsResponse.statusText}`
			);
			console.error(`❌ SRS Error response: ${errorText}`);

			ctx.response.status = srsResponse.status;
			ctx.response.body = {
				error: `SRS server error: ${srsResponse.status} - ${errorText}`,
			};
			return;
		}

		const srsResponseText = await srsResponse.text();
		console.log(
			`📥 SRS Response received: ${srsResponseText.substring(0, 200)}...`
		);

		let srsResponseData;
		try {
			srsResponseData = JSON.parse(srsResponseText);
		} catch (error) {
			console.error(`❌ SRS returned invalid JSON: ${srsResponseText}`);
			ctx.response.status = 500;
			ctx.response.body = {
				error: `SRS server returned invalid JSON: ${srsResponseText}`,
			};
			return;
		}

		// Check if SRS returned an error
		if (srsResponseData.code && srsResponseData.code !== 0) {
			console.error(
				`❌ SRS returned error code ${srsResponseData.code}: ${JSON.stringify(
					srsResponseData
				)}`
			);
			ctx.response.status = 400;
			ctx.response.body = {
				error: `SRS server error: ${JSON.stringify(srsResponseData)}`,
			};
			return;
		}

		// Extract SDP from JSON response
		let sdpAnswer = srsResponseData.sdp;
		if (!sdpAnswer) {
			console.error(
				`❌ SRS response missing SDP field: ${JSON.stringify(srsResponseData)}`
			);
			ctx.response.status = 500;
			ctx.response.body = {
				error: `SRS response missing SDP field`,
			};
			return;
		}

		console.log(`✅ WHIP request successful for ${app}/${stream}`);
		console.log(`📥 SDP Answer length: ${sdpAnswer.length} chars`);
		console.log(`📊 SRS Session ID: ${srsResponseData.sessionid || "N/A"}`);

		// Optimize SDP answer for low latency if requested
		if (preferLowLatency) {
			console.log("⚡ Optimizing SDP answer for low latency");

			// Ensure RTCP feedback is enabled in answer
			if (!sdpAnswer.includes("a=rtcp-fb:") && sdpAnswer.includes("m=video")) {
				sdpAnswer = sdpAnswer.replace(
					/(a=rtpmap:\d+ H264\/90000)/g,
					"$1\r\na=rtcp-fb:* nack\r\na=rtcp-fb:* nack pli\r\na=rtcp-fb:* ccm fir\r\na=rtcp-fb:* transport-cc"
				);
			}
		}

		// Return SDP answer
		ctx.response.headers.set("Content-Type", "application/sdp");
		ctx.response.body = sdpAnswer;
	} catch (error) {
		console.error("❌ Error in WHIP proxy:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// WHEP proxy handler
export async function handleWHEP(ctx: Context) {
	try {
		const url = ctx.request.url;
		const searchParams = parseSearchParams(url.toString());
		const app = searchParams.get("app");
		const stream = searchParams.get("stream");

		if (!app || !stream) {
			console.error("❌ Missing app or stream parameter");
			ctx.response.status = 400;
			ctx.response.body = { error: "Missing app or stream parameter" };
			return;
		}

		// Get SDP offer from request body
		const sdpOffer = await ctx.request.body({ type: "text" }).value;

		if (!sdpOffer) {
			console.error("❌ Missing SDP offer in request body");
			ctx.response.status = 400;
			ctx.response.body = { error: "Missing SDP offer in request body" };
			return;
		}

		console.log(`🔀 Proxying WHEP request for app: ${app}, stream: ${stream}`);
		console.log(`📤 SDP Offer length: ${sdpOffer.length} chars`);

		// Check if client requested low latency
		const preferLowLatency =
			ctx.request.headers.get("X-Prefer-Low-Latency") === "true";

		// Optimize SDP for low latency playback if requested
		let optimizedSdp = sdpOffer;
		if (preferLowLatency) {
			console.log("⚡ Applying low-latency WHEP SDP optimizations");

			// Request enhanced RTCP feedback for better playback
			if (
				!optimizedSdp.includes("a=rtcp-fb:") &&
				optimizedSdp.includes("m=video")
			) {
				optimizedSdp = optimizedSdp.replace(
					/(a=rtpmap:\d+ H264\/90000)/g,
					"$1\r\na=rtcp-fb:* nack\r\na=rtcp-fb:* nack pli\r\na=rtcp-fb:* ccm fir"
				);
			}

			// Request transport-wide congestion control for viewer
			if (!optimizedSdp.includes("transport-cc")) {
				optimizedSdp = optimizedSdp.replace(
					/(a=rtpmap:\d+ H264\/90000)/g,
					"$1\r\na=rtcp-fb:* transport-cc"
				);
			}

			// Add low latency playback preferences
			optimizedSdp = optimizedSdp.replace(
				/(a=setup:actpass)/g,
				"$1\r\na=x-google-flag:low-latency-playback"
			);

			// Request reduced jitter buffer if supported
			if (optimizedSdp.includes("m=video")) {
				optimizedSdp = optimizedSdp.replace(
					/(m=video [^\r\n]+)/,
					"$1\r\na=x-google-min-playout-delay:0\r\na=x-google-max-playout-delay:100"
				);
			}
		}

		// Forward request to SRS server - SRS expects JSON format, not raw SDP
		const srsUrl = `${srsUrls.api}/rtc/v1/play/`;
		console.log(`🎯 SRS URL: ${srsUrl}`);

		// Build streamurl for SRS
		const streamUrl = `webrtc://${srsUrls.api
			.replace("http://", "")
			.replace("https://", "")}/${app}/${stream}`;

		// SRS expects JSON format with streamurl and sdp fields
		const srsRequestBody = JSON.stringify({
			api: srsUrl,
			streamurl: streamUrl,
			sdp: optimizedSdp,
		});

		const srsResponse = await fetch(srsUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(preferLowLatency && { "X-Low-Latency-Playback": "true" }),
			},
			body: srsRequestBody,
		});

		console.log(
			`📡 SRS Response status: ${srsResponse.status} ${srsResponse.statusText}`
		);

		if (!srsResponse.ok) {
			const errorText = await srsResponse.text();
			console.error(
				`❌ SRS WHEP request failed: ${srsResponse.status} ${srsResponse.statusText}`
			);
			console.error(`❌ SRS Error response: ${errorText}`);

			ctx.response.status = srsResponse.status;
			ctx.response.body = {
				error: `SRS server error: ${srsResponse.status} - ${errorText}`,
			};
			return;
		}

		const srsResponseText = await srsResponse.text();
		console.log(
			`📥 SRS Response received: ${srsResponseText.substring(0, 200)}...`
		);

		let srsResponseData;
		try {
			srsResponseData = JSON.parse(srsResponseText);
		} catch (error) {
			console.error(`❌ SRS returned invalid JSON: ${srsResponseText}`);
			ctx.response.status = 500;
			ctx.response.body = {
				error: `SRS server returned invalid JSON: ${srsResponseText}`,
			};
			return;
		}

		// Check if SRS returned an error
		if (srsResponseData.code && srsResponseData.code !== 0) {
			console.error(
				`❌ SRS returned error code ${srsResponseData.code}: ${JSON.stringify(
					srsResponseData
				)}`
			);
			ctx.response.status = 400;
			ctx.response.body = {
				error: `SRS server error: ${JSON.stringify(srsResponseData)}`,
			};
			return;
		}

		// Extract SDP from JSON response
		let sdpAnswer = srsResponseData.sdp;
		if (!sdpAnswer) {
			console.error(
				`❌ SRS response missing SDP field: ${JSON.stringify(srsResponseData)}`
			);
			ctx.response.status = 500;
			ctx.response.body = {
				error: `SRS response missing SDP field`,
			};
			return;
		}

		console.log(`✅ WHEP request successful for ${app}/${stream}`);
		console.log(`📥 SDP Answer length: ${sdpAnswer.length} chars`);
		console.log(`📊 SRS Session ID: ${srsResponseData.sessionid || "N/A"}`);

		// Optimize SDP answer for low latency playback
		if (preferLowLatency) {
			console.log("⚡ Optimizing WHEP SDP answer for low latency playback");

			// Ensure low latency playback feedback is configured
			if (!sdpAnswer.includes("a=rtcp-fb:") && sdpAnswer.includes("m=video")) {
				sdpAnswer = sdpAnswer.replace(
					/(a=rtpmap:\d+ H264\/90000)/g,
					"$1\r\na=rtcp-fb:* nack\r\na=rtcp-fb:* nack pli\r\na=rtcp-fb:* ccm fir\r\na=rtcp-fb:* transport-cc"
				);
			}

			// Add playout delay constraints if not present
			if (
				!sdpAnswer.includes("x-google-min-playout-delay") &&
				sdpAnswer.includes("m=video")
			) {
				sdpAnswer = sdpAnswer.replace(
					/(m=video [^\r\n]+)/,
					"$1\r\na=x-google-min-playout-delay:0\r\na=x-google-max-playout-delay:100"
				);
			}
		}

		// Return SDP answer
		ctx.response.headers.set("Content-Type", "application/sdp");
		ctx.response.body = sdpAnswer;
	} catch (error) {
		console.error("❌ Error in WHEP proxy:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// Get streams handler
export async function handleGetStreams(ctx: Context) {
	try {
		console.log("🔍 Fetching current streams from SRS");

		// Forward request to SRS server
		const srsResponse = await fetch(`${srsUrls.api}/api/v1/streams/`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!srsResponse.ok) {
			const errorText = await srsResponse.text();
			console.error(
				`❌ SRS streams request failed: ${srsResponse.status} ${srsResponse.statusText}`
			);
			console.error(`❌ SRS Error response: ${errorText}`);

			ctx.response.status = srsResponse.status;
			ctx.response.body = {
				error: `SRS server error: ${srsResponse.status} - ${errorText}`,
			};
			return;
		}

		const streamsData: SRSStreamsResponse = await srsResponse.json();
		console.log(
			`✅ Streams request successful, found ${
				streamsData.streams?.length || 0
			} streams`
		);

		ctx.response.body = streamsData;
	} catch (error) {
		console.error("❌ Error in streams proxy:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// Stop stream handler
export async function handleStopStream(ctx: Context) {
	try {
		const url = ctx.request.url;
		const searchParams = parseSearchParams(url.toString());
		const streamId = searchParams.get("stream");

		if (!streamId) {
			ctx.response.status = 400;
			ctx.response.body = { error: "Stream ID is required" };
			return;
		}

		console.log(`🛑 Attempting to stop stream: ${streamId}`);

		// Try to kick the client/stream using SRS API
		const kickResponse = await fetch(
			`${srsUrls.api}/api/v1/clients/${encodeURIComponent(streamId)}`,
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
			}
		);

		if (!kickResponse.ok) {
			console.warn(`⚠️ Could not kick client directly: ${kickResponse.status}`);

			// Try alternative approach - get stream info and kick all clients
			try {
				const streamsResponse = await fetch(`${srsUrls.api}/api/v1/streams/`);
				if (streamsResponse.ok) {
					const streamsData: SRSStreamsResponse = await streamsResponse.json();
					const targetStream = streamsData.streams?.find(
						(stream) => stream.name === streamId
					);

					if (targetStream && Array.isArray((targetStream as any).clients)) {
						// Kick all clients associated with this stream
						for (const client of (targetStream as any).clients) {
							try {
								await fetch(`${srsUrls.api}/api/v1/clients/${client.id}`, {
									method: "DELETE",
								});
								console.log(
									`✅ Kicked client ${client.id} from stream ${streamId}`
								);
							} catch (clientKickError) {
								console.warn(
									`⚠️ Could not kick client ${client.id}:`,
									clientKickError
								);
							}
						}
					}
				}
			} catch (alternativeError) {
				console.warn("⚠️ Alternative kick method failed:", alternativeError);
			}
		} else {
			console.log(`✅ Successfully stopped stream: ${streamId}`);
		}

		ctx.response.body = {
			success: true,
			message: `Stream ${streamId} stop requested`,
		};
	} catch (error) {
		console.error("❌ Error stopping stream:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// RTMP streaming handler for getting RTMP ingest URL
export async function handleRTMPIngest(ctx: Context) {
	try {
		const url = ctx.request.url;
		const searchParams = parseSearchParams(url.toString());
		const app = searchParams.get("app") || "__defaultApp__";
		const stream = searchParams.get("stream");

		if (!stream) {
			console.error("❌ Missing stream parameter");
			ctx.response.status = 400;
			ctx.response.body = { error: "Missing stream parameter" };
			return;
		}

		console.log(
			`🔴 Generating RTMP ingest URL for app: ${app}, stream: ${stream}`
		);

		// Generate RTMP ingest URL (use __defaultApp__ for SRS default)
		const rtmpIngestUrl = `rtmp://${srsUrls.api
			.replace("http://", "")
			.replace(":1985", ":1935")}/${app}/${stream}`;

		// Generate multiple playback URLs
		const hlsPlaybackUrl = `${srsUrls.http}/${app}/${stream}.m3u8`;
		const flvPlaybackUrl = `${srsUrls.http}/${app}/${stream}.flv`;
		const rtmpPlaybackUrl = `rtmp://${srsUrls.api
			.replace("http://", "")
			.replace(":1985", ":1935")}/${app}/${stream}`;

		console.log(`✅ RTMP ingest URL generated: ${rtmpIngestUrl}`);
		console.log(`✅ HLS playback URL generated: ${hlsPlaybackUrl}`);
		console.log(`✅ FLV playback URL generated: ${flvPlaybackUrl}`);

		ctx.response.headers.set("Content-Type", "application/json");
		ctx.response.body = {
			success: true,
			rtmpIngestUrl,
			hlsPlaybackUrl,
			flvPlaybackUrl,
			rtmpPlaybackUrl,
			app,
			stream,
		};
	} catch (error) {
		console.error("❌ Error generating RTMP ingest URL:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// HLS player handler for getting HLS stream info
export async function handleHLSPlayer(ctx: Context) {
	try {
		const url = ctx.request.url;
		const searchParams = parseSearchParams(url.toString());
		const app = searchParams.get("app") || "__defaultApp__";
		const stream = searchParams.get("stream");

		if (!stream) {
			console.error("❌ Missing stream parameter");
			ctx.response.status = 400;
			ctx.response.body = { error: "Missing stream parameter" };
			return;
		}

		console.log(
			`📺 Getting HLS player info for app: ${app}, stream: ${stream}`
		);

		// Check if stream is active by testing the FLV stream directly
		// since the SRS API might not be enabled
		let isLive = false;
		try {
			const flvTestUrl = `${srsUrls.http}/${app}/${stream}.flv`;
			console.log(`🔍 Testing stream availability: ${flvTestUrl}`);

			const flvResponse = await fetch(flvTestUrl, {
				method: "HEAD", // Use HEAD to avoid downloading content
				signal: AbortSignal.timeout(5000), // 5 second timeout
			});

			isLive = flvResponse.ok;
			console.log(
				`📊 FLV stream test result: ${flvResponse.status} - isLive: ${isLive}`
			);
		} catch (error) {
			console.log(`⚠️ FLV stream test failed: ${error}`);
			// Fallback: try the SRS API method
			try {
				const streamsResponse = await fetch(`${srsUrls.api}/api/v1/streams/`);
				if (streamsResponse.ok) {
					const streamsData: SRSStreamsResponse = await streamsResponse.json();
					isLive =
						streamsData.streams?.some(
							(s) => s.app === app && s.name === stream && s.publish?.active
						) || false;
					console.log(`📊 SRS API fallback result: isLive: ${isLive}`);
				}
			} catch (apiError) {
				console.log(`⚠️ SRS API also failed: ${apiError}`);
				// If both methods fail, assume stream might be live if we can't verify
				isLive = false;
			}
		}

		// Generate proxied playback URLs to avoid CORS issues
		const baseUrl = `http://${config.host}:${config.port}`;
		const hlsPlaybackUrl = `${baseUrl}/api/hls/proxy?url=/${app}/${stream}.m3u8`;
		const flvPlaybackUrl = `${srsUrls.http}/${app}/${stream}.flv`;
		const hlsLowQualityUrl = `${baseUrl}/api/hls/proxy?url=/${app}/${stream}_low.m3u8`;

		console.log(
			`✅ HLS player info generated for ${app}/${stream}, isLive: ${isLive}`
		);

		ctx.response.headers.set("Content-Type", "application/json");
		ctx.response.body = {
			success: true,
			isLive,
			hlsPlaybackUrl,
			flvPlaybackUrl,
			hlsLowQualityUrl,
			app,
			stream,
			adaptivePlaylist: [
				{
					quality: "1080p",
					url: hlsPlaybackUrl,
					bitrate: 3000,
				},
				{
					quality: "720p",
					url: hlsLowQualityUrl,
					bitrate: 1500,
				},
			],
		};
	} catch (error) {
		console.error("❌ Error getting HLS player info:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// RTMP stream status handler
export async function handleRTMPStreamStatus(ctx: Context) {
	try {
		const url = ctx.request.url;
		const searchParams = parseSearchParams(url.toString());
		const app = searchParams.get("app") || "__defaultApp__";
		const stream = searchParams.get("stream");

		if (!stream) {
			console.error("❌ Missing stream parameter");
			ctx.response.status = 400;
			ctx.response.body = { error: "Missing stream parameter" };
			return;
		}

		console.log(
			`📊 Checking RTMP stream status for app: ${app}, stream: ${stream}`
		);

		// Get stream info from SRS API
		const streamsResponse = await fetch(`${srsUrls.api}/api/v1/streams/`);

		if (!streamsResponse.ok) {
			throw new Error(`SRS API error: ${streamsResponse.status}`);
		}

		const streamsData: SRSStreamsResponse = await streamsResponse.json();
		const streamInfo = streamsData.streams?.find(
			(s) => s.app === app && s.name === stream
		);

		const isLive = streamInfo?.publish?.active || false;
		const viewerCount = streamInfo?.clients || 0;

		console.log(
			`✅ Stream status: ${app}/${stream}, isLive: ${isLive}, viewers: ${viewerCount}`
		);

		ctx.response.headers.set("Content-Type", "application/json");
		ctx.response.body = {
			success: true,
			isLive,
			viewerCount,
			app,
			stream,
			streamInfo: streamInfo
				? {
						id: streamInfo.id,
						name: streamInfo.name,
						vhost: streamInfo.vhost,
						app: streamInfo.app,
						tcUrl: streamInfo.tcUrl,
						url: streamInfo.url,
						publish: streamInfo.publish,
						video: streamInfo.video,
						audio: streamInfo.audio,
				  }
				: null,
		};
	} catch (error) {
		console.error("❌ Error getting RTMP stream status:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Internal server error",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// Proxy HLS streams with CORS headers
export const handleHLSProxy = async (ctx: Context) => {
	try {
		const url = new URL(ctx.request.url);
		const targetPath = url.searchParams.get("url");

		if (!targetPath) {
			ctx.response.status = 400;
			ctx.response.body = { error: "Missing url parameter" };
			return;
		}

		// Validate that it's an HLS-related request
		if (!targetPath.includes(".m3u8") && !targetPath.includes(".ts")) {
			ctx.response.status = 400;
			ctx.response.body = { error: "Invalid file type" };
			return;
		}

		// Construct the full SRS URL
		const srsUrl = `${srsUrls.http}${targetPath}`;
		console.log(`🔄 Proxying HLS request: ${srsUrl}`);

		// Fetch from SRS server
		const response = await fetch(srsUrl);

		if (!response.ok) {
			ctx.response.status = response.status;
			ctx.response.body = { error: `SRS server returned ${response.status}` };
			return;
		}

		// Get content type
		const contentType =
			response.headers.get("content-type") ||
			(targetPath.includes(".m3u8")
				? "application/vnd.apple.mpegurl"
				: "video/mp2t");

		// Set CORS headers
		ctx.response.headers.set("Access-Control-Allow-Origin", "*");
		ctx.response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
		ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type");
		ctx.response.headers.set("Content-Type", contentType);

		// Stream the response
		ctx.response.body = response.body;
	} catch (error) {
		console.error("❌ HLS proxy error:", error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: "Failed to proxy HLS stream",
			details: error instanceof Error ? error.message : "Unknown error",
		};
	}
};
