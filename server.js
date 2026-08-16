const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the NICEGOLD website
app.use(express.static(path.join(__dirname, "public")));

// ======================================================
// NICEGOLD BOT STATUS
// ======================================================

let botStatus = {
    server: "online",
    connected: false,
    name: "✞𓉳 ⃝𝗡𝗜𝗖𝗘𝗚𝗢𝗟𝗗₊ ⃝ 𝗠𝗢𝗡𓉳 ⃝𓃵"
};

// ======================================================
// WHATSAPP ENGINE STATUS
// ======================================================

let whatsappStatus = {
    state: "stopped",
    message: "WhatsApp engine is stopped"
};

// ======================================================
// HEALTH API
// ======================================================

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        server: "online",
        name: botStatus.name
    });
});

// ======================================================
// BOT STATUS API
// ======================================================

app.get("/api/status", (req, res) => {
    res.status(200).json({
        server: botStatus.server,
        connected: botStatus.connected,
        name: botStatus.name
    });
});

// ======================================================
// WHATSAPP STATUS API
// ======================================================

app.get("/api/whatsapp/status", (req, res) => {
    res.status(200).json({
        state: whatsappStatus.state,
        message: whatsappStatus.message
    });
});

// ======================================================
// BOT CONNECT API
// ======================================================

app.post("/api/bot/connect", (req, res) => {
    botStatus.connected = true;

    whatsappStatus = {
        state: "starting",
        message: "WhatsApp engine is starting"
    };

    res.status(200).json({
        success: true,
        bot: botStatus,
        whatsapp: whatsappStatus
    });
});

// ======================================================
// BOT DISCONNECT API
// ======================================================

app.post("/api/bot/disconnect", (req, res) => {
    botStatus.connected = false;

    whatsappStatus = {
        state: "stopped",
        message: "WhatsApp engine is stopped"
    };

    res.status(200).json({
        success: true,
        bot: botStatus,
        whatsapp: whatsappStatus
    });
});

// ======================================================
// WEBSITE FALLBACK
// Express 5 compatible
// ======================================================

app.use((req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, "0.0.0.0", () => {
    console.log("✞𓉳 ⃝𝗡𝗜𝗖𝗘𝗚𝗢𝗟𝗗₊ ⃝ 𝗠𝗢𝗡𓉳 ⃝𓃵");
    console.log(`Website running on port ${PORT}`);
});