import { useRef, useCallback, useMemo } from "react";
import { useChatContext } from "@/contexts/ChatContext";
import {
  CONTROL_MESSAGES,
  WebSocketMessage,
  WS_MESSAGE_TYPES,
  SERVER_CONTROL_MESSAGES,
} from "@/types/chat";
import { useAudioPlayback } from "./useAudioPlayback";

export function useWebSocket() {
  const websocketRef = useRef<WebSocket | null>(null);
  const intentionalDisconnectRef = useRef(false);
  const { setConnected, setStatus } = useChatContext();
  const audioPlayback = useAudioPlayback();

  const connect = useCallback(
    (url: string) => {
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        return; // Already connected
      }

      websocketRef.current = new WebSocket(url);
      // Using text/JSON messages instead of binary

      websocketRef.current.onopen = () => {
        intentionalDisconnectRef.current = false; // Reset flag on new connection
        setConnected(true);
        setStatus("Connected to server", "connected");
      };

      websocketRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Handle new message format
          if (typeof message.t === "number") {
            switch (message.t) {
              case WS_MESSAGE_TYPES.CONTROL:
                handleServerControlMessage(message.v);
                break;
              case WS_MESSAGE_TYPES.AUDIO_RESPONSE:
                handleAudioResponse(message.v);
                break;
              case WS_MESSAGE_TYPES.TEXT:
                console.log("Text message received:", message.v);
                break;
              default:
                console.log("Unknown message type:", message.t);
            }
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      websocketRef.current.onclose = () => {
        setConnected(false);
        // Only show error message if this wasn't an intentional disconnect
        if (!intentionalDisconnectRef.current) {
          setStatus("Disconnected from server", "error");
        }
      };

      websocketRef.current.onerror = (error) => {
        setStatus("WebSocket error", "error");
        console.error("WebSocket error:", error);
      };
    },
    [setConnected, setStatus, audioPlayback]
  );

  const handleServerControlMessage = useCallback(
    (controlValue: number) => {
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
          audioPlayback.playCompleteAudio();
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
    if (websocketRef.current) {
      intentionalDisconnectRef.current = true; // Mark as intentional disconnect
      websocketRef.current.close();
      websocketRef.current = null;
    }
  }, []);

  const sendControlMessage = useCallback((command: number) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        t: 1, // Control message type
        v: command,
      };
      websocketRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendAudioData = useCallback((data: Uint8Array) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      const audioMessage = {
        t: 2, // Audio message type
        v: JSON.stringify(Array.from(data)),
      };
      websocketRef.current.send(JSON.stringify(audioMessage));
    }
  }, []);

  const isConnected = useMemo(
    () => websocketRef.current?.readyState === WebSocket.OPEN,
    [websocketRef.current?.readyState]
  );

  return {
    connect,
    disconnect,
    sendControlMessage,
    sendAudioData,
    isConnected,
    audioPlayback,
  };
}
