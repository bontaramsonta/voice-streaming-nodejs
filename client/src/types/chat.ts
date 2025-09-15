export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface WebSocketMessage {
  t: number; // Message type
  v: any; // Message value/data
}

export interface LegacyWebSocketMessage {
  event: string;
  message?: string;
  filename?: string;
}

export interface ChatState {
  isConnected: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  status: string;
  statusType: "connected" | "recording" | "error" | "";
  audioDevices: AudioDevice[];
  selectedDeviceId: string;
}

export const WS_MESSAGE_TYPES = {
  CONTROL: 1,
  AUDIO: 2,
  TEXT: 3,
  AUDIO_RESPONSE: 4,
} as const;

export const CONTROL_MESSAGES = {
  RECORD_START: 1,
  RECORD_END: 2,
  USER_SPEAKING: 3,
  USER_PAUSED: 4,
} as const;

export const SERVER_CONTROL_MESSAGES = {
  SERVER_PROCESSING: 1,
  SERVER_READY: 2,
  SERVER_INTERRUPTED: 3,
  SERVER_DONE: 4,
} as const;

export type ControlMessage =
  (typeof CONTROL_MESSAGES)[keyof typeof CONTROL_MESSAGES];

export type ServerControlMessage =
  (typeof SERVER_CONTROL_MESSAGES)[keyof typeof SERVER_CONTROL_MESSAGES];
