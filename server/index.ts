import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const server = createServer();

const WS_CONTROL_MESSAGES: Record<number, string> = {
  1: "record-start",
  2: "record-end",
} as const;

const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
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

  ws.on("error", (error) => {
    console.error(`WebSocket error for client ${ws.id}:`, error);
  });

  async function handleWebSocketControlMessage(
    msg: (typeof WS_CONTROL_MESSAGES)[number],
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
        const err = await writeToFile(buffer, filename);
        if (err) {
          console.error(`Error writing file for client ${ws.id}:`, err);
          // ws.send(JSON.stringify(err));
        }
        console.log(`Saved recording for client ${ws.id} to ${filename}`);
        // ws.send(
        //   JSON.stringify({ event: "recording-saved", filename: filename }),
        // );
      }
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
    // Write to file
    const filepath = `recordings/${filename}.webm`;
    await writeFile(filepath, buf);
    return null;
  } catch (err) {
    return { event: "error", message: "Failed to save recording" };
  }
}
