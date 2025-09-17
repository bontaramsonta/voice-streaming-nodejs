import { useRef, useCallback, useEffect } from "react";
import { MicVAD } from "@ricky0123/vad-web";
import { useChatContext } from "@/contexts/ChatContext";
import { useAudioDevices } from "@/hooks/useAudioDevices";
import {
  CONTROL_MESSAGES,
  SERVER_CONTROL_MESSAGES,
  WebSocketMessage,
  WS_MESSAGE_TYPES,
} from "@/types/chat";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";

export function useVoiceChat(wsUrl: string, conversationId: string) {
  const {
    state,
    modeRef,
    setRecording,
    setSpeaking,
    setIsVoiceLoading,
    websocketRef,
    connectWebSocket: connect,
    sendWebSocketMessage,
    setStatus,
  } = useChatContext();
  const audioPlayback = useAudioPlayback();

  // Set up message handling when WebSocket is available
  useEffect(() => {
    function handleWSMessagesForVoice(event: MessageEvent) {
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
    }

    function cleanup() {
      if (websocketRef.current) {
        console.log("Cleaning up WebSocket message handler for voice chat");
        websocketRef.current.removeEventListener(
          "message",
          handleWSMessagesForVoice
        );
      }
    }

    if (websocketRef.current && modeRef.current === "voice") {
      console.log("Setting up WebSocket message handler for voice chat");
      websocketRef.current.addEventListener(
        "message",
        handleWSMessagesForVoice
      );

      return cleanup;
    }
  }, [websocketRef.current, modeRef.current]);

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

  const sendAudioData = useCallback(
    (data: Uint8Array) => {
      sendWebSocketMessage({
        type: WS_MESSAGE_TYPES.AUDIO,
        value: JSON.stringify(Array.from(data)),
      });
    },
    [sendWebSocketMessage]
  );

  const { requestPermissions, getMediaStream } = useAudioDevices();

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const vadRef = useRef<any>(null);

  // Use refs to avoid stale closure issues
  const isRecordingRef = useRef(false);
  const isSpeakingRef = useRef(false);

  // Update refs when state changes
  useEffect(() => {
    isRecordingRef.current = state.isRecording;
  }, [state.isRecording]);

  useEffect(() => {
    isSpeakingRef.current = state.isSpeaking;
  }, [state.isSpeaking]);

  const cleanupAudioResources = useCallback(async () => {
    try {
      // Disconnect and cleanup audio nodes
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }

      if (audioWorkletNodeRef.current) {
        audioWorkletNodeRef.current.disconnect();
        audioWorkletNodeRef.current.port.onmessage = null;
        audioWorkletNodeRef.current = null;
      }

      // Stop and cleanup media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }

      // Stop VAD
      if (vadRef.current) {
        try {
          vadRef.current.pause();
        } catch (error) {
          console.warn("Error stopping VAD:", error);
        }
        vadRef.current = null;
      }

      // Small delay to ensure cleanup completes
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.warn("Error during audio cleanup:", error);
    }
  }, []);

  const initializeAudioContext = useCallback(async () => {
    try {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });

      // Load the AudioWorklet processor
      await audioContextRef.current.audioWorklet.addModule(
        "/audio-processor.js"
      );

      return true;
    } catch (error) {
      console.error("Error initializing AudioContext:", error);
      console.info(
        "Failed to initialize audio context:",
        (error as Error).message
      );
      return false;
    }
  }, []);

  const initializeVAD = useCallback(async () => {
    try {
      vadRef.current = await MicVAD.new({
        onSpeechStart: () => {
          console.log("Speech started");
          if (isRecordingRef.current && !isSpeakingRef.current) {
            setSpeaking(true);
            sendControlMessage(CONTROL_MESSAGES.USER_SPEAKING);
            console.info("Recording - User speaking...");
            // Pause AI audio when user starts speaking
            audioPlayback.pauseAudio();
            console.log("🎵 Paused AI audio - user speaking");
          }
        },
        onSpeechEnd: () => {
          console.log("Speech ended");
          if (isRecordingRef.current && isSpeakingRef.current) {
            setSpeaking(false);
            sendControlMessage(CONTROL_MESSAGES.USER_PAUSED);
            console.info("Recording - User paused...");
            console.log("🎵 Resumed AI audio - user paused");
          }
        },
        onVADMisfire: () => {
          console.log("VAD misfire");
          // Resume AI audio when user by mistake spoke
          audioPlayback.resumeAudio();
        },
        baseAssetPath: "/",
        onnxWASMBasePath: "/",
        model: "v5",
      });
      console.log("VAD initialized");
      return true;
    } catch (error) {
      console.error("Error initializing VAD:", error);
      vadRef.current = null;
      return false;
    }
  }, [setSpeaking, sendControlMessage, audioPlayback]);

  const startVoiceChat = useCallback(async () => {
    try {
      setIsVoiceLoading(true);
      // Clean up any existing resources
      await cleanupAudioResources();

      // Connect to WebSocket if not already connected
      if (!state.isConnected) {
        const randomConnectionId = Math.random().toString(36).slice(2, 10);
        const url = new URL(`${wsUrl}/${conversationId}-${randomConnectionId}`);
        console.log("Connecting to WebSocket URL:", url.toString());
        await connect(url.toString());
      }

      // Send flag messages for voice on, text off
      sendFlagMessage({ voice: "1" });

      // Request microphone permissions
      const permissionStream = await requestPermissions();
      if (!permissionStream) {
        console.info("Microphone permission required");
        return;
      }

      // Stop the permission stream since we'll get a new one
      permissionStream.getTracks().forEach((track) => track.stop());

      // Initialize audio context
      const audioInitialized = await initializeAudioContext();
      if (!audioInitialized) {
        return;
      }

      // Resume audio context if suspended
      if (audioContextRef.current!.state === "suspended") {
        await audioContextRef.current!.resume();
      }

      // Get fresh media stream for AudioWorklet
      streamRef.current = await getMediaStream();

      // Create media stream source
      sourceRef.current = audioContextRef.current!.createMediaStreamSource(
        streamRef.current
      );

      // Create AudioWorklet node
      audioWorkletNodeRef.current = new AudioWorkletNode(
        audioContextRef.current!,
        "audio-processor"
      );

      // Send sample rate to the processor
      audioWorkletNodeRef.current.port.postMessage({
        type: "setSampleRate",
        sampleRate: audioContextRef.current!.sampleRate,
      });

      // Set up message handling for audio data - IMPORTANT: Do this BEFORE connecting the audio graph
      audioWorkletNodeRef.current.port.onmessage = (event) => {
        if (event.data.type === "audioData" && isRecordingRef.current) {
          // If VAD is available, only send audio when user is speaking
          if (vadRef.current) {
            if (isSpeakingRef.current) {
              // console.log("Sending audio data (user speaking)");
              sendAudioData(event.data.data);
            } else {
              // console.log("Skipping audio data (user not speaking)");
            }
          }
        }
      };

      // Connect the audio graph
      sourceRef.current.connect(audioWorkletNodeRef.current);
      audioWorkletNodeRef.current.connect(audioContextRef.current!.destination);

      // Initialize and start VAD
      await initializeVAD();
      if (vadRef.current) {
        try {
          await vadRef.current.start();
          console.log("VAD started successfully");
        } catch (vadError) {
          console.warn("Failed to start VAD:", vadError);
        }
      }

      console.info("Recording with VAD - speak to begin...");
      console.log("Voice chat started successfully");
      setIsVoiceLoading(false);
      setRecording(true);
    } catch (error) {
      console.error("Error starting chat:", error);
      console.info("Error starting recording:", (error as Error).message);
      await cleanupAudioResources();
    }
  }, [
    cleanupAudioResources,
    connect,
    wsUrl,
    requestPermissions,
    initializeAudioContext,
    getMediaStream,
    sendAudioData,
    initializeVAD,
    sendControlMessage,
    setRecording,
    state.isConnected,
    conversationId,
  ]);

  const endVoiceChat = useCallback(async () => {
    console.log("Ending voice chat...");
    if (state.isRecording) {
      setRecording(false);
      setSpeaking(false);

      // Send flag message for voice off before disconnecting
      sendFlagMessage({ voice: "0" });

      // Clean up audio resources
      await cleanupAudioResources();

      console.info("Call ended");
    }
    if (audioPlayback.isPlaying()) {
      audioPlayback.resetAudioStream();
    }
  }, [
    state.isRecording,
    setRecording,
    setSpeaking,
    cleanupAudioResources,
    audioPlayback,
  ]);

  return {
    startVoiceChat,
    endVoiceChat,
    audioPlayback,
  };
}
