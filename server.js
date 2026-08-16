const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve website
app.use(express.static(path.join(__dirname, "public")));

// Bot status
let botStatus = {
  server: "online",
  connected: false,
  name: "✞𓉳 ⃝𝗡𝗜𝗖𝗘𝗚𝗢𝗟𝗗₊ ⃝ 𝗠𝗢𝗡𓉳 ⃝𓃵"
};

// WhatsApp engine status
let whatsappStatus = {
  state: "stopped",
  message: "WhatsApp engine is stopped"
};

// Health
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    server: "online"
  });
});

// Bot status
app.get("/api/status", (req, res) => {
  res.json(botStatus);
});

// WhatsApp status
app.get("/api/whatsapp/status", (req, res) => {
  res.json(whatsappStatus);
});

// Bot connect
app.post("/api/bot/connect", (req, res) => {
  botStatus.connected = true;

  whatsappStatus = {
    state: "starting",
    message: "WhatsApp engine is starting"
  };

  res.json({
    success: true,
    status: botStatus,
    whatsapp: whatsappStatus
  });
});

// Bot disconnect
app.post("/api/bot/disconnect", (req, res) => {
  botStatus.connected = false;

  whatsappStatus = {
    state: "stopped",
    message: "WhatsApp engine is stopped"
  };

  res.json({
    success: true,
    status: botStatus,
    whatsapp: whatsappStatus
  });
});

// Fallback to website
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("✞𓉳 ⃝𝗡𝗜𝗖𝗘𝗚𝗢𝗟𝗗₊ ⃝ 𝗠𝗢𝗡𓉳 ⃝𓃵");
  console.log(`Website running on port ${PORT}`);
});