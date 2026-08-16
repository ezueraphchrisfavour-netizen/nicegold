const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@vansnowi/baileys");

const path = require("path");

let sock = null;
let starting = false;
let pairingCode = null;

let botStatus = {
  state: "stopped",
  message: "WhatsApp engine is stopped"
};

async function startBot(phoneNumber) {
  if (starting) {
    return botStatus;
  }

  if (sock) {
    return botStatus;
  }

  if (!phoneNumber) {
    botStatus = {
      state: "error",
      message: "WhatsApp phone number is required"
    };

    return botStatus;
  }

  starting = true;
  pairingCode = null;

  botStatus = {
    state: "starting",
    message: "Starting WhatsApp engine..."
  };

  try {
    const authFolder = path.join(__dirname, "auth");

    const {
      state,
      saveCreds
    } = await useMultiFileAuthState(authFolder);

    sock = makeWASocket({
      auth: state
    });

    sock.ev.on(
      "creds.update",
      saveCreds
    );

    sock.ev.on(
      "connection.update",
      ({ connection, lastDisconnect }) => {

        if (connection === "connecting") {
          botStatus = {
            state: "connecting",
            message: "Connecting to WhatsApp..."
          };
        }

        if (connection === "open") {
          pairingCode = null;
          starting = false;

          botStatus = {
            state: "ready",
            message: "WhatsApp engine is connected"
          };

          console.log(
            "NICEGOLD WhatsApp engine connected."
          );
        }

        if (connection === "close") {
          const statusCode =
            lastDisconnect
              ?.error
              ?.output
              ?.statusCode;

          sock = null;
          starting = false;

          if (
            statusCode ===
            DisconnectReason.loggedOut
          ) {
            botStatus = {
              state: "stopped",
              message:
                "WhatsApp session logged out"
            };
          } else {
            botStatus = {
              state: "stopped",
              message:
                "WhatsApp connection closed"
            };
          }

          console.log(
            "NICEGOLD WhatsApp connection closed."
          );
        }
      }
    );

    botStatus = {
      state: "connecting",
      message:
        "WhatsApp engine is connecting..."
    };

    await new Promise((resolve) =>
      setTimeout(resolve, 3000)
    );

    if (!state.creds.registered) {

      const cleanNumber =
        String(phoneNumber)
          .replace(/\D/g, "");

      console.log(
        "Requesting WhatsApp pairing code..."
      );

      pairingCode =
        await sock.requestPairingCode(
          cleanNumber
        );

      botStatus = {
        state: "pairing",
        message:
          "WhatsApp pairing code generated"
      };

      console.log(
        "NICEGOLD pairing code:",
        pairingCode
      );
    }

  } catch (error) {

    sock = null;
    starting = false;
    pairingCode = null;

    botStatus = {
      state: "error",
      message:
        "Failed to start WhatsApp engine"
    };

    console.error(
      "NICEGOLD WhatsApp error:",
      error
    );
  }

  return botStatus;
}

async function stopBot() {

  if (!sock) {
    botStatus = {
      state: "stopped",
      message:
        "WhatsApp engine is already stopped"
    };

    return botStatus;
  }

  try {

    sock.end(
      new Error(
        "NICEGOLD engine stopped"
      )
    );

  } catch (error) {

    console.error(
      "Error stopping WhatsApp:",
      error
    );

  }

  sock = null;
  starting = false;
  pairingCode = null;

  botStatus = {
    state: "stopped",
    message:
      "WhatsApp engine stopped"
  };

  return botStatus;
}

function getBotStatus() {
  return botStatus;
}

function getPairingCode() {
  return pairingCode;
}

module.exports = {
  startBot,
  stopBot,
  getBotStatus,
  getPairingCode
};