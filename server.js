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


/* =====================================================
   MIDDLEWARE
   ===================================================== */

app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


/* =====================================================
   NICEGOLD BRAND
   ===================================================== */

console.log(
  "✞𓉳 ⃝𝗡𝗜𝗖𝗘𝗚𝗢𝗟𝗗₊ ⃝ 𝗠𝗢𝗡𓉳 ⃝𓃵"
);


/* =====================================================
   HEALTH
   ===================================================== */

app.get("/api/health", (req, res) => {

  res.json({
    ok: true,
    service: "NICEGOLD",
    message: "NICEGOLD server is online"
  });

});


/* =====================================================
   GENERAL STATUS
   ===================================================== */

app.get("/api/status", (req, res) => {

  const bot =
    typeof getBotStatus === "function"
      ? getBotStatus()
      : {
          state: "unknown",
          message: "Bot status unavailable"
        };

  res.json({
    server: "online",

    bot: bot,

    name:
      "✞𓉳 ⃝𝗡𝗜𝗖𝗘𝗚𝗢𝗟𝗗₊ ⃝ 𝗠𝗢𝗡𓉳 ⃝𓃵"
  });

});


/* =====================================================
   WHATSAPP STATUS
   ===================================================== */

app.get("/api/whatsapp/status", (req, res) => {

  const status =
    typeof getBotStatus === "function"
      ? getBotStatus()
      : {
          state: "stopped",
          message:
            "WhatsApp engine is stopped"
        };

  res.json(status);

});


/* =====================================================
   WHATSAPP PAIRING CODE
   ===================================================== */

app.get("/api/whatsapp/pairing", (req, res) => {

  const code =
    typeof getPairingCode === "function"
      ? getPairingCode()
      : null;

  res.json({
    available: Boolean(code),
    pairingCode: code || null
  });

});


/* =====================================================
   START WHATSAPP
   ===================================================== */

app.post("/api/bot/connect", async (req, res) => {

  try {

    const {
      phoneNumber
    } = req.body || {};

    if (!phoneNumber) {

      return res.status(400).json({
        success: false,
        message:
          "WhatsApp phone number is required"
      });

    }

    const result =
      await startBot(phoneNumber);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {

    console.error(
      "NICEGOLD connect error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to start WhatsApp engine"
    });

  }

});


/* =====================================================
   STOP WHATSAPP
   ===================================================== */

app.post("/api/bot/disconnect", async (req, res) => {

  try {

    const result =
      await stopBot();

    res.json({
      success: true,
      ...result
    });

  } catch (error) {

    console.error(
      "NICEGOLD disconnect error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to stop WhatsApp engine"
    });

  }

});


/* =====================================================
   NICEGOLD DYNAMIC NEWS
   ===================================================== */

let nicegoldNews = [

  {
    type: "SYSTEM",

    title:
      "NICEGOLD Control Center is online",

    message:
      "The NICEGOLD MON control panel is running normally.",

    time: "LIVE"
  },


  {
    type: "BOT",

    title:
      "WhatsApp connection interface updated",

    message:
      "The WhatsApp connection interface is available from the control center.",

    time: "TODAY"
  },


  {
    type: "UPDATE",

    title:
      "Diamond Blue interface deployed",

    message:
      "The NICEGOLD dashboard has received the new Diamond Blue interface.",

    time: "TODAY"
  },


  {
    type: "SYSTEM",

    title:
      "NICEGOLD monitoring is active",

    message:
      "Server and system status can be monitored from the dashboard.",

    time: "LIVE"
  }

];


/* =====================================================
   NEWS API
   ===================================================== */

app.get("/api/news", (req, res) => {

  res.json({

    success: true,

    news: nicegoldNews

  });

});


/* =====================================================
   DEFAULT WEBSITE ROUTE
   ===================================================== */

app.get("/", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );

});


/* =====================================================
   404
   ===================================================== */

app.use((req, res) => {

  res.status(404).json({

    success: false,

    message:
      "NICEGOLD route not found"

  });

});


/* =====================================================
   START SERVER
   ===================================================== */
app.get("/api/news", (req, res) => {
  res.json({
    success: true,
    news: [
      {
        type: "SYSTEM",
        time: new Date().toISOString(),
        title: "NICEGOLD Control Panel Online",
        message: "The NICEGOLD MON control system is running normally."
      },
      {
        type: "WHATSAPP",
        time: new Date().toISOString(),
        title: "WhatsApp Engine",
        message: "WhatsApp pairing is available from the control panel."
      },
      {
        type: "WEBSITE",
        time: new Date().toISOString(),
        title: "Diamond Blue Interface",
        message: "NICEGOLD MON has been updated with the new dynamic interface."
      }
    ]
  });
});

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Website running on port ${PORT}`
    );

  }
);