import { WebSocketServer } from "ws";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const WS_CONTROL_MESSAGES = {
  1: "record-start",
  2: "record-end",
  3: "user-speaking",
  4: "user-paused",
};

export function initializeWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.id = Date.now() + "-" + Math.random().toString(36).slice(2, 11);
    console.log(`Client connected: ${ws.id}`);

    let chunks = [];
    let recording = false;

    ws.on("message", async (message) => {
      try {
        // Parse JSON message
        const data = JSON.parse(message.toString());
        console.log("got message", data);

        if (data.t === 1) {
          // Control message
          const msg = WS_CONTROL_MESSAGES[data.v];
          if (!msg) {
            console.log("Invalid WS Control message", data);
          } else {
            handleWebSocketControlMessage(msg);
          }
        } else if (data.t === 2 && recording) {
          // Audio message - convert back to Buffer from JSON string
          const audioBuffer = Buffer.from(JSON.parse(data.v));
          chunks.push(audioBuffer);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      console.log(`Client disconnected: ${ws.id}`);
    });

    ws.on("error", (error) => {
      console.error(`WebSocket error for client ${ws.id}:`, error);
    });

    async function handleWebSocketControlMessage(msg) {
      if (msg == "record-start") {
        chunks = [];
        recording = true;
        console.log(`Recording started for client ${ws.id}`);
      } else if (msg == "record-end") {
        recording = false;
        console.log(`Recording ended for client ${ws.id}`);

        if (chunks.length > 0) {
          // Combine chunks into a single buffer
          const buffer = Buffer.concat(chunks);
          // return;
          // write to file
          const filename = `${ws.id}_${Math.random()
            .toString(36)
            .slice(2, 11)}`;
          const err = await writeToFile(buffer.buffer, filename);
          if (err) {
            console.error(`Error writing file for client ${ws.id}:`, err);
          }
          console.log(`Saved recording for client ${ws.id} to ${filename}`);
        }
      } else if (msg == "user-speaking") {
        console.log(`User started speaking for client ${ws.id}`);
      } else if (msg == "user-paused") {
        console.log(`User paused speaking for client ${ws.id}`);
      }
    }
  });

  return wss;
}

async function writeToFile(buf, filename) {
  console.log("writing to file");
  try {
    // Ensure recordings directory exists
    if (!existsSync("recordings")) {
      await mkdir("recordings", { recursive: true });
    }

    // Convert ArrayBufferLike to Buffer
    const buffer = Buffer.from(buf);

    // Save raw PCM data
    const pcmFilepath = `recordings/${filename}.pcm`;
    await writeFile(pcmFilepath, buffer);

    // Also create a WAV file for easier playback
    const wavBuffer = createWavFile(buffer, 48000, 1, 24);
    const wavFilepath = `recordings/${filename}.wav`;
    await writeFile(wavFilepath, wavBuffer);

    console.log(`Saved PCM: ${pcmFilepath} and WAV: ${wavFilepath}`);
    return null;
  } catch (err) {
    return { event: "error", message: "Failed to save recording" };
  }
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
