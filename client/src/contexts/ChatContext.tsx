import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import { ChatState, AudioDevice } from "@/types/chat";

interface ChatContextType {
  state: ChatState;
  setConnected: (connected: boolean) => void;
  setRecording: (recording: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setStatus: (status: string, type?: ChatState["statusType"]) => void;
  setAudioDevices: (devices: AudioDevice[]) => void;
  setSelectedDevice: (deviceId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

type ChatAction =
  | { type: "SET_CONNECTED"; payload: boolean }
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

  const setConnected = useCallback(
    (connected: boolean) =>
      dispatch({ type: "SET_CONNECTED", payload: connected }),
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

  const contextValue = useMemo(
    () => ({
      state,
      setConnected,
      setRecording,
      setSpeaking,
      setStatus,
      setAudioDevices,
      setSelectedDevice,
    }),
    [
      state,
      setConnected,
      setRecording,
      setSpeaking,
      setStatus,
      setAudioDevices,
      setSelectedDevice,
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
