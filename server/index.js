import "dotenv/config";
import { createServer } from "node:http";
import app from "./router/index.js";
import { initializeWebSocket } from "./websocket/index.js";

const server = createServer(app);
const PORT = 8000;

// Initialize WebSocket server
initializeWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
