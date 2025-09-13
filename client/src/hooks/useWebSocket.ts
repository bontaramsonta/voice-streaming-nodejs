import { useRef, useCallback, useMemo } from "react";
import { useChatContext } from "@/contexts/ChatContext";
import { CONTROL_MESSAGES, WebSocketMessage } from "@/types/chat";

export function useWebSocket() {
  const websocketRef = useRef<WebSocket | null>(null);
  const intentionalDisconnectRef = useRef(false);
  const { setConnected, setStatus } = useChatContext();

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
          if (message.event === "recording-started") {
            setStatus("Recording in progress...", "recording");
          } else if (message.event === "recording-saved") {
            setStatus(`Recording saved as ${message.filename}`, "connected");
          } else if (message.event === "error") {
            setStatus("Server error: " + message.message, "error");
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
    [setConnected, setStatus]
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
  };
}
