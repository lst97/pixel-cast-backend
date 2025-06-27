// SRS Webhook Types
export interface SRSWebhookBody {
	action: string;
	client_id: string;
	ip: string;
	vhost: string;
	app: string;
	stream: string;
	param?: string;
}

// Stream Info Types
export interface StreamInfo {
	id: string;
	app: string;
	name: string;
	publish: {
		active: boolean;
		cid?: string;
	};
	video?: {
		codec: string;
		profile?: string;
		level?: string;
		width?: number;
		height?: number;
	};
	audio?: {
		codec: string;
		sample_rate?: number;
		channel?: number;
		profile?: string;
	};
	vhost?: string;
	tcUrl?: string;
	url?: string;
	live_ms?: number;
	clients?: number;
	frames?: number;
	send_bytes?: number;
	recv_bytes?: number;
	kbps?: {
		recv_30s?: number;
		send_30s?: number;
	};
}

export interface SRSStreamsResponse {
	streams?: StreamInfo[];
}

// Token Types
export interface TokenResponse {
	roomName: string;
	identity: string;
	name: string;
	streamKey: string;
	timestamp: string;
	whipUrl: string;
	whepUrl: string;
	hlsUrl: string;
	iceServers: {
		urls: string | string[];
		username?: string;
		credential?: string;
	}[];
}

// Presence Types
export interface PresenceInfo {
	room: string;
	participants: string[];
	count: number;
}

// SSE Event Types
export interface SSEEvent {
	type: string;
	roomName?: string;
	streams?: StreamInfo[];
	clientId?: string;
}

// Stream Controller for SSE
export interface StreamController {
	enqueue: (data: string) => void;
}

export interface SrsStream {
	id: string;
	name: string; // This is the stream_key
	app: string;
	clients: number;
	publish: {
		active: boolean;
		cid: string;
	};
	// Add other fields as needed
}

export interface SRSMonitorData {
	isConnected: boolean;
	serverVersion: string;
	serverUptime: number;
	cpuUsage: number;
	memoryUsage: number;
	diskUsage: number;
	loadAverage: number[];
	streamCount: number;
	totalClients: number;
	streamInfo?: {
		publish?: {
			active: boolean;
			cid: number;
		};
		clients?: number;
		kbps?: {
			recv_30s: number;
			send_30s: number;
		};
		video?: {
			codec: string;
			profile: string;
			level: string;
			width: number;
			height: number;
		};
		audio?: {
			codec: string;
			sample_rate: number;
			channel: number;
			profile: string;
		};
		live_ms?: number;
	};
	now_ms: number;
}
