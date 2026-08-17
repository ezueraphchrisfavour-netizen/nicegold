const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();

const {
  startBot,
  stopBot,
  getBotStatus,
  getPairingCode
} = require("./bot");

const app = express();

const PORT = process.env.PORT || 3000;

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "change-this-password";

const ACCESS_FILE =
  path.join(__dirname, "access-requests.json");


/* =====================================================
   MIDDLEWARE
   ===================================================== */

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


/* =====================================================
   NICEGOLD BRAND
   ===================================================== */

const NICEGOLD_NAME =
  "✞𓉳 ⃝𝗡𝗜𝗖𝗘𝗚𝗢𝗟𝗗₊ ⃝ 𝗠𝗢𝗡𓉳 ⃝𓃵";

console.log(NICEGOLD_NAME);


/* =====================================================
   ACCESS REQUEST STORAGE
   ===================================================== */

function loadAccessRequests() {

  try {

    if (!fs.existsSync(ACCESS_FILE)) {
      fs.writeFileSync(
        ACCESS_FILE,
        "[]",
        "utf8"
      );
    }

    const data =
      fs.readFileSync(
        ACCESS_FILE,
        "utf8"
      );

    const parsed =
      JSON.parse(data);

    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (error) {

    console.error(
      "Could not load access requests:",
      error
    );

    return [];
  }
}


function saveAccessRequests(requests) {

  fs.writeFileSync(
    ACCESS_FILE,
    JSON.stringify(
      requests,
      null,
      2
    ),
    "utf8"
  );
}


/* =====================================================
   NEWS STORAGE
   ===================================================== */

let nicegoldNews = [
  {
    type: "SYSTEM",
    title:
      "NICEGOLD Control Center is online",
    message:
      "The NICEGOLD MON control panel is running normally.",
    time: "LIVE"
  }
];


function addNICEGOLDNews(
  type,
  title,
  message
) {

  nicegoldNews.unshift({

    type,
    title,
    message,

    time:
      new Date().toISOString()

  });


  if (
    nicegoldNews.length > 20
  ) {

    nicegoldNews =
      nicegoldNews.slice(
        0,
        20
      );

  }

}


/* =====================================================
   HEALTH
   ===================================================== */

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      ok: true,

      service:
        "NICEGOLD",

      message:
        "NICEGOLD server is online"

    });

  }
);


/* =====================================================
   GENERAL STATUS
   ===================================================== */

app.get(
  "/api/status",
  (req, res) => {

    let bot;

    try {

      bot =
        typeof getBotStatus === "function"
          ? getBotStatus()
          : {
              state: "unknown",
              message:
                "Bot status unavailable"
            };

    } catch (error) {

      bot = {
        state: "unknown",
        message:
          "Bot status unavailable"
      };

    }


    res.json({

      server:
        "online",

      bot,

      name:
        NICEGOLD_NAME

    });

  }
);


/* =====================================================
   WHATSAPP STATUS
   ===================================================== */

app.get(
  "/api/whatsapp/status",
  (req, res) => {

    try {

      const status =
        typeof getBotStatus === "function"
          ? getBotStatus()
          : {
              state: "stopped",
              message:
                "WhatsApp engine is stopped"
            };

      res.json(status);

    } catch (error) {

      res.json({

        state:
          "stopped",

        message:
          "WhatsApp engine is stopped"

      });

    }

  }
);


/* =====================================================
   WHATSAPP PAIRING CODE
   ===================================================== */

app.get(
  "/api/whatsapp/pairing",
  (req, res) => {

    try {

      const code =
        typeof getPairingCode === "function"
          ? getPairingCode()
          : null;

      res.json({

        available:
          Boolean(code),

        pairingCode:
          code || null

      });

    } catch (error) {

      res.status(500).json({

        available:
          false,

        pairingCode:
          null

      });

    }

  }
);


/* =====================================================
   START WHATSAPP
   ===================================================== */

app.post(
  "/api/bot/connect",
  async (req, res) => {

    try {

      const {
        phoneNumber
      } = req.body || {};


      if (!phoneNumber) {

        return res.status(400).json({

          success:
            false,

          message:
            "WhatsApp phone number is required"

        });

      }


      if (
        typeof startBot !==
        "function"
      ) {

        return res.status(500).json({

          success:
            false,

          message:
            "WhatsApp engine is unavailable"

        });

      }


      addNICEGOLDNews(
        "BOT",
        "WhatsApp engine starting",
        "The NICEGOLD WhatsApp engine is starting."
      );


      const result =
        await startBot(
          phoneNumber
        );


      res.json({

        success:
          true,

        ...result

      });

    } catch (error) {

      console.error(
        "NICEGOLD connect error:",
        error
      );


      addNICEGOLDNews(
        "BOT",
        "WhatsApp connection error",
        "The WhatsApp engine could not be started."
      );


      res.status(500).json({

        success:
          false,

        message:
          "Failed to start WhatsApp engine"

      });

    }

  }
);


/* =====================================================
   STOP WHATSAPP
   ===================================================== */

app.post(
  "/api/bot/disconnect",
  async (req, res) => {

    try {

      if (
        typeof stopBot !==
        "function"
      ) {

        return res.status(500).json({

          success:
            false,

          message:
            "WhatsApp engine is unavailable"

        });

      }


      const result =
        await stopBot();


      addNICEGOLDNews(
        "BOT",
        "WhatsApp engine stopped",
        "The NICEGOLD WhatsApp engine has been stopped."
      );


      res.json({

        success:
          true,

        ...result

      });

    } catch (error) {

      console.error(
        "NICEGOLD disconnect error:",
        error
      );


      res.status(500).json({

        success:
          false,

        message:
          "Failed to stop WhatsApp engine"

      });

    }

  }
);


/* =====================================================
   ADMIN LOGIN
   ===================================================== */

app.post(
  "/api/admin/login",
  (req, res) => {

    const {
      username,
      password
    } = req.body || {};


    if (
      username !==
        ADMIN_USERNAME ||
      password !==
        ADMIN_PASSWORD
    ) {

      return res.status(401).json({

        success:
          false,

        message:
          "Invalid administrator credentials."

      });

    }


    const token =
      crypto
        .randomBytes(32)
        .toString("hex");

    adminSessions.add(token);

    res.json({

      success:
        true,

      token,

      message:
        "Administrator login successful.",

      redirect:
        "/admin.html"

    });

  }
);


/* =====================================================
   ADMIN TOKEN CHECK
   ===================================================== */

const adminSessions =
  new Set();


function requireAdmin(
  req,
  res,
  next
) {

  const auth =
    req.headers.authorization || "";


  const token =
    auth.startsWith("Bearer ")
      ? auth.slice(7).trim()
      : "";


  if (
    !token ||
    !adminSessions.has(token)
  ) {

    return res.status(401).json({

      success:
        false,

      message:
        "Administrator authorization required."

    });

  }


  req.adminToken =
    token;

  next();

}


/* =====================================================
   ACCESS REQUEST
   ===================================================== */

app.post(
  "/api/access/request",
  (req, res) => {

    try {

      const {
        name,
        contact
      } = req.body || {};


      const cleanName =
        String(
          name || ""
        ).trim();


      const cleanContact =
        String(
          contact || ""
        ).trim();


      if (
        !cleanName ||
        !cleanContact
      ) {

        return res.status(400).json({

          success:
            false,

          message:
            "Name and contact are required."

        });

      }


      const requests =
        loadAccessRequests();


      /*
       * Prevent the same contact
       * from creating endless pending
       * requests.
       */

      const existing =
        requests.find(
          item =>
            item.contact ===
              cleanContact &&
            item.status ===
              "pending"
        );


      if (existing) {

        return res.status(409).json({

          success:
            false,

          message:
            "A request from this contact is already pending.",

          requestId:
            existing.requestId

        });

      }


      const requestId =
        "NG-" +
        Date.now()
          .toString(36)
          .toUpperCase() +
        "-" +
        crypto
          .randomBytes(3)
          .toString("hex")
          .toUpperCase();


      const request = {

        requestId,

        name:
          cleanName,

        contact:
          cleanContact,

        status:
          "pending",

        accessCode:
          null,

        createdAt:
          new Date().toISOString(),

        approvedAt:
          null,

        rejectedAt:
          null

      };


      requests.unshift(
        request
      );


      saveAccessRequests(
        requests
      );


      addNICEGOLDNews(
        "SYSTEM",
        "New access request",
        `${cleanName} submitted a NICEGOLD access request.`
      );


      res.json({

        success:
          true,

        requestId,

        status:
          "pending",

        message:
          "Your access request has been submitted."

      });

    } catch (error) {

      console.error(
        "Access request error:",
        error
      );


      res.status(500).json({

        success:
          false,

        message:
          "Could not submit access request."

      });

    }

  }
);


/* =====================================================
   GET ACCESS REQUEST STATUS
   ===================================================== */

app.get(
  "/api/access/request/:requestId",
  (req, res) => {

    const requests =
      loadAccessRequests();


    const request =
      requests.find(
        item =>
          item.requestId ===
          req.params.requestId
      );


    if (!request) {

      return res.status(404).json({

        success:
          false,

        message:
          "Request not found."

      });

    }


    /*
     * Never expose the access code
     * through this endpoint.
     */

    res.json({

      success:
        true,

      request: {

        requestId:
          request.requestId,

        name:
          request.name,

        status:
          request.status,

        createdAt:
          request.createdAt,

        approvedAt:
          request.approvedAt

      }

    });

  }
);


/* =====================================================
   ADMIN REQUEST LIST
   ===================================================== */

app.get(
  "/api/admin/requests",
  requireAdmin,
  (req, res) => {

    const requests =
      loadAccessRequests();


    const pending =
      requests.filter(
        item =>
          item.status ===
          "pending"
      );


    res.json({

      success:
        true,

      requests,

      total:
        requests.length,

      pending:
        pending.length

    });

  }
);


/* =====================================================
   ADMIN REQUEST SUMMARY
   ===================================================== */

app.get(
  "/api/admin/requests/stats",
  requireAdmin,
  (req, res) => {

    const requests =
      loadAccessRequests();


    res.json({

      success:
        true,

      total:
        requests.length,

      pending:
        requests.filter(
          item =>
            item.status ===
            "pending"
        ).length,

      approved:
        requests.filter(
          item =>
            item.status ===
            "approved"
        ).length,

      rejected:
        requests.filter(
          item =>
            item.status ===
            "rejected"
        ).length

    });

  }
);


/* =====================================================
   APPROVE ACCESS REQUEST
   ===================================================== */

app.post(
  "/api/admin/requests/:requestId/approve",
  requireAdmin,
  (req, res) => {

    try {

      const requests =
        loadAccessRequests();


      const request =
        requests.find(
          item =>
            item.requestId ===
            req.params.requestId
        );


      if (!request) {

        return res.status(404).json({

          success:
            false,

          message:
            "Access request not found."

        });

      }


      if (
        request.status ===
        "approved"
      ) {

        return res.json({

          success:
            true,

          message:
            "Request is already approved.",

          request

        });

      }


      if (
        request.status ===
        "rejected"
      ) {

        return res.status(400).json({

          success:
            false,

          message:
            "A rejected request cannot be approved."

        });

      }


      /*
       * Generate a fresh access code.
       */

      const accessCode =
        "NG-" +
        crypto
          .randomBytes(4)
          .toString("hex")
          .toUpperCase();


      request.status =
        "approved";

      request.accessCode =
        accessCode;

      request.approvedAt =
        new Date().toISOString();


      saveAccessRequests(
        requests
      );


      addNICEGOLDNews(
        "SYSTEM",
        "Access request approved",
        `${request.name}'s NICEGOLD access request was approved.`
      );


      res.json({

        success:
          true,

        message:
          "Access request approved.",

        request: {

          requestId:
            request.requestId,

          name:
            request.name,

          contact:
            request.contact,

          status:
            request.status,

          accessCode:
            request.accessCode,

          approvedAt:
            request.approvedAt

        }

      });

    } catch (error) {

      console.error(
        "Approval error:",
        error
      );


      res.status(500).json({

        success:
          false,

        message:
          "Could not approve request."

      });

    }

  }
);


/* =====================================================
   REJECT ACCESS REQUEST
   ===================================================== */

app.post(
  "/api/admin/requests/:requestId/reject",
  requireAdmin,
  (req, res) => {

    try {

      const requests =
        loadAccessRequests();


      const request =
        requests.find(
          item =>
            item.requestId ===
            req.params.requestId
        );


      if (!request) {

        return res.status(404).json({

          success:
            false,

          message:
            "Access request not found."

        });

      }


      request.status =
        "rejected";

      request.accessCode =
        null;

      request.rejectedAt =
        new Date().toISOString();


      saveAccessRequests(
        requests
      );


      addNICEGOLDNews(
        "SYSTEM",
        "Access request rejected",
        `${request.name}'s NICEGOLD access request was rejected.`
      );


      res.json({

        success:
          true,

        message:
          "Access request rejected.",

        request

      });

    } catch (error) {

      console.error(
        "Reject error:",
        error
      );


      res.status(500).json({

        success:
          false,

        message:
          "Could not reject request."

      });

    }

  }
);


/* =====================================================
   VERIFY ACCESS CODE
   ===================================================== */

app.post(
  "/api/access/verify",
  (req, res) => {

    try {

      const {
        code
      } = req.body || {};


      const cleanCode =
        String(
          code || ""
        ).trim();


      if (!cleanCode) {

        return res.status(400).json({

          success:
            false,

          message:
            "Access code is required."

        });

      }


      const requests =
        loadAccessRequests();


      const request =
        requests.find(
          item =>
            item.accessCode ===
              cleanCode &&
            item.status ===
              "approved"
        );


      if (!request) {

        return res.status(401).json({

          success:
            false,

          message:
            "Invalid or expired access code."

        });

      }


      res.json({

        success:
          true,

        message:
          "Access verified successfully.",

        redirect:
          "/"

      });

    } catch (error) {

      console.error(
        "Access verification error:",
        error
      );


      res.status(500).json({

        success:
          false,

        message:
          "Could not verify access code."

      });

    }

  }
);


/* =====================================================
   LIVE NEWS API
   ===================================================== */

app.get(
  "/api/news",
  (req, res) => {

    res.json({

      success:
        true,

      news:
        nicegoldNews

    });

  }
);


/* =====================================================
   MONITOR BOT STATUS
   ===================================================== */

let previousBotState =
  null;


setInterval(
  () => {

    try {

      if (
        typeof getBotStatus !==
        "function"
      ) {
        return;
      }


      const bot =
        getBotStatus();


      if (!bot) {
        return;
      }


      const currentState =
        bot.state;


      if (
        previousBotState ===
        null
      ) {

        previousBotState =
          currentState;

        return;

      }


      if (
        currentState !==
        previousBotState
      ) {

        if (
          currentState ===
          "ready"
        ) {

          addNICEGOLDNews(
            "BOT",
            "WhatsApp connected",
            "The NICEGOLD WhatsApp engine is now connected."
          );

        }


        else if (
          currentState ===
          "pairing"
        ) {

          addNICEGOLDNews(
            "WHATSAPP",
            "Pairing code generated",
            "A WhatsApp pairing code has been generated."
          );

        }


                else if (
          currentState ===
            "starting" ||
          currentState ===
            "connecting"
        ) {

          addNICEGOLDNews(
            "BOT",
            "WhatsApp engine starting",
            "The NICEGOLD WhatsApp engine is starting."
          );

        }

        else if (
          currentState ===
            "stopped" ||
          currentState ===
            "close" ||
          currentState ===
            "disconnected"
        ) {

          addNICEGOLDNews(
            "WHATSAPP",
            "WhatsApp engine stopped",
            "The NICEGOLD WhatsApp engine is currently stopped."
          );

        }

        else {

          addNICEGOLDNews(
            "SYSTEM",
            "Bot status changed",
            `WhatsApp engine status changed to ${currentState}.`
          );

        }


        previousBotState =
          currentState;

      }

    } catch (error) {

      console.error(
        "NICEGOLD news monitor error:",
        error
      );

    }

  },
  5000
);


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

app.listen(PORT, '0.0.0.0', () => {

    console.log(
      `Website running on port ${PORT}`
    );

  }
);