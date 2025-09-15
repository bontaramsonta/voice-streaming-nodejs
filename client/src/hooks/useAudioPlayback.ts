import { useRef, useCallback } from "react";

export function useAudioPlayback() {
  const pcmChunksRef = useRef<Uint8Array[]>([]);
  const isPlayingRef = useRef(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);
  const debugIdRef = useRef(0);

  console.log("🔧 useAudioPlayback hook initialized");

  // Set the audio element reference (called from ChatWidget)
  const setAudioElement = useCallback(
    (audioElement: HTMLAudioElement | null) => {
      console.log("🔧 setAudioElement called with:", audioElement ? "valid element" : "null");
      audioElementRef.current = audioElement;

      if (audioElement) {
        audioElement.onplay = () => {
          console.log("🎵 AUDIO EVENT: onplay fired");
          isPlayingRef.current = true;
        };

        audioElement.onpause = () => {
          console.log("⏸️ AUDIO EVENT: onpause fired");
          isPlayingRef.current = false;
        };

        audioElement.onended = () => {
          console.log("🎵 AUDIO EVENT: onended fired");
          isPlayingRef.current = false;
          
          // Clean up blob URL
          if (currentBlobUrlRef.current) {
            console.log("🧹 Cleaning up blob URL:", currentBlobUrlRef.current);
            URL.revokeObjectURL(currentBlobUrlRef.current);
            currentBlobUrlRef.current = null;
          }
        };

        audioElement.onerror = (error) => {
          console.error("❌ AUDIO EVENT: onerror fired:", error);
          console.error("❌ Audio element error details:", audioElement.error);
          isPlayingRef.current = false;
        };

        audioElement.onloadstart = () => {
          console.log("📥 AUDIO EVENT: onloadstart fired");
        };

        audioElement.oncanplay = () => {
          console.log("✅ AUDIO EVENT: oncanplay fired");
        };

        audioElement.ondurationchange = () => {
          console.log(`⏱️ AUDIO EVENT: ondurationchange fired - duration: ${audioElement.duration}s`);
        };
      }
    },
    []
  );

  // Convert PCM 16-bit data to WAV format
  const createWAVBlob = useCallback((pcmData: Uint8Array): Blob => {
    console.log(`🔄 Creating WAV blob from ${pcmData.length} bytes of PCM data`);
    
    const sampleRate = 16000;
    const channels = 1;
    const bitsPerSample = 16;

    const headerLength = 44;
    const totalLength = headerLength + pcmData.length;
    const buffer = new ArrayBuffer(totalLength);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, totalLength - 8, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true);
    view.setUint16(32, channels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, "data");
    view.setUint32(40, pcmData.length, true);

    new Uint8Array(buffer, headerLength).set(pcmData);

    const blob = new Blob([buffer], { type: "audio/wav" });
    const audioSeconds = pcmData.length / (16000 * 2);
    console.log(`✅ WAV blob created: ${audioSeconds.toFixed(2)}s duration, ${blob.size} bytes`);
    
    return blob;
  }, []);

  // Simple play function - just play all chunks immediately
  const playAudio = useCallback(() => {
    const debugId = ++debugIdRef.current;
    console.log(`🎯 [${debugId}] playAudio called`);
    
    if (!audioElementRef.current) {
      console.error(`❌ [${debugId}] No audio element available`);
      return;
    }

    if (pcmChunksRef.current.length === 0) {
      console.error(`❌ [${debugId}] No PCM chunks to play`);
      return;
    }

    console.log(`🔧 [${debugId}] Audio element state:`, {
      src: audioElementRef.current.src,
      paused: audioElementRef.current.paused,
      ended: audioElementRef.current.ended,
      readyState: audioElementRef.current.readyState,
      currentTime: audioElementRef.current.currentTime,
    });

    try {
      // Combine all PCM chunks
      const totalLength = pcmChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedPcm = new Uint8Array(totalLength);
      let offset = 0;

      console.log(`🔧 [${debugId}] Combining ${pcmChunksRef.current.length} chunks, total: ${totalLength} bytes`);

      for (const chunk of pcmChunksRef.current) {
        combinedPcm.set(chunk, offset);
        offset += chunk.length;
      }

      const audioSeconds = totalLength / (16000 * 2);
      console.log(`🎵 [${debugId}] Combined audio duration: ${audioSeconds.toFixed(2)}s`);

      // Clean up previous blob URL
      if (currentBlobUrlRef.current) {
        console.log(`🧹 [${debugId}] Cleaning up previous blob URL`);
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }

      // Create WAV blob and play
      const wavBlob = createWAVBlob(combinedPcm);
      currentBlobUrlRef.current = URL.createObjectURL(wavBlob);
      
      console.log(`🔗 [${debugId}] Created new blob URL: ${currentBlobUrlRef.current}`);

      audioElementRef.current.src = currentBlobUrlRef.current;
      console.log(`📋 [${debugId}] Set audio src, attempting to play...`);

      const playPromise = audioElementRef.current.play();
      if (playPromise) {
        playPromise
          .then(() => {
            console.log(`✅ [${debugId}] Audio play() promise resolved`);
          })
          .catch((error) => {
            console.error(`❌ [${debugId}] Audio play() promise rejected:`, error);
          });
      } else {
        console.log(`⚠️ [${debugId}] Audio play() returned undefined (older browser)`);
      }

    } catch (error) {
      console.error(`❌ [${debugId}] Error in playAudio:`, error);
    }
  }, [createWAVBlob]);

  // Add PCM audio chunk
  const addAudioChunk = useCallback(
    (chunk: Uint8Array) => {
      pcmChunksRef.current.push(chunk);
      const totalBytes = pcmChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
      const audioSeconds = totalBytes / (16000 * 2);
      
      console.log(`📥 PCM chunk added: ${chunk.length} bytes`);
      console.log(`📊 Total buffered: ${pcmChunksRef.current.length} chunks, ${audioSeconds.toFixed(2)}s, ${totalBytes} bytes`);
      console.log(`🎮 Current playing state: ${isPlayingRef.current}`);

      // Simple logic: if we have at least 1 second and not currently playing, start
      if (audioSeconds >= 1.0 && !isPlayingRef.current) {
        console.log(`🚀 Auto-starting playback with ${audioSeconds.toFixed(2)}s of audio`);
        playAudio();
      }
    },
    [playAudio]
  );

  // Reset audio stream for new response
  const resetAudioStream = useCallback(() => {
    console.log("🔄 resetAudioStream called");
    
    if (audioElementRef.current) {
      console.log("⏹️ Stopping current audio");
      audioElementRef.current.pause();
      audioElementRef.current.src = "";
    }

    if (currentBlobUrlRef.current) {
      console.log("🧹 Revoking blob URL");
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }

    const oldChunkCount = pcmChunksRef.current.length;
    pcmChunksRef.current = [];
    isPlayingRef.current = false;
    
    console.log(`✅ Reset complete. Cleared ${oldChunkCount} chunks`);
  }, []);

  // Force play complete audio (called when server is done)
  const playCompleteAudio = useCallback(() => {
    const totalBytes = pcmChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
    const audioSeconds = totalBytes / (16000 * 2);

    console.log(`� playCompleteAudio called - ${audioSeconds.toFixed(2)}s total, playing: ${isPlayingRef.current}`);

    if (pcmChunksRef.current.length > 0 && !isPlayingRef.current) {
      console.log("� Force playing all accumulated audio");
      playAudio();
    } else if (isPlayingRef.current) {
      console.log("▶️ Audio already playing, no action needed");
    } else {
      console.log("❌ No audio chunks to play");
    }
  }, [playAudio]);

  // Simplified pause/resume (for VAD)
  const pauseAudio = useCallback(() => {
    if (audioElementRef.current && isPlayingRef.current) {
      console.log("⏸️ Pausing audio via pauseAudio()");
      audioElementRef.current.pause();
    } else {
      console.log("⚠️ pauseAudio called but no audio playing");
    }
  }, []);

  const resumeAudio = useCallback(() => {
    if (audioElementRef.current && !isPlayingRef.current && currentBlobUrlRef.current) {
      console.log("▶️ Resuming audio via resumeAudio()");
      const playPromise = audioElementRef.current.play();
      if (playPromise) {
        playPromise.catch((error) => {
          console.error("❌ Resume failed:", error);
        });
      }
    } else {
      console.log("⚠️ resumeAudio called but conditions not met");
    }
  }, []);

  return {
    setAudioElement,
    addAudioChunk,
    resetAudioStream,
    pauseAudio,
    resumeAudio,
    playCompleteAudio,
    isPlaying: () => isPlayingRef.current,
    isPaused: () => !isPlayingRef.current,
  };
}
