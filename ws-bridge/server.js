import zmq from "zeromq";
import { WebSocketServer, WebSocket } from "ws";

const ZMQ_ADDR = process.env.ZMQ_ADDR || "tcp://node:28332";
const WS_PORT = parseInt(process.env.WS_PORT || "3000", 10);
const TOPICS = ["rawblock", "rawtx", "hashblock", "hashtx"];

const sock = new zmq.Subscriber();
sock.connect(ZMQ_ADDR);
for (const t of TOPICS) sock.subscribe(t);

const wss = new WebSocketServer({ port: WS_PORT, host: "0.0.0.0" });

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
