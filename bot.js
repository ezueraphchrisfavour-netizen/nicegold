const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  delay
} = require("@pasqua-baileys/baileys");

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

    const { state, saveCreds } =
      await useMultiFileAuthState(authFolder);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      console.log(
        "NICEGOLD connection update:",
        connection || "no-change"
      );

      if (connection === "connecting") {
        botStatus = {
          state: "connecting",
          message: "Connecting to WhatsApp..."
        };

        /*
         * Only request a pairing code once.
         * Give the socket time to establish its transport first.
         */
        if (!state.creds.registered && !pairingCode) {
          try {
            await delay(2500);

            if (!sock) {
              return;
            }

            const cleanNumber = String(phoneNumber)
              .replace(/\D/g, "");

            console.log(
              "Requesting WhatsApp pairing code..."
            );

            const code =
              await sock.requestPairingCode(cleanNumber);

            pairingCode = code;

            botStatus = {
              state: "pairing",
              message: "WhatsApp pairing code generated"
            };

            console.log(
              "NICEGOLD pairing code:",
              pairingCode
            );

          } catch (error) {
            console.error(
              "NICEGOLD pairing error:",
              error
            );

            pairingCode = null;

            /*
             * Do not immediately destroy the socket here.
             * The connection handler will decide what happens next.
             */
            botStatus = {
              state: "error",
              message:
                "Failed to generate WhatsApp pairing code"
            };
          }
        }

        return;
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

        return;
      }

      if (connection === "close") {
        const statusCode =
          lastDisconnect
            ?.error
            ?.output
            ?.statusCode;

        console.log(
          "NICEGOLD WhatsApp connection closed.",
          "status:",
          statusCode
        );

        sock = null;
        starting = false;

        if (
          statusCode ===
          DisconnectReason.loggedOut
        ) {
          pairingCode = null;

          botStatus = {
            state: "stopped",
            message:
              "WhatsApp session logged out"
          };
        } else {
          /*
           * Keep the status clear instead of immediately
           * trying to request another code from a dead socket.
           */
          botStatus = {
            state: "stopped",
            message:
              "WhatsApp connection closed"
          };
        }

        return;
      }
    });

  } catch (error) {
    console.error(
      "NICEGOLD WhatsApp error:",
      error
    );

    sock = null;
    starting = false;
    pairingCode = null;

    botStatus = {
      state: "error",
      message:
        "Failed to start WhatsApp engine"
    };
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