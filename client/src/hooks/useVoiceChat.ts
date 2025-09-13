import { useRef, useCallback, useEffect } from "react";
import { MicVAD } from "@ricky0123/vad-web";
import { useChatContext } from "@/contexts/ChatContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAudioDevices } from "@/hooks/useAudioDevices";
import { CONTROL_MESSAGES } from "@/types/chat";

export function useVoiceChat(wsUrl: string, conversationId: string) {
  const { state, setRecording, setSpeaking } = useChatContext();
  const {
    connect,
    disconnect,
    sendControlMessage,
    sendAudioData,
    isConnected,
  } = useWebSocket();
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
        sampleRate: 48000,
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
          }
        },
        onSpeechEnd: () => {
          console.log("Speech ended");
          if (isRecordingRef.current && isSpeakingRef.current) {
            setSpeaking(false);
            sendControlMessage(CONTROL_MESSAGES.USER_PAUSED);
            console.info("Recording - User paused...");
          }
        },
        onVADMisfire: () => {
          console.log("VAD misfire");
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
  }, [setSpeaking, sendControlMessage]);

  const startChat = useCallback(async () => {
    try {
      // Clean up any existing resources
      await cleanupAudioResources();

      // Connect to WebSocket first
      // append conversionId as query param
      const url = new URL(wsUrl);
      url.searchParams.append("conversationId", conversationId);
      console.log("Connecting to WebSocket URL:", url.toString());
      connect(url.toString());

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

      // Send start recording event to server
      sendControlMessage(CONTROL_MESSAGES.RECORD_START);
      setRecording(true);

      // Set up message handling for audio data - IMPORTANT: Do this BEFORE connecting the audio graph
      audioWorkletNodeRef.current.port.onmessage = (event) => {
        if (event.data.type === "audioData" && isRecordingRef.current) {
          // console.log(
          //   "Audio data received from worklet:",
          //   event.data.data.length,
          //   "bytes"
          // );

          // If VAD is available, only send audio when user is speaking
          if (vadRef.current) {
            if (isSpeakingRef.current) {
              console.log("Sending audio data (user speaking)");
              sendAudioData(event.data.data);
            } else {
              console.log("Skipping audio data (user not speaking)");
            }
          } else {
            // If no VAD, send all audio data (fallback behavior)
            console.log("Sending audio data (no VAD)");
            sendAudioData(event.data.data);
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
          // Continue without VAD - audio will still be sent
        }
      }

      console.info("Recording with VAD - speak to begin...");
      console.log("Voice chat started successfully");
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
  ]);

  const endChat = useCallback(async () => {
    if (state.isRecording) {
      setRecording(false);
      setSpeaking(false);

      // Send stop recording event
      sendControlMessage(CONTROL_MESSAGES.RECORD_END);

      // Clean up audio resources
      await cleanupAudioResources();

      // Disconnect WebSocket
      disconnect();

      console.info("Call ended");
    }
  }, [
    state.isRecording,
    setRecording,
    setSpeaking,
    sendControlMessage,
    cleanupAudioResources,
    disconnect,
  ]);

  return {
    startChat,
    endChat,
    isConnected,
  };
}
