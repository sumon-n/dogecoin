import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import zmq from "zeromq";
import { WebSocketServer, WebSocket } from "ws";

const ZMQ_ADDR = process.env.ZMQ_ADDR || "tcp://node:28332";
const WS_PORT = parseInt(process.env.WS_PORT || "3000", 10);
const TOPICS = ["rawblock", "rawtx", "hashblock", "hashtx"];

const sock = new zmq.Subscriber();
sock.connect(ZMQ_ADDR);
for (const t of TOPICS) sock.subscribe(t);

const statusPage = await readFile(new URL("./index.html", import.meta.url));
const server = createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(statusPage);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});
const wss = new WebSocketServer({ server });
server.listen(WS_PORT, "0.0.0.0");

wss.on("connection", (ws) => {
  ws.send(
    JSON.stringify({ type: "connected", topics: TOPICS, timestamp: Date.now() })
  );
});

const broadcast = (msg) => {
  const data = JSON.stringify(msg);
  for (const c of wss.clients) {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  }
};

console.log(`WS bridge listening on :${WS_PORT} <- ZMQ ${ZMQ_ADDR}`);

for await (const frames of sock) {
  const topic = frames[0].toString();
  // remaining frames: body (binary for raw*, hex for hash*) + sequence number
  const body = frames.length > 1 ? frames[1].toString("hex") : "";
  const seq = frames.length > 2 ? frames[2].readUInt32LE(0) : null;
  broadcast({ type: topic, hex: body, sequence: seq, timestamp: Date.now() });
}
