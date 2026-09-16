const express = require("express");
const path = require("path");
require("dotenv").config();

const {
  startBot,
  stopBot,
  getBotStatus,
  getPairingCode
} = require("./bot");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

const botName =
  "✞𓉳 ⃝𝗡𝗜𝗖𝗘𝗚𝗢𝗟𝗗₊ ⃝ 𝗠𝗢𝗡𓉳 ⃝𓃵";

// Health
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    server: "online",
    name: botName
  });
});

// Bot status
app.get("/api/status", (req, res) => {
  const status = getBotStatus();

  res.json({
    server: "online",
    connected: status.state === "ready",
    name: botName,
    bot: status
  });
});

// WhatsApp status
app.get("/api/whatsapp/status", (req, res) => {
  res.json(getBotStatus());
});

// Start WhatsApp
app.post("/api/bot/connect", async (req, res) => {
  try {
    const phoneNumber = req.body.phoneNumber;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: "WhatsApp phone number is required"
      });
    }

    const status = await startBot(phoneNumber);

    res.json({
      success: true,
      status
    });

  } catch (error) {
    console.error(
      "NICEGOLD start error:",
      error
    );

    res.status(500).json({
      success: false,
      error: "Failed to start WhatsApp engine"
    });
  }
});

// Pairing code
app.get("/api/whatsapp/pairing", (req, res) => {
  const code = getPairingCode();

  res.json({
    available: Boolean(code),
    pairingCode: code || null
  });
});

// Authentication data status
app.get("/api/whatsapp/auth", (req, res) => {

  res.json({
    available: Boolean(qr),
    qr: qr || null
  });
});

// Stop WhatsApp
app.post("/api/bot/disconnect", async (req, res) => {
  try {
    const status = await stopBot();

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error(
      "NICEGOLD stop error:",
      error
    );

    res.status(500).json({
      success: false,
      error: "Failed to stop WhatsApp engine"
    });
  }
});

// Website fallback
app.use((req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    "✞𓉳 ⃝𝗡𝗜𝗖𝗘𝗚𝗢𝗟𝗗₊ ⃝ 𝗠𝗢𝗡𓉳 ⃝𓃵"
  );

  console.log(
    `Website running on port ${PORT}`
  );
});