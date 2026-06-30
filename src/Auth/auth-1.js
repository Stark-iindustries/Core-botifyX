const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function useSQLiteAuthState(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const db = new Database(dbPath);

    db.prepare(`
        CREATE TABLE IF NOT EXISTS auth (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `).run();

    const writeData = (data, key) => {
        const json = JSON.stringify(data, BufferJSON.replacer);
        db.prepare(`INSERT OR REPLACE INTO auth (key, value) VALUES (?, ?)`).run(key, json);
    };

    const readData = (key) => {
        const row = db.prepare(`SELECT value FROM auth WHERE key = ?`).get(key);
        if (!row) return null;
        return JSON.parse(row.value, BufferJSON.reviver);
    };

    const removeData = (key) => {
        db.prepare(`DELETE FROM auth WHERE key = ?`).run(key);
    };

    const creds = readData('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        let value = readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }
                    return data;
                },
                set: (data) => {
                    for (const [category, categoryData] of Object.entries(data)) {
                        for (const [id, value] of Object.entries(categoryData || {})) {
                            const key = `${category}-${id}`;
                            value ? writeData(value, key) : removeData(key);
                        }
                    }
                },
            },
        },
        saveCreds: () => writeData(creds, 'creds'),
    };
}

module.exports = { useSQLiteAuthState };
