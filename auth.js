const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "NICEGOLD_CHAT_V1_CHANGE_THIS_SECRET_2026";

const JWT_EXPIRES_IN = "30d";

/**
 * Hash a password before storing it.
 */
async function hashPassword(password) {
  if (typeof password !== "string") {
    throw new Error("Password must be a string");
  }

  if (password.length < 6) {
    throw new Error(
      "Password must be at least 6 characters long"
    );
  }

  return bcrypt.hash(password, 12);
}

/**
 * Compare a plain password with a hashed password.
 */
async function comparePassword(password, passwordHash) {
  if (
    typeof password !== "string" ||
    typeof passwordHash !== "string"
  ) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}

/**
 * Create a JWT token for an authenticated user.
 */
function createToken(user) {
  if (!user || !user.id) {
    throw new Error(
      "A valid user is required to create a token"
    );
  }

  return jwt.sign(
    {
      userId: user.id,
      username: user.username
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN
    }
  );
}

/**
 * Verify a JWT token.
 */
function verifyToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Extract a Bearer token from the Authorization header.
 */
function getTokenFromHeader(req) {
  const header = req.headers.authorization;

  if (!header) {
    return null;
  }

  const parts = header.trim().split(/\s+/);

  if (parts.length !== 2) {
    return null;
  }

  if (parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Express authentication middleware.
 *
 * Adds:
 * req.auth = {
 *   userId,
 *   username
 * }
 */
function authMiddleware(req, res, next) {
  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Authentication required"
      });
    }

    const payload = verifyToken(token);

    if (!payload || !payload.userId) {
      return res.status(401).json({
        ok: false,
        error: "Invalid or expired authentication token"
      });
    }

    req.auth = {
      userId: payload.userId,
      username: payload.username || null
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware.
 *
 * Unlike authMiddleware, this does not reject
 * unauthenticated requests.
 *
 * If a valid token exists:
 * req.auth is populated.
 *
 * Otherwise:
 * req.auth = null
 */
function optionalAuthMiddleware(req, res, next) {
  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      req.auth = null;
      return next();
    }

    const payload = verifyToken(token);

    if (!payload || !payload.userId) {
      req.auth = null;
      return next();
    }

    req.auth = {
      userId: payload.userId,
      username: payload.username || null
    };

    next();
  } catch (error) {
    req.auth = null;
    next();
  }
}

/**
 * Generate a secure random token suitable for
 * application-level identifiers.
 *
 * This is not used as a password.
 */
function createSecureToken(bytes = 32) {
  const crypto = require("crypto");

  return crypto
    .randomBytes(bytes)
    .toString("hex");
}

/**
 * Validate a password without hashing it.
 */
function validatePassword(password) {
  if (typeof password !== "string") {
    return {
      valid: false,
      error: "Password must be a string"
    };
  }

  if (password.length < 6) {
    return {
      valid: false,
      error: "Password must be at least 6 characters long"
    };
  }

  if (password.length > 128) {
    return {
      valid: false,
      error: "Password cannot exceed 128 characters"
    };
  }

  return {
    valid: true,
    error: null
  };
}

/**
 * Return authentication configuration.
 *
 * Does not expose the JWT secret.
 */
function getAuthConfig() {
  return {
    jwtExpiresIn: JWT_EXPIRES_IN
  };
}

module.exports = {
  hashPassword,
  comparePassword,
  createToken,
  verifyToken,
  authMiddleware,
  optionalAuthMiddleware,
  getTokenFromHeader,
  createSecureToken,
  validatePassword,
  getAuthConfig
};
