const fs = require("fs");
const path = require("path");
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const DEFAULT_DATA = {
  users: [],
  conversations: [],
  messages: [],
  reactions: [],
  blocks: [],
  notifications: [],
  statuses: [],
  settings: []
};

let db = null;
let initialized = false;

/**
 * Make sure the data directory exists.
 */
function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
      recursive: true
    });
  }
}

/**
 * Create the database file if it does not exist.
 */
function ensureDatabaseFile() {
  ensureDataDirectory();

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(DEFAULT_DATA, null, 2),
      "utf8"
    );
  }
}

/**
 * Make sure every collection exists.
 *
 * This protects the application if an older db.json
 * is missing a newly introduced collection.
 */
function normalizeDatabase() {
  if (!db.data || typeof db.data !== "object") {
    db.data = {};
  }

  for (const key of Object.keys(DEFAULT_DATA)) {
    if (!Array.isArray(db.data[key])) {
      db.data[key] = [];
    }
  }
}

/**
 * Initialize LowDB.
 */
async function initDatabase() {
  if (initialized && db) {
    return db;
  }

  ensureDatabaseFile();

  const adapter = new JSONFile(DB_FILE);

  db = new Low(adapter, {
    ...DEFAULT_DATA,
    users: [],
    conversations: [],
    messages: [],
    reactions: [],
    blocks: [],
    notifications: [],
    statuses: [],
    settings: []
  });

  await db.read();

  normalizeDatabase();

  await db.write();

  initialized = true;

  return db;
}

/**
 * Get the active database instance.
 */
function getDatabase() {
  if (!db || !initialized) {
    throw new Error(
      "Database has not been initialized. Call initDatabase() first."
    );
  }

  return db;
}

/**
 * Save the database.
 */
async function saveDatabase() {
  const database = getDatabase();

  normalizeDatabase();

  await database.write();

  return database;
}

/**
 * Reload the database from disk.
 *
 * Useful if the database was modified externally.
 */
async function reloadDatabase() {
  const database = getDatabase();

  await database.read();

  normalizeDatabase();

  return database;
}

/**
 * Return the database file path.
 */
function getDatabasePath() {
  return DB_FILE;
}

/**
 * Return a safe copy of the database.
 *
 * This is useful for debugging without exposing
 * the actual in-memory object.
 */
function getDatabaseSnapshot() {
  const database = getDatabase();

  return JSON.parse(
    JSON.stringify(database.data)
  );
}

/**
 * Clear every collection.
 *
 * This should only be used deliberately during
 * development or a complete database reset.
 */
async function resetDatabase() {
  const database = getDatabase();

  database.data = {
    users: [],
    conversations: [],
    messages: [],
    reactions: [],
    blocks: [],
    notifications: [],
    statuses: [],
    settings: []
  };

  await database.write();

  return database;
}

/**
 * Close/reset the current database instance.
 *
 * LowDB itself does not require a persistent
 * connection to close, so this simply clears
 * the current instance.
 */
function closeDatabase() {
  db = null;
  initialized = false;
}

module.exports = {
  initDatabase,
  getDatabase,
  saveDatabase,
  reloadDatabase,
  getDatabasePath,
  getDatabaseSnapshot,
  resetDatabase,
  closeDatabase
};
