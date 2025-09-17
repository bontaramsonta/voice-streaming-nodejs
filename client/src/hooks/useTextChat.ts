import { useCallback, useEffect } from "react";
import { useChatContext } from "@/contexts/ChatContext";
import {
  SERVER_CONTROL_MESSAGES,
  WebSocketMessage,
  WS_MESSAGE_TYPES,
} from "@/types/chat";

export function useTextChat(wsUrl: string, conversationId: string) {
  const {
    state,
    modeRef,
    websocketRef,
    connectWebSocket: connect,
    sendWebSocketMessage,
    setStatus,
  } = useChatContext();

  // Set up message handling when WebSocket is available
  useEffect(() => {
    function handleWSMessageForText(event: MessageEvent) {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        // Handle new message format
        switch (message.type) {
          case WS_MESSAGE_TYPES.CONTROL:
            handleServerControlMessage(message.value);
            break;
          case WS_MESSAGE_TYPES.TEXT:
            console.log("Text message received:", message.value);
            handleTextResponse(message.value);
            break;
          default:
            console.log("Unknown message type:", message.type);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    }
    function cleanup() {
      if (websocketRef.current) {
        console.log("Cleaning up WebSocket message handler for text chat");
        websocketRef.current.removeEventListener(
          "message",
          handleWSMessageForText
        );
      }
    }

    if (websocketRef.current && modeRef.current === "text") {
      console.log("Setting up WebSocket message handler for text chat");
      websocketRef.current.addEventListener("message", handleWSMessageForText);
    }

    return cleanup;
  }, [websocketRef.current, modeRef.current]);

  const handleServerControlMessage = useCallback(
    (controlValue: string) => {
      switch (controlValue) {
        case SERVER_CONTROL_MESSAGES.SERVER_PROCESSING:
          setStatus("AI is processing...", "recording");
          break;
        case SERVER_CONTROL_MESSAGES.SERVER_READY:
          setStatus("Ready for input", "connected");
          break;
        case SERVER_CONTROL_MESSAGES.SERVER_INTERRUPTED:
          setStatus("Processing interrupted", "connected");
          break;
        case SERVER_CONTROL_MESSAGES.SERVER_DONE:
          setStatus("Processing complete", "connected");
          break;
        default:
          console.log("Unknown server control message:", controlValue);
      }
    },
    [setStatus]
  );

  const handleTextResponse = useCallback((textData: string) => {
    try {
      // Process the text data
      console.log("Text response received:", textData);
    } catch (error) {
      console.error("Error processing text response:", error);
    }
  }, []);

  const sendControlMessage = useCallback(
    (command: string) => {
      sendWebSocketMessage({
        type: WS_MESSAGE_TYPES.CONTROL,
        value: command,
      });
    },
    [sendWebSocketMessage]
  );

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

  const sendTextData = useCallback(
    (data: string) => {
      sendWebSocketMessage({
        type: WS_MESSAGE_TYPES.TEXT,
        value: data,
      });
    },
    [sendWebSocketMessage]
  );

  const startTextChat = useCallback(async () => {
    try {
      // Clean up any existing resources

      // Connect to WebSocket if not already connected
      if (!state.isConnected) {
        const randomConnectionId = Math.random().toString(36).slice(2, 10);
        const url = new URL(`${wsUrl}/${conversationId}-${randomConnectionId}`);
        console.log("Connecting to WebSocket URL:", url.toString());
        await connect(url.toString());
      }

      // Send flag messages for voice on, text off
      sendFlagMessage({ text: "1" });
    } catch (error) {
      console.error("Error starting text chat:", error);
    }
  }, [
    connect,
    wsUrl,
    sendControlMessage,
    sendFlagMessage,
    state.isConnected,
    conversationId,
  ]);

  const endTextChat = useCallback(async () => {
    // Send flag message for text off before disconnecting
    sendFlagMessage({ text: "0" });
  }, [sendFlagMessage]);

  return {
    startTextChat,
    sendTextData,
    endTextChat,
  };
}
