const express = require("express");
const path = require("path");
require("dotenv").config();

const {
    startBot,
    stopBot,
    getBotStatus
} = require("./bot");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve NICEGOLD website
app.use(express.static(path.join(__dirname, "public")));

// NICEGOLD information
const botName = "✞𓉳 ⃝𝗡𝗜𝗖𝗘𝗚𝗢𝗟𝗗₊ ⃝ 𝗠𝗢𝗡𓉳 ⃝𓃵";

// =====================================================
// HEALTH
// =====================================================

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        server: "online",
        name: botName
    });
});

// =====================================================
// BOT STATUS
// =====================================================

app.get("/api/status", (req, res) => {
    const status = getBotStatus();

    res.json({
        server: "online",
        connected: status.state === "ready",
        name: botName,
        bot: status
    });
});

// =====================================================
// WHATSAPP STATUS
// =====================================================

app.get("/api/whatsapp/status", (req, res) => {
    res.json(getBotStatus());
});

// =====================================================
// START WHATSAPP BOT
// =====================================================

app.post("/api/bot/connect", async (req, res) => {
    try {
        const status = await startBot();

        res.json({
            success: true,
            status
        });

    } catch (error) {
        console.error("NICEGOLD start error:", error);

        res.status(500).json({
            success: false,
            error: "Failed to start WhatsApp engine"
        });
    }
});

// =====================================================
// STOP WHATSAPP BOT
// =====================================================

app.post("/api/bot/disconnect", async (req, res) => {
    try {
        const status = await stopBot();

        res.json({
            success: true,
            status
        });

    } catch (error) {
        console.error("NICEGOLD stop error:", error);

        res.status(500).json({
            success: false,
            error: "Failed to stop WhatsApp engine"
        });
    }
});

// =====================================================
// WEBSITE FALLBACK
// =====================================================

app.use((req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        "✞𓉳 ⃝𝗡𝗜𝗖𝗘𝗚𝗢𝗟𝗗₊ ⃝ 𝗠𝗢𝗡𓉳 ⃝𓃵"
    );

    console.log(
        `Website running on port ${PORT}`
    );
});