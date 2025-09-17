import { useCallback, useMemo, useEffect } from "react";
import { useChatContext } from "@/contexts/ChatContext";
import {
  WebSocketMessage,
  WS_MESSAGE_TYPES,
  SERVER_CONTROL_MESSAGES,
} from "@/types/chat";
import { useAudioPlayback } from "./useAudioPlayback";

export function useWebSocket() {
  const {
    websocketRef,
    connectWebSocket,
    disconnectWebSocket,
    sendWebSocketMessage,
    setStatus,
  } = useChatContext();

  const audioPlayback = useAudioPlayback();

  // Set up message handling when WebSocket is available
  useEffect(() => {
    if (websocketRef.current) {
      websocketRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Handle new message format
          switch (message.type) {
            case WS_MESSAGE_TYPES.CONTROL:
              handleServerControlMessage(message.value);
              break;
            case WS_MESSAGE_TYPES.AUDIO:
              handleAudioResponse(message.value);
              break;
            case WS_MESSAGE_TYPES.TEXT:
              console.log("Text message received:", message.value);
              break;
            default:
              console.log("Unknown message type:", message.type);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };
    }
  }, [websocketRef.current]);

  const connect = useCallback(
    (url: string) => {
      return connectWebSocket(url);
    },
    [connectWebSocket]
  );

  const handleServerControlMessage = useCallback(
    (controlValue: string) => {
      switch (controlValue) {
        case SERVER_CONTROL_MESSAGES.SERVER_PROCESSING:
          setStatus("AI is processing...", "recording");
          console.log("🤖 Server processing started");
          break;
        case SERVER_CONTROL_MESSAGES.SERVER_READY:
          setStatus("Ready for input", "connected");
          console.log("🤖 Server ready - resetting audio stream");
          audioPlayback.resetAudioStream();
          break;
        case SERVER_CONTROL_MESSAGES.SERVER_INTERRUPTED:
          setStatus("Processing interrupted", "connected");
          console.log("🤖 Server processing interrupted");
          audioPlayback.resetAudioStream();
          break;
        case SERVER_CONTROL_MESSAGES.SERVER_DONE:
          setStatus("Processing complete", "connected");
          console.log("🤖 Server processing done");
          break;
        case "stream_complete":
          console.log("🏁 Audio streaming complete");
          audioPlayback.markStreamComplete();
          break;
        default:
          console.log("Unknown server control message:", controlValue);
      }
    },
    [setStatus, audioPlayback]
  );

  const handleAudioResponse = useCallback(
    (audioData: string) => {
      try {
        // Convert JSON string back to Uint8Array
        const audioArray = JSON.parse(audioData);
        const audioChunk = new Uint8Array(audioArray);
        audioPlayback.addAudioChunk(audioChunk);
      } catch (error) {
        console.error("Error processing audio response:", error);
      }
    },
    [audioPlayback]
  );

  const disconnect = useCallback(() => {
    disconnectWebSocket();
  }, [disconnectWebSocket]);

  const sendControlMessage = useCallback(
    (command: string) => {
      sendWebSocketMessage({
        type: WS_MESSAGE_TYPES.CONTROL,
        value: command,
      });
    },
    [sendWebSocketMessage]
  );

  // Send a flag message, retrying up to 10 times if not connected
  const sendFlagMessage = useCallback(
    (flagObj: object) => {
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        sendWebSocketMessage({
          type: WS_MESSAGE_TYPES.FLAG,
          value: flagObj,
        });
      } else {
        console.error(
          "WebSocket not connected, failed to send flag message:",
          flagObj
        );
      }
    },
    [sendWebSocketMessage, websocketRef]
  );

  const sendAudioData = useCallback(
    (data: Uint8Array) => {
      sendWebSocketMessage({
        type: WS_MESSAGE_TYPES.AUDIO,
        value: JSON.stringify(Array.from(data)),
      });
    },
    [sendWebSocketMessage]
  );

  const isConnected = useMemo(
    () => websocketRef.current?.readyState === WebSocket.OPEN,
    [websocketRef.current?.readyState]
  );

  return {
    connect,
    disconnect,
    sendControlMessage,
    sendAudioData,
    sendFlagMessage,
    isConnected,
    audioPlayback,
  };
}
