const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function useSQLiteAuthState(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const db = new sqlite3.Database(dbPath);

    await new Promise((res, rej) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS auth (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        `, (err) => err ? rej(err) : res());
    });

    const writeData = (data, key) => new Promise((res, rej) => {
        const json = JSON.stringify(data, BufferJSON.replacer);
        db.run(`INSERT OR REPLACE INTO auth (key, value) VALUES (?, ?)`, [key, json],
            (err) => err ? rej(err) : res());
    });

    const readData = (key) => new Promise((res, rej) => {
        db.get(`SELECT value FROM auth WHERE key = ?`, [key], (err, row) => {
            if (err) return rej(err);
            if (!row) return res(null);
            res(JSON.parse(row.value, BufferJSON.reviver));
        });
    });

    const removeData = (key) => new Promise((res, rej) => {
        db.run(`DELETE FROM auth WHERE key = ?`, [key], (err) => err ? rej(err) : res());
    });

    const creds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }
                    return data;
                },
                set: async (data) => {
                    for (const [category, categoryData] of Object.entries(data)) {
                        for (const [id, value] of Object.entries(categoryData || {})) {
                            const key = `${category}-${id}`;
                            if (value) await writeData(value, key);
                            else await removeData(key);
                        }
                    }
                },
            },
        },
        saveCreds: () => writeData(creds, 'creds'),
    };
}

module.exports = { useSQLiteAuthState };
