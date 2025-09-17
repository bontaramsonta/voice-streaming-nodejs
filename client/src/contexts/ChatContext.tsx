import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { ChatState, AudioDevice } from "@/types/chat";

interface ChatContextType {
  state: ChatState;
  setConnected: (connected: boolean) => void;
  setIsVoiceLoading: (loading: boolean) => void;
  setRecording: (recording: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setStatus: (status: string, type?: ChatState["statusType"]) => void;
  setAudioDevices: (devices: AudioDevice[]) => void;
  setSelectedDevice: (deviceId: string) => void;
  modeRef: React.RefObject<"voice" | "text" | null>;
  // WebSocket connection and helpers
  websocketRef: React.RefObject<WebSocket | null>;
  connectWebSocket: (url: string) => Promise<void>;
  disconnectWebSocket: () => void;
  sendWebSocketMessage: (msg: object) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

type ChatAction =
  | { type: "SET_CONNECTED"; payload: boolean }
  | { type: "SET_IS_VOICE_LOADING"; payload: boolean }
  | { type: "SET_RECORDING"; payload: boolean }
  | { type: "SET_SPEAKING"; payload: boolean }
  | {
      type: "SET_STATUS";
      payload: { status: string; statusType?: ChatState["statusType"] };
    }
  | { type: "SET_AUDIO_DEVICES"; payload: AudioDevice[] }
  | { type: "SET_SELECTED_DEVICE"; payload: string };

const initialState: ChatState = {
  isConnected: false,
  isVoiceLoading: false,
  isRecording: false,
  isSpeaking: false,
  status: "Disconnected",
  statusType: "",
  audioDevices: [],
  selectedDeviceId: "",
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SET_CONNECTED":
      return { ...state, isConnected: action.payload };
    case "SET_IS_VOICE_LOADING":
      return { ...state, isVoiceLoading: action.payload };
    case "SET_RECORDING":
      return { ...state, isRecording: action.payload };
    case "SET_SPEAKING":
      return { ...state, isSpeaking: action.payload };
    case "SET_STATUS":
      return {
        ...state,
        status: action.payload.status,
        statusType: action.payload.statusType || "",
      };
    case "SET_AUDIO_DEVICES":
      return { ...state, audioDevices: action.payload };
    case "SET_SELECTED_DEVICE":
      return { ...state, selectedDeviceId: action.payload };
    default:
      return state;
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const modeRef = useRef<"voice" | "text" | null>(null);

  // WebSocket connection ref and helpers
  const websocketRef = useRef<WebSocket | null>(null);
  const intentionalDisconnectRef = useRef(false);

  const setConnected = useCallback(
    (connected: boolean) =>
      dispatch({ type: "SET_CONNECTED", payload: connected }),
    []
  );

  const setIsVoiceLoading = useCallback(
    (loading: boolean) =>
      dispatch({ type: "SET_IS_VOICE_LOADING", payload: loading }),
    []
  );

  const setRecording = useCallback(
    (recording: boolean) =>
      dispatch({ type: "SET_RECORDING", payload: recording }),
    []
  );

  const setSpeaking = useCallback(
    (speaking: boolean) =>
      dispatch({ type: "SET_SPEAKING", payload: speaking }),
    []
  );

  const setStatus = useCallback(
    (status: string, statusType?: ChatState["statusType"]) =>
      dispatch({ type: "SET_STATUS", payload: { status, statusType } }),
    []
  );

  const setAudioDevices = useCallback(
    (devices: AudioDevice[]) =>
      dispatch({ type: "SET_AUDIO_DEVICES", payload: devices }),
    []
  );

  const setSelectedDevice = useCallback(
    (deviceId: string) =>
      dispatch({ type: "SET_SELECTED_DEVICE", payload: deviceId }),
    []
  );

  // WebSocket connect/disconnect/send helpers
  const connectWebSocket = useCallback(
    (url: string) => {
      return new Promise<void>((resolve, reject) => {
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          resolve();
          return;
        }
        websocketRef.current = new WebSocket(url);
        websocketRef.current.onopen = () => {
          intentionalDisconnectRef.current = false;
          setConnected(true);
          setStatus("Connected to server", "connected");
          resolve();
        };
        websocketRef.current.onclose = () => {
          setConnected(false);
          if (!intentionalDisconnectRef.current) {
            setStatus("Disconnected from server", "error");
            reject(new Error("WebSocket unintentionally disconnected"));
          }
        };
        websocketRef.current.onerror = (error) => {
          setStatus("WebSocket error", "error");
          reject(error instanceof Event ? new Error("WebSocket error") : error);
        };
      });
    },
    [setConnected, setStatus]
  );

  const disconnectWebSocket = useCallback(() => {
    if (websocketRef.current) {
      intentionalDisconnectRef.current = true;
      websocketRef.current.close();
      websocketRef.current = null;
    }
  }, []);

  const sendWebSocketMessage = useCallback((msg: object) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      state,
      modeRef,
      setConnected,
      setIsVoiceLoading,
      setRecording,
      setSpeaking,
      setStatus,
      setAudioDevices,
      setSelectedDevice,
      websocketRef,
      connectWebSocket,
      disconnectWebSocket,
      sendWebSocketMessage,
    }),
    [
      state,
      modeRef,
      setConnected,
      setIsVoiceLoading,
      setRecording,
      setSpeaking,
      setStatus,
      setAudioDevices,
      setSelectedDevice,
      connectWebSocket,
      disconnectWebSocket,
      sendWebSocketMessage,
    ]
  );

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
