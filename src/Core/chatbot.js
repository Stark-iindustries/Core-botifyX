const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'Database', 'chatbot.db');

const dbe = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ Database Error:", err);
  else console.log("[BOTIFY-X] Connected to Chatbot Database.");
});

dbe.serialize(() => {
    dbe.run(`
        CREATE TABLE IF NOT EXISTS user_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

function storeUserMessage(userId, message) {
    const query = `INSERT INTO user_messages (userId, message) VALUES (?, ?)`;
    dbe.run(query, [userId, message], (err) => {
        if (err) console.error('Error storing message:', err);
    });
}

function getUserMessages(userId, limit = 25) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT message 
            FROM user_messages 
            WHERE userId = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `;
        dbe.all(query, [userId, limit], (err, rows) => {
            if (err) {
                console.error('Error retrieving messages:', err);
                reject(err);
            } else {
                const messages = rows.map(row => row.message).reverse();
                resolve(messages);
            }
        });
    });
}

function cleanupChatbotMessages(days = 1) {
    const query = `
        DELETE FROM user_messages 
        WHERE timestamp < datetime('now', ?)
    `;
    dbe.run(query, [`-${days} days`], (err) => {
        if (err) console.error('Error cleaning up old messages:', err);
        else console.log(`[BOTIFY-X] Cleaned up chatbot messages older than ${days} days.`);
    });
}

module.exports = { storeUserMessage, cleanupChatbotMessages, getUserMessages };