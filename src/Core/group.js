const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../Database/group.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('[BOTIFY-X] Connected to group database');
});

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS messages (
      group_jid TEXT NOT NULL,
      user_jid TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      PRIMARY KEY (group_jid, user_jid)
    )`,
    (err) => {
      if (err) console.error('Error creating messages table:', err);
      else console.log('[BOTIFY-X] Messages table is ready');
    }
  );
});

const GroupDB = {
  addMessage: (groupJid, userJid) => {
    db.run(
      `INSERT INTO messages (group_jid, user_jid, count) 
       VALUES (?, ?, 1) 
       ON CONFLICT(group_jid, user_jid) 
       DO UPDATE SET count = count + 1`,
      [groupJid, userJid],
      (err) => {
        if (err) console.error('Error inserting message:', err);
      }
    );
  },

  getActiveUsers: (groupJid) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT user_jid AS jid, count 
         FROM messages 
         WHERE group_jid = ? 
         ORDER BY count DESC`,
        [groupJid],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }
};

module.exports = GroupDB;