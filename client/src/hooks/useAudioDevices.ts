import { useEffect, useCallback } from "react";
import { useChatContext } from "@/contexts/ChatContext";
import { AudioDevice } from "@/types/chat";

export function useAudioDevices() {
  const { state, setAudioDevices, setSelectedDevice, setStatus } =
    useChatContext();

  const loadDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices: AudioDevice[] = devices
        .filter((device) => device.kind === "audioinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Device ${device.deviceId.substr(0, 8)}`,
          kind: device.kind,
        }));

      setAudioDevices(audioDevices);

      if (audioDevices.length === 0) {
        setStatus("No audio devices found", "error");
      } else if (!state.selectedDeviceId && audioDevices.length > 0) {
        setSelectedDevice(audioDevices[0].deviceId);
      }
    } catch (error) {
      console.error("Error loading devices:", error);
      setStatus("Error loading audio devices", "error");
    }
  }, [setAudioDevices, setSelectedDevice, setStatus, state.selectedDeviceId]);

  const getMediaStream = useCallback(
    async (deviceId?: string): Promise<MediaStream> => {
      const selectedDevice = deviceId || state.selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
        video: false,
      };

      return await navigator.mediaDevices.getUserMedia(constraints);
    },
    [state.selectedDeviceId]
  );

  const requestPermissions =
    useCallback(async (): Promise<MediaStream | null> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });

        // Load devices after getting permissions
        await loadDevices();

        return stream;
      } catch (err) {
        if (err instanceof Error) {
          console.error(`Permission error: ${err.message}`);
          setStatus(`Microphone permission denied: ${err.message}`, "error");
        }
        return null;
      }
    }, [loadDevices, setStatus]);

  // Load devices on mount
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  return {
    audioDevices: state.audioDevices,
    selectedDeviceId: state.selectedDeviceId,
    loadDevices,
    getMediaStream,
    requestPermissions,
    setSelectedDevice,
  };
}
