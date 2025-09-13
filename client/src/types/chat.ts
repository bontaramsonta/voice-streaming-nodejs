export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface WebSocketMessage {
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

export const CONTROL_MESSAGES = {
  RECORD_START: 0x01,
  RECORD_END: 0x02,
  USER_SPEAKING: 0x03,
  USER_PAUSED: 0x04,
} as const;

export type ControlMessage =
  (typeof CONTROL_MESSAGES)[keyof typeof CONTROL_MESSAGES];
