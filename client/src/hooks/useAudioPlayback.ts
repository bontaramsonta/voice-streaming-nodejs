import { useRef, useCallback } from "react";

export function useAudioPlayback() {
  const audioChunksRef = useRef<Uint8Array[]>([]);
  const playedChunksRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);
  const debugIdRef = useRef(0);
  const isStreamingCompleteRef = useRef(false);

  // Set the audio element reference (called from ChatWidget)
  const setAudioElement = useCallback(
    (audioElement: HTMLAudioElement | null) => {
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

          // Check if we have more audio data to play
          const unplayedChunks = audioChunksRef.current.slice(
            playedChunksRef.current
          );
          if (unplayedChunks.length > 0) {
            const totalBytes = unplayedChunks.reduce(
              (acc, chunk) => acc + chunk.length,
              0
            );
            console.log(
              `🎬 Audio ended but we have ${unplayedChunks.length} unplayed chunks (${totalBytes} bytes) - continuing playback`
            );
            setTimeout(() => {
              if (
                audioChunksRef.current.slice(playedChunksRef.current).length > 0
              ) {
                playAudio();
              }
            }, 100);
          } else if (isStreamingCompleteRef.current) {
            console.log("✅ All audio playback completed - stream finished");
          }
        };

        audioElement.onloadstart = () => {
          console.log("📥 AUDIO EVENT: onloadstart fired");
        };

        audioElement.oncanplay = () => {
          console.log("✅ AUDIO EVENT: oncanplay fired");
        };

        audioElement.ondurationchange = () => {
          console.log(
            `⏱️ AUDIO EVENT: ondurationchange fired - duration: ${audioElement.duration}s`
          );
        };
      }
    },
    []
  );

  // Create MP3 blob from chunks
  const createMP3Blob = useCallback((chunks: Uint8Array[]): Blob => {
    console.log(`🔄 Creating MP3 blob from ${chunks.length} chunks`);

    // Calculate total size
    const totalSize = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    console.log(`� Total MP3 data: ${totalSize} bytes`);

    // Combine all chunks into a single buffer
    const combinedBuffer = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of chunks) {
      combinedBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    const blob = new Blob([combinedBuffer], { type: "audio/mpeg" });
    console.log(`✅ MP3 blob created: ${blob.size} bytes`);

    return blob;
  }, []);

  // Play audio function
  const playAudio = useCallback(() => {
    const debugId = ++debugIdRef.current;
    console.log(`🎯 [${debugId}] playAudio called`);

    if (!audioElementRef.current) {
      console.error(`❌ [${debugId}] No audio element available`);
      return;
    }

    try {
      // Get unplayed chunks
      const unplayedChunks = audioChunksRef.current.slice(
        playedChunksRef.current
      );
      if (unplayedChunks.length === 0) {
        console.log(`⚠️ [${debugId}] No unplayed chunks available`);
        return;
      }

      console.log(
        `🔧 [${debugId}] Playing ${unplayedChunks.length} unplayed chunks (total: ${audioChunksRef.current.length}, played: ${playedChunksRef.current})`
      );

      // Clean up previous blob URL
      if (currentBlobUrlRef.current) {
        console.log(`🧹 [${debugId}] Cleaning up previous blob URL`);
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }

      // Create MP3 blob and play
      const mp3Blob = createMP3Blob(unplayedChunks);
      currentBlobUrlRef.current = URL.createObjectURL(mp3Blob);

      console.log(
        `🔗 [${debugId}] Created new blob URL: ${currentBlobUrlRef.current}`
      );

      audioElementRef.current.src = currentBlobUrlRef.current;
      console.log(`📋 [${debugId}] Set audio src, attempting to play...`);

      // Mark these chunks as being played
      playedChunksRef.current = audioChunksRef.current.length;
      console.log(
        `📍 [${debugId}] Marked ${playedChunksRef.current} chunks as played`
      );

      const playPromise = audioElementRef.current.play();
      if (playPromise) {
        playPromise
          .then(() => {
            console.log(`✅ [${debugId}] Audio play() promise resolved`);
          })
          .catch((error) => {
            console.error(
              `❌ [${debugId}] Audio play() promise rejected:`,
              error
            );
          });
      }
    } catch (error) {
      console.error(`❌ [${debugId}] Error in playAudio:`, error);
    }
  }, [createMP3Blob]);

  // Add audio chunk (now expecting MP3 data)
  const addAudioChunk = useCallback(
    (chunk: Uint8Array) => {
      audioChunksRef.current.push(chunk);
      const totalBytes = audioChunksRef.current.reduce(
        (acc, c) => acc + c.length,
        0
      );

      console.log(`📥 MP3 chunk added: ${chunk.length} bytes`);
      console.log(
        `📊 Total buffered: ${audioChunksRef.current.length} chunks, ${totalBytes} bytes`
      );
      console.log(`🎮 Current playing state: ${isPlayingRef.current}`);

      // Start playback when we have enough data (more conservative for MP3)
      const MIN_CHUNKS_TO_START = 3; // Wait for more chunks to ensure smooth playback

      if (
        audioChunksRef.current.length >= MIN_CHUNKS_TO_START &&
        !isPlayingRef.current
      ) {
        console.log(
          `🚀 Auto-starting MP3 playback with ${audioChunksRef.current.length} chunks`
        );
        playAudio();
      } else if (isPlayingRef.current) {
        const unplayedChunks = audioChunksRef.current.slice(
          playedChunksRef.current
        );
        console.log(
          `🔄 Audio playing, ${unplayedChunks.length} unplayed chunks queued`
        );
      }
    },
    [playAudio]
  );

  // Mark streaming as complete
  const markStreamComplete = useCallback(() => {
    console.log("🏁 Audio streaming marked as complete");
    isStreamingCompleteRef.current = true;
  }, []);

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

    const oldChunkCount = audioChunksRef.current.length;
    audioChunksRef.current = [];
    playedChunksRef.current = 0;
    isPlayingRef.current = false;
    isStreamingCompleteRef.current = false;

    console.log(`✅ Reset complete. Cleared ${oldChunkCount} chunks`);
  }, []);

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
    if (
      audioElementRef.current &&
      !isPlayingRef.current &&
      currentBlobUrlRef.current
    ) {
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
    markStreamComplete,
    resetAudioStream,
    pauseAudio,
    resumeAudio,
    isPlaying: () => isPlayingRef.current,
    isPaused: () => !isPlayingRef.current,
  };
}
