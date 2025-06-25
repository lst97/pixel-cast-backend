// Generate UUID v4 using built-in crypto

// Generate UUID v4
export function generateUUID(): string {
	return globalThis.crypto.randomUUID();
}

// Generate nanoid-like short ID
export function generateShortId(length = 10): string {
	const alphabet =
		"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return result;
}

// Format timestamp
export function formatTimestamp(): string {
	return new Date().toISOString();
}

// Parse URL search params
export function parseSearchParams(url: string): URLSearchParams {
	return new URL(url).searchParams;
}

// Create success response
export function createSuccessResponse(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

// Create error response
export function createErrorResponse(
	error: string,
	status = 500,
	details?: string
) {
	return new Response(JSON.stringify({ error, details }), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

// Create CORS headers
export function createCORSHeaders(allowedOrigins: string[]) {
	return {
		"Access-Control-Allow-Origin": allowedOrigins.includes("*")
			? "*"
			: allowedOrigins[0],
		"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
		"Access-Control-Allow-Headers":
			"Content-Type, Authorization, X-Prefer-Low-Latency",
	};
}
