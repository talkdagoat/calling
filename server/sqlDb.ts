import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'talk_contacts.sqlite');

let db: Database | null = null;

export interface SQLUser {
  id: string;
  name: string;
  avatar: string;
  publicKeyFingerprint: string;
  createdAt: string;
}

export interface SQLContact {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  role: string;
  notes: string;
  publicKeyFingerprint: string;
  status: 'online' | 'offline';
  deviceList: string[];
}

export async function initSQLDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    try {
      const filebuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(filebuffer);
    } catch (e) {
      console.warn('Failed to load existing SQLite database, creating new one:', e);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Create relational SQL Tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL COLLATE NOCASE,
      avatar TEXT,
      public_key_fingerprint TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      contact_user_id TEXT NOT NULL,
      role TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (contact_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS call_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      caller_name TEXT NOT NULL,
      callee_name TEXT NOT NULL,
      type TEXT NOT NULL,
      duration INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `);

  persistDatabase();
  return db;
}

export function persistDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to persist SQLite database file:', err);
  }
}

// 1. Register User in SQL
export function registerUserSQL(name: string, avatar?: string, publicKeyFingerprint?: string): SQLUser {
  if (!db) throw new Error('Database not initialized');

  const cleanName = name.trim();
  const lowerName = cleanName.toLowerCase();

  // Query SQL users table
  const checkStmt = db.prepare('SELECT id, name, avatar, public_key_fingerprint, created_at FROM users WHERE LOWER(name) = ?');
  checkStmt.bind([lowerName]);
  
  if (checkStmt.step()) {
    const row = checkStmt.getAsObject();
    checkStmt.free();
    return {
      id: row.id as string,
      name: row.name as string,
      avatar: (row.avatar as string) || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=059669&color=ffffff&bold=true`,
      publicKeyFingerprint: (row.public_key_fingerprint as string) || '4E9A B7C2 91F0 33DA 8201',
      createdAt: row.created_at as string,
    };
  }
  checkStmt.free();

  // Insert new user into SQL table
  const id = `user_${lowerName.replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  const now = new Date().toISOString();
  const userAvatar = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=059669&color=ffffff&bold=true`;
  const fingerprint = publicKeyFingerprint || '4E9A B7C2 91F0 33DA 8201';

  db.run(
    'INSERT INTO users (id, name, avatar, public_key_fingerprint, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, cleanName, userAvatar, fingerprint, now]
  );
  persistDatabase();

  return {
    id,
    name: cleanName,
    avatar: userAvatar,
    publicKeyFingerprint: fingerprint,
    createdAt: now,
  };
}

// 2. Get All Registered Users in SQL
export function getAllUsersSQL(): SQLUser[] {
  if (!db) return [];
  const stmt = db.prepare('SELECT id, name, avatar, public_key_fingerprint, created_at FROM users ORDER BY name ASC');
  const results: SQLUser[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      id: row.id as string,
      name: row.name as string,
      avatar: row.avatar as string,
      publicKeyFingerprint: row.public_key_fingerprint as string,
      createdAt: row.created_at as string,
    });
  }
  stmt.free();
  return results;
}

// 3. Check if User exists on Talk (SQL query)
export function findUserByNameSQL(name: string): SQLUser | null {
  if (!db) return null;
  const cleanName = name.trim().toLowerCase();
  const stmt = db.prepare('SELECT id, name, avatar, public_key_fingerprint, created_at FROM users WHERE LOWER(name) = ?');
  stmt.bind([cleanName]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return {
      id: row.id as string,
      name: row.name as string,
      avatar: row.avatar as string,
      publicKeyFingerprint: row.public_key_fingerprint as string,
      createdAt: row.created_at as string,
    };
  }
  stmt.free();
  return null;
}

// 4. Add Contact in SQL (ONLY allow if target user is registered on Talk!)
export function addContactSQL(
  userId: string,
  targetUserName: string,
  role?: string,
  notes?: string
): { success: boolean; contact?: SQLContact; error?: string } {
  if (!db) return { success: false, error: 'Database not ready' };

  const targetUser = findUserByNameSQL(targetUserName);
  if (!targetUser) {
    return {
      success: false,
      error: `User "${targetUserName}" is not registered on Talk. Only verified Talk accounts can be added as contacts. Have them open Talk to register their account first.`,
    };
  }

  // Check if contact already exists in SQL table
  const checkStmt = db.prepare('SELECT id FROM contacts WHERE user_id = ? AND contact_user_id = ?');
  checkStmt.bind([userId, targetUser.id]);
  if (checkStmt.step()) {
    checkStmt.free();
    return {
      success: false,
      error: `"${targetUser.name}" is already in your contacts list.`,
    };
  }
  checkStmt.free();

  const contactId = `contact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO contacts (id, user_id, contact_user_id, role, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [contactId, userId, targetUser.id, role || 'Talk User', notes || '', now]
  );
  persistDatabase();

  return {
    success: true,
    contact: {
      id: targetUser.id,
      userId: targetUser.id,
      name: targetUser.name,
      avatar: targetUser.avatar,
      role: role || 'Talk User',
      notes: notes || '',
      publicKeyFingerprint: targetUser.publicKeyFingerprint,
      status: 'online',
      deviceList: ['Primary Device'],
    },
  };
}

// 5. Get Contacts for User from SQL
export function getContactsForUserSQL(userId: string): SQLContact[] {
  if (!db) return [];
  const stmt = db.prepare(`
    SELECT c.id as contact_table_id, c.role, c.notes, u.id as user_id, u.name, u.avatar, u.public_key_fingerprint
    FROM contacts c
    JOIN users u ON c.contact_user_id = u.id
    WHERE c.user_id = ?
    ORDER BY u.name ASC
  `);
  stmt.bind([userId]);
  const contacts: SQLContact[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    contacts.push({
      id: row.user_id as string,
      userId: row.user_id as string,
      name: row.name as string,
      avatar: row.avatar as string,
      role: (row.role as string) || 'Talk User',
      notes: (row.notes as string) || '',
      publicKeyFingerprint: (row.public_key_fingerprint as string) || '4E9A B7C2 91F0 33DA 8201',
      status: 'online',
      deviceList: ['Primary Device'],
    });
  }
  stmt.free();
  return contacts;
}

// 6. Delete Contact from SQL
export function deleteContactSQL(userId: string, targetIdOrName: string): boolean {
  if (!db) return false;
  db.run(
    'DELETE FROM contacts WHERE user_id = ? AND (contact_user_id = ? OR id = ?)',
    [userId, targetIdOrName, targetIdOrName]
  );
  persistDatabase();
  return true;
}

// 7. Reset all SQL tables
export function resetAllSQL(): void {
  if (!db) return;
  db.run('DELETE FROM contacts');
  db.run('DELETE FROM call_history');
  db.run('DELETE FROM users');
  persistDatabase();
}
