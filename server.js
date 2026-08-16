const express = require("express");
const path = require("path");
const session = require("express-session");
const crypto = require("crypto");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;


/* =========================================================
   NICEGOLD MON
   Server configuration
   ========================================================= */

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "CHANGE_THIS_PASSWORD";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "CHANGE_THIS_SESSION_SECRET";


/* =========================================================
   Temporary access requests
   ========================================================= */

const accessRequests = new Map();


/* =========================================================
   Middleware
   ========================================================= */

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);


/* =========================================================
   Sessions
   ========================================================= */

app.use(
  session({
    secret: SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);


/* =========================================================
   Static website
   ========================================================= */

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

app.post("/api/login", (req, res) => {

  const {
    username,
    password
  } = req.body || {};


  if (
    username !== ADMIN_USERNAME ||
    password !== ADMIN_PASSWORD
  ) {

    return res.status(401).json({
      ok: false,
      message: "Invalid administrator credentials."
    });

  }


  req.session.isAdmin = true;


  res.json({
    ok: true,
    message: "Administrator authentication successful."
  });

});


/* =========================================================
   ADMIN LOGOUT
   ========================================================= */

app.post("/api/logout", (req, res) => {

  req.session.destroy(() => {

    res.json({
      ok: true,
      message: "Logged out successfully."
    });

  });

});


/* =========================================================
   CHECK ADMIN SESSION
   ========================================================= */

app.get("/api/admin/status", (req, res) => {

  res.json({
    ok: true,
    authenticated:
      req.session.isAdmin === true
  });

});


/* =========================================================
   ADMIN PROTECTION
   ========================================================= */

function requireAdmin(req, res, next) {

  if (req.session.isAdmin !== true) {

    return res.status(403).json({
      ok: false,
      message:
        "Administrator authentication required."
    });

  }

  next();

}


/* =========================================================
   VISITOR ACCESS REQUEST
   ========================================================= */

app.post("/api/access/request", (req, res) => {

  const {
    name,
    contact
  } = req.body || {};


  if (
    typeof name !== "string" ||
    typeof contact !== "string" ||
    !name.trim() ||
    !contact.trim()
  ) {

    return res.status(400).json({
      ok: false,
      message:
        "Please provide your name and contact."
    });

  }


  const requestId =
    crypto.randomBytes(8).toString("hex");


  accessRequests.set(requestId, {

    id: requestId,

    name: name.trim(),

    contact: contact.trim(),

    status: "pending",

    createdAt:
      new Date().toISOString(),

    accessCode: null,

    codeExpiresAt: null

  });


  console.log(
    `[ACCESS REQUEST] ${requestId} | ${name.trim()} | ${contact.trim()}`
  );


  res.json({

    ok: true,

    requestId,

    message:
      "Access request submitted. Please wait for administrator approval."

  });

});


/* =========================================================
   ADMIN: VIEW ACCESS REQUESTS
   ========================================================= */

app.get(
  "/api/admin/access-requests",
  requireAdmin,
  (req, res) => {

    const requests =
      Array.from(
        accessRequests.values()
      ).map(request => ({

        id: request.id,

        name: request.name,

        contact: request.contact,

        status: request.status,

        createdAt:
          request.createdAt,

        codeExpiresAt:
          request.codeExpiresAt

      }));


    res.json({
      ok: true,
      requests
    });

  }
);


/* =========================================================
   ADMIN: APPROVE REQUEST
   ========================================================= */

app.post(
  "/api/admin/access-requests/:id/approve",
  requireAdmin,
  (req, res) => {

    const request =
      accessRequests.get(
        req.params.id
      );


    if (!request) {

      return res.status(404).json({
        ok: false,
        message:
          "Access request not found."
      });

    }


    if (
      request.status === "approved"
    ) {

      return res.json({
        ok: true,
        message:
          "Request has already been approved."
      });

    }


    /*
     * Generate temporary access code.
     */

    const accessCode =
      crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase();


    /*
     * Code expires after 15 minutes.
     */

    const expiresAt =
      Date.now() +
      15 * 60 * 1000;


    request.status = "approved";

    request.accessCode =
      accessCode;

    request.codeExpiresAt =
      new Date(
        expiresAt
      ).toISOString();


    console.log(
      `[ACCESS APPROVED] ${request.id} | CODE: ${accessCode}`
    );


    res.json({

      ok: true,

      message:
        "Access approved. Give the temporary code to the requester privately.",

      accessCode,

      expiresAt:
        request.codeExpiresAt

    });

  }
);


/* =========================================================
   ADMIN: DENY REQUEST
   ========================================================= */

app.post(
  "/api/admin/access-requests/:id/deny",
  requireAdmin,
  (req, res) => {

    const request =
      accessRequests.get(
        req.params.id
      );


    if (!request) {

      return res.status(404).json({
        ok: false,
        message:
          "Access request not found."
      });

    }


    request.status = "denied";

    request.accessCode = null;

    request.codeExpiresAt = null;


    res.json({

      ok: true,

      message:
        "Access request denied."

    });

  }
);


/* =========================================================
   VISITOR: VERIFY ACCESS CODE
   ========================================================= */

app.post(
  "/api/access/verify",
  (req, res) => {

    const {
      requestId,
      accessCode
    } = req.body || {};


    const request =
      accessRequests.get(
        requestId
      );


    if (!request) {

      return res.status(404).json({
        ok: false,
        message:
          "Access request not found."
      });

    }


    if (
      request.status !== "approved"
    ) {

      return res.status(403).json({
        ok: false,
        message:
          "This access request has not been approved."
      });

    }


    const submittedCode =
      String(accessCode || "")
        .trim()
        .toUpperCase();


    if (
      !request.accessCode ||
      request.accessCode !==
        submittedCode
    ) {

      return res.status(401).json({
        ok: false,
        message:
          "Invalid access code."
      });

    }


    if (
      !request.codeExpiresAt ||
      Date.now() >
        new Date(
          request.codeExpiresAt
        ).getTime()
    ) {

      request.accessCode = null;

      request.codeExpiresAt = null;


      return res.status(401).json({
        ok: false,
        message:
          "This access code has expired."
      });

    }


    /*
     * Code is single-use.
     */

    request.status = "used";

    request.accessCode = null;

    request.codeExpiresAt = null;


    res.json({

      ok: true,

      message:
        "Access granted."

    });

  }
);


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      ok: true,

      message:
        "NICEGOLD server is running"

    });

  }
);


/* =========================================================
   WHATSAPP STATUS
   =========================================================
   WhatsApp stays OFF for now.
   ========================================================= */

app.get(
  "/api/whatsapp/status",
  (req, res) => {

    res.json({

      state: "stopped",

      message:
        "WhatsApp engine is stopped"

    });

  }
);


/* =========================================================
   MAIN WEBSITE
   ========================================================= */

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );

  }
);


/* =========================================================
   START SERVER
   ========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "✞𓉳 ⃝𝗡𝗜𝗖𝗘𝗚𝗢𝗟𝗗₊ ⃝ 𝗠𝗢𝗡𓉳 ⃝𓃵"
    );

    console.log(
      `Website running on port ${PORT}`
    );

  }
);