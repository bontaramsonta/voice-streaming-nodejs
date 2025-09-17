export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface WebSocketMessage {
  type: string; // Message type
  value: any; // Message value/data
}

export interface LegacyWebSocketMessage {
  event: string;
  message?: string;
  filename?: string;
}

export interface ChatState {
  isConnected: boolean;
  isVoiceLoading: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  status: string;
  statusType: "connected" | "recording" | "error" | "";
  audioDevices: AudioDevice[];
  selectedDeviceId: string;
}

export const WS_MESSAGE_TYPES = {
  CONTROL: "control",
  AUDIO: "audio",
  TEXT: "text",
  FLAG: "flag",
} as const;

export const WS_SERVER_FLAGS = {
  VOICE: "voice",
  CHAT: "text",
};

export const CONTROL_MESSAGES = {
  USER_SPEAKING: "user_speaking",
  USER_PAUSED: "user_paused",
} as const;

export const SERVER_CONTROL_MESSAGES = {
  SERVER_PROCESSING: "server_processing",
  SERVER_READY: "server_ready",
  SERVER_INTERRUPTED: "server_interrupted",
  SERVER_DONE: "server_done",
} as const;

export type ControlMessage =
  (typeof CONTROL_MESSAGES)[keyof typeof CONTROL_MESSAGES];

export type ServerControlMessage =
  (typeof SERVER_CONTROL_MESSAGES)[keyof typeof SERVER_CONTROL_MESSAGES];
