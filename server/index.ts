import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "node:http";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const server = createServer();

const WS_CONTROL_MESSAGES: Record<number, string> = {
  1: "record-start",
  2: "record-end",
  3: "user-speaking",
  4: "user-paused",
} as const;

// Extend WebSocket type to include id property
interface ExtendedWebSocket extends WebSocket {
  id?: string;
}

const wss = new WebSocketServer({ server });
wss.on("connection", (ws: ExtendedWebSocket) => {
  ws.id = Date.now() + "-" + Math.random().toString(36).slice(2, 11);
  console.log(`Client connected: ${ws.id}`);

  let chunks: Uint8Array[] = [];
  let recording = false;

  ws.on("message", async (message: Uint8Array) => {
    console.log("got message", message.length);
    if (message.length == 1) {
      const msg = WS_CONTROL_MESSAGES[message[0]!];
      if (!msg) {
        console.log("Invalid WS Control message", message);
      } else {
        handleWebSocketControlMessage(msg);
      }
    } else if (recording) {
      // to write each chunk of recording as file
      // const filename = `${ws.id}_${Math.random().toString(36).slice(2, 11)}`;
      // const err = await writeToFile(message, filename);
      chunks.push(message);
    }
  });

  ws.on("close", () => {
    console.log(`Client disconnected: ${ws.id}`);
  });

  ws.on("error", (error: Error) => {
    console.error(`WebSocket error for client ${ws.id}:`, error);
  });

  async function handleWebSocketControlMessage(
    msg: (typeof WS_CONTROL_MESSAGES)[number]
  ) {
    if (msg == "record-start") {
      chunks = [];
      recording = true;
      console.log(`Recording started for client ${ws.id}`);
      // ws.send(JSON.stringify({ event: "recording-started" }));
    } else if (msg == "record-end") {
      recording = false;
      console.log(`Recording ended for client ${ws.id}`);

      if (chunks.length > 0) {
        // Combine chunks into a single buffer
        const buffer = Buffer.concat(chunks);
        // return;
        // write to file
        const filename = `${ws.id}_${Math.random().toString(36).slice(2, 11)}`;
        const err = await writeToFile(buffer.buffer, filename);
        if (err) {
          console.error(`Error writing file for client ${ws.id}:`, err);
          // ws.send(JSON.stringify(err));
        }
        console.log(`Saved recording for client ${ws.id} to ${filename}`);
        // ws.send(
        //   JSON.stringify({ event: "recording-saved", filename: filename }),
        // );
      }
    } else if (msg == "user-speaking") {
      console.log(`User started speaking for client ${ws.id}`);
    } else if (msg == "user-paused") {
      console.log(`User paused speaking for client ${ws.id}`);
    }
  }
});

const app = express();
const PORT = 4000;

app.get("/", (_, res) => {
  res.json({ ok: new Date() });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

async function writeToFile(buf: ArrayBufferLike, filename: string) {
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

function createWavFile(
  pcmData: Buffer,
  sampleRate: number,
  channels: number,
  bitDepth: number
): Buffer {
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
