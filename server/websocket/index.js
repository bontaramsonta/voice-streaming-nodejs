import { WebSocketServer } from "ws";
import { writeFile, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import OpenAI from "openai";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const WS_MESSAGE_TYPES = {
  CONTROL: "control",
  AUDIO: "audio",
  TEXT: "text",
};

const WS_CONTROL_MESSAGES = {
  USER_SPEAKING: "user_speaking",
  USER_PAUSED: "user_paused",

  CHAT_MODE: "chat_mode",
  VOICE_MODE: "voice_mode",
};

const WS_RESPONSE_CONTROL_MESSAGES = {
  SERVER_PROCESSING: "server_processing",
  SERVER_READY: "server_ready",
  SERVER_INTERRUPTED: "server_interrupted",
  SERVER_DONE: "server_done",
};


// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Make sure to set this environment variable
});

// Initialize ElevenLabs client
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export function initializeWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    console.log(url.pathname)
    if (!url.pathname.startsWith("/chat/ws")) {
      ws.close(1008, "Invalid WebSocket endpoint");
      return;
    }
    // Extract conversationId from URL path /chat/ws/:conversationId
    // e.g. /chat/ws/12345-abcdef
    const pathParts = url.pathname.split("/");
    const wsId = pathParts.length >= 3 ? pathParts[3] : null;
    if (!wsId) {
      ws.close(1008, "Missing conversationId in URL path");
      return;
    }
    ws.id = wsId
    let recording = true;
    let currentSessionChunks = []; // For accumulating audio during a speaking session
    ws.chatHistory = [
      {
        role: "system",
        content: "You are Mavis a helpful, friendly, and knowledgeable chatbot assistant. Provide clear, concise, and helpful responses to user questions and conversations. Be conversational and engaging while remaining professional, short and to the point.",
      }
    ];
    let currentAbortController = null;

    console.log(`Client connected for client ${ws.id} - Chat history initialized`);
    ws.on("message", async (message) => {
      try {
        // Parse JSON message
        const data = JSON.parse(message.toString());
        console.log("Received message:", data.type != "audio" ? data : "[Audio message]");
        if (data.type === WS_MESSAGE_TYPES.CONTROL) {
          handleWebSocketControlMessage(data.value);
        } else if (data.type === WS_MESSAGE_TYPES.AUDIO && recording) {
          // Audio message - convert back to Buffer from JSON string
          const audioBuffer = Buffer.from(JSON.parse(data.value));
          currentSessionChunks.push(audioBuffer); // Also add to current session
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      recording = false;
      ws.chatHistory = []; // Clear chat history at end of recording session
      console.log(`Recording ended for client ${ws.id}`);

      // Cancel any ongoing operations when client disconnects
      if (currentAbortController) {
        currentAbortController.abort();
        console.log(`🚫 Cancelled ongoing operation for client ${ws.id} - Client disconnected`);
      }
      console.log(`Client disconnected: ${ws.id} - Conversation ended (${ws.chatHistory.length} messages exchanged)`);
    });

    ws.on("error", (error) => {
      console.error(`WebSocket error for client ${ws.id}:`, error);
    });

    async function handleWebSocketControlMessage(msg) {
      if (msg == WS_CONTROL_MESSAGES.USER_SPEAKING) {
        console.log(`User started speaking for client ${ws.id}`);

        // Cancel any ongoing transcription/GPT operations
        if (currentAbortController) {
          currentAbortController.abort();
          console.log(`🚫 Cancelled ongoing operation for client ${ws.id} - User started speaking`);

          // Send interruption message to client
          ws.send(JSON.stringify({
            type: WS_MESSAGE_TYPES.CONTROL,
            value: WS_RESPONSE_CONTROL_MESSAGES.SERVER_INTERRUPTED
          }));
        }

        currentSessionChunks = []; // Reset session chunks when user starts speaking
      } else if (msg == WS_CONTROL_MESSAGES.USER_PAUSED) {
        console.log(`User paused speaking for client ${ws.id}`);

        // Transcribe the current session audio when user pauses
        if (currentSessionChunks.length > 0) {
          // Create new abort controller for this operation
          currentAbortController = new AbortController();
          await transcribeAudio(currentSessionChunks, ws.id, currentAbortController);
        }
      }
    }

    // Function to transcribe audio using OpenAI Whisper
    async function transcribeAudio(audioChunks, clientId, abortController) {
      try {
        // Send processing status to client
        ws.send(JSON.stringify({
          type: WS_MESSAGE_TYPES.CONTROL,
          value: WS_RESPONSE_CONTROL_MESSAGES.SERVER_PROCESSING
        }));

        // Check if operation was cancelled before starting
        if (abortController.signal.aborted) {
          console.log(`🚫 Transcription cancelled before starting for client ${clientId}`);
          return;
        }

        // Combine audio chunks into a single buffer
        const audioBuffer = Buffer.concat(audioChunks);

        // Create WAV file buffer for Whisper
        const wavBuffer = createWavFile(audioBuffer, 16000, 1, 24);

        // Create a temporary file name for this transcription
        const tempFilename = `temp_${clientId}_${Date.now()}.wav`;
        const tempFilepath = `recordings/${tempFilename}`;

        // Write temporary WAV file
        await writeFile(tempFilepath, wavBuffer);

        // Check if operation was cancelled after file write
        if (abortController.signal.aborted) {
          console.log(`🚫 Transcription cancelled after file write for client ${clientId}`);
          await unlink(tempFilepath);
          return;
        }

        // Transcribe using OpenAI Whisper
        console.log(`🎤 Transcribing audio for client ${clientId}...`);

        const transcription = await openai.audio.transcriptions.create({
          file: createReadStream(tempFilepath),
          model: "whisper-1",
          language: "en",
        });

        // Check if operation was cancelled after transcription
        if (abortController.signal.aborted) {
          console.log(`🚫 Transcription cancelled after Whisper API call for client ${clientId}`);
          await unlink(tempFilepath);
          return;
        }

        console.log(`📝 Transcription for client ${clientId}: "${transcription.text}"`);

        // Send transcription to GPT-4 for response
        if (transcription.text.trim()) {
          await getChatGPTResponse(transcription.text, clientId, ws, abortController);
        }

        // Clean up temporary file
        await unlink(tempFilepath);

        // Send completion status to client if not cancelled
        if (!abortController.signal.aborted) {
          ws.send(JSON.stringify({
            type: WS_MESSAGE_TYPES.CONTROL,
            value: WS_RESPONSE_CONTROL_MESSAGES.SERVER_DONE
          }));
          currentAbortController = null; // Clear the abort controller
        }

      } catch (error) {
        if (error.name === 'AbortError') {
          console.log(`🚫 Transcription operation aborted for client ${clientId}`);
        } else {
          console.error(`❌ Error transcribing audio for client ${clientId}:`, error);
        }
      }
    }

    // Function to get response from GPT-4
    async function getChatGPTResponse(userMessage, clientId, wsConnection, abortController) {
      try {
        // Check if operation was cancelled before starting
        if (abortController.signal.aborted) {
          console.log(`🚫 GPT-4 response cancelled before starting for client ${clientId}`);
          return;
        }

        console.log(`🤖 Getting GPT-4 response for client ${clientId}...`);

        // Add user message to chat history
        wsConnection.chatHistory.push({
          role: "user",
          content: userMessage
        });

        wsConnection.send(JSON.stringify({
          type: WS_MESSAGE_TYPES.TEXT,
          value: { user: userMessage }
        }));

        console.log(`💬 Chat history length: ${wsConnection.chatHistory.length} messages`);

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini", // Using gpt-4o-mini as it's more cost-effective
          messages: wsConnection.chatHistory,
          max_tokens: 150,
          temperature: 0.7,
        });

        // Check if operation was cancelled after GPT-4 response
        if (abortController.signal.aborted) {
          console.log(`🚫 GPT-4 response cancelled after API call for client ${clientId}`);
          return;
        }

        const response = completion.choices[0].message.content;

        // Add assistant response to chat history
        wsConnection.chatHistory.push({
          role: "assistant",
          content: response
        });

        wsConnection.send(JSON.stringify({
          type: WS_MESSAGE_TYPES.TEXT,
          value: { assistant: response }
        }));

        console.log(`🤖 GPT-4 Response for client ${clientId}: "${response}"`);

        // Convert response to audio and stream to client
        if (!abortController.signal.aborted) {
          await convertTextToAudioAndStream(response, clientId, wsConnection, abortController);
        }

      } catch (error) {
        console.error(`❌ Error getting GPT-4 response for client ${clientId}:`, error);
      }
    }

    // Function to convert text to audio using ElevenLabs and stream to client
    async function convertTextToAudioAndStream(text, clientId, wsConnection, abortController) {
      try {
        // Check if operation was cancelled before starting
        if (abortController.signal.aborted) {
          console.log(`🚫 Text-to-speech cancelled before starting for client ${clientId}`);
          return;
        }

        wsConnection.send(JSON.stringify({
          type: WS_MESSAGE_TYPES.CONTROL,
          value: WS_RESPONSE_CONTROL_MESSAGES.SERVER_READY
        }));

        console.log(`🔊 Converting text to speech for client ${clientId}...`);

        const audioStream = await elevenlabs.textToSpeech.stream('JBFqnCBsd6RMkjVDRZzb', {
          modelId: 'eleven_multilingual_v2',
          text,
          outputFormat: 'mp3_44100_128',
          voiceSettings: {
            stability: 0,
            similarityBoost: 1.0,
            useSpeakerBoost: true,
            speed: 1.0,
          },
        });

        // Stream audio chunks to client as they become available
        let chunkCount = 0;
        for await (const chunk of audioStream) {
          // log hex chunk
          const hexChunk = chunk.toString('hex').slice(0, 20);
          console.log({ hexChunk })
          // Check if operation was cancelled during streaming
          if (abortController.signal.aborted) {
            console.log(`🚫 Audio streaming cancelled for client ${clientId} after ${chunkCount} chunks`);
            return;
          }

          // Send audio chunk to client
          wsConnection.send(JSON.stringify({
            type: WS_MESSAGE_TYPES.AUDIO,
            value: JSON.stringify(Array.from(chunk))
          }));

          chunkCount++;
        }

        console.log(`🔊 Audio streaming completed for client ${clientId} (${chunkCount} chunks sent)`);

      } catch (error) {
        if (error.name === 'AbortError') {
          console.log(`🚫 Text-to-speech operation aborted for client ${clientId}`);
        } else {
          console.error(`❌ Error converting text to speech for client ${clientId}:`, error);
        }
      }
    }
  });

  return wss;
}


function createWavFile(pcmData, sampleRate, channels, bitDepth) {
  const pcmLength = pcmData.length;

  // WAV header is 44 bytes
  const headerLength = 44;
  const totalLength = headerLength + pcmLength;

  const buffer = Buffer.alloc(totalLength);
  let offset = 0;

  // RIFF header
  buffer.write("RIFF", offset);
  offset += 4;
  buffer.writeUInt32LE(totalLength - 8, offset);
  offset += 4; // File size - 8
  buffer.write("WAVE", offset);
  offset += 4;

  // fmt chunk
  buffer.write("fmt ", offset);
  offset += 4;
  buffer.writeUInt32LE(16, offset);
  offset += 4; // fmt chunk size
  buffer.writeUInt16LE(1, offset);
  offset += 2; // Audio format (1 = PCM)
  buffer.writeUInt16LE(channels, offset);
  offset += 2; // Number of channels
  buffer.writeUInt32LE(sampleRate, offset);
  offset += 4; // Sample rate
  buffer.writeUInt32LE(sampleRate * channels * (bitDepth / 8), offset);
  offset += 4; // Byte rate
  buffer.writeUInt16LE(channels * (bitDepth / 8), offset);
  offset += 2; // Block align
  buffer.writeUInt16LE(bitDepth, offset);
  offset += 2; // Bits per sample

  // data chunk
  buffer.write("data", offset);
  offset += 4;
  buffer.writeUInt32LE(pcmLength, offset);
  offset += 4; // Data size

  // Copy PCM data
  pcmData.copy(buffer, offset);

  return buffer;
}
