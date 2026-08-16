const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@vansnowi/baileys");

const path = require("path");

let sock = null;

let botStatus = {
  state: "stopped",
  message: "WhatsApp engine is stopped"
};

let starting = false;


async function startBot() {

  if (starting) {
    return botStatus;
  }

  if (sock) {
    return botStatus;
  }

  starting = true;

  botStatus = {
    state: "starting",
    message: "Starting WhatsApp engine..."
  };

  try {

    const authFolder =
      path.join(__dirname, "auth");

    const {
      state,
      saveCreds
    } = await useMultiFileAuthState(
      authFolder
    );


    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true
    });


    sock.ev.on(
      "creds.update",
      saveCreds
    );


    sock.ev.on(
      "connection.update",
      ({ connection, lastDisconnect }) => {

        if (connection === "open") {

          botStatus = {
            state: "ready",
            message:
              "WhatsApp engine is connected"
          };

          starting = false;

          console.log(
            "NICEGOLD WhatsApp engine connected."
          );

          return;
        }


        if (connection === "connecting") {

          botStatus = {
            state: "connecting",
            message:
              "Connecting to WhatsApp..."
          };

          return;
        }


        if (connection === "close") {

          sock = null;
          starting = false;

          const statusCode =
            lastDisconnect
              ?.error
              ?.output
              ?.statusCode;


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


  } catch (error) {

    sock = null;
    starting = false;

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


module.exports = {
  startBot,
  stopBot,
  getBotStatus
};


if (require.main === module) {

  startBot();

}
