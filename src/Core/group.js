'use strict';

const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const fs      = require('fs');

const dbPath = path.join(__dirname, '../Database/group.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('[BOTIFY-X] Group DB error:', err);
    else console.log('[BOTIFY-X] Connected to group database');
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            group_jid TEXT NOT NULL,
            user_jid  TEXT NOT NULL,
            count     INTEGER DEFAULT 1,
            PRIMARY KEY (group_jid, user_jid)
        )
    `, (err) => {
        if (err) console.error('[BOTIFY-X] Error creating messages table:', err);
    });
});

const GroupDB = {
    addMessage(groupJid, userJid) {
        db.run(
            `INSERT INTO messages (group_jid, user_jid, count)
             VALUES (?, ?, 1)
             ON CONFLICT(group_jid, user_jid)
             DO UPDATE SET count = count + 1`,
            [groupJid, userJid],
            (err) => { if (err) console.error('[BOTIFY-X] GroupDB addMessage error:', err); }
        );
    },

    getActiveUsers(groupJid) {
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
    },
};

// ─── handleGroupParticipants — Bug 2 fix ──────────────────────────────────────
async function handleGroupParticipants(Cypher, update, db) {
    try {
        const { id, participants, action } = update;

        // Ensure chat entry exists
        if (!db.chats) db.chats = {};
        if (!db.chats[id]) {
            db.chats[id] = {
                welcome: false, welcomeMsg: '',
                goodbye: false, goodbyeMsg: '',
                antidemote: false,
                antiforeign: false, allowedCodes: [],
                warnings: {}, warnLimit: 5, mute: false,
            };
        }

        const chat = db.chats[id];

        for (const participant of participants) {
            const tag = `@${participant.split('@')[0]}`;

            // Welcome
            if (action === 'add' && chat.welcome) {
                let groupName = id;
                try {
                    const meta = await Cypher.groupMetadata(id);
                    groupName  = meta.subject || id;
                } catch (_) {}

                const msg = (chat.welcomeMsg || `Welcome *{user}* to *{group}*! 🎉`)
                    .replace(/{user}/g, tag)
                    .replace(/{group}/g, groupName);

                await Cypher.sendMessage(id, {
                    text: msg,
                    mentions: [participant],
                }).catch(() => {});
            }

            // Goodbye
            if (action === 'remove' && chat.goodbye) {
                const msg = (chat.goodbyeMsg || `Goodbye *{user}*, we'll miss you! 👋`)
                    .replace(/{user}/g, tag);

                await Cypher.sendMessage(id, {
                    text: msg,
                    mentions: [participant],
                }).catch(() => {});
            }

            // Anti-demote: if an admin was demoted, re-promote them
            if (action === 'demote' && chat.antidemote) {
                await Cypher.groupParticipantsUpdate(id, [participant], 'promote').catch(() => {});
                await Cypher.sendMessage(id, {
                    text: `🛡️ Anti-demote: @${participant.split('@')[0]} has been re-promoted.`,
                    mentions: [participant],
                }).catch(() => {});
            }

            // Anti-foreign: kick members whose country code isn't in allowedCodes
            if (action === 'add' && chat.antiforeign && Array.isArray(chat.allowedCodes) && chat.allowedCodes.length > 0) {
                const number = participant.replace('@s.whatsapp.net', '');
                const isAllowed = chat.allowedCodes.some(code => number.startsWith(code));
                if (!isAllowed) {
                    await Cypher.groupParticipantsUpdate(id, [participant], 'remove').catch(() => {});
                    await Cypher.sendMessage(id, {
                        text: `🚫 @${participant.split('@')[0]} was removed — country code not allowed in this group.`,
                        mentions: [participant],
                    }).catch(() => {});
                }
            }
        }
    } catch (err) {
        console.error('[BOTIFY-X] handleGroupParticipants error:', err.message);
    }
}

module.exports = GroupDB;
module.exports.handleGroupParticipants = handleGroupParticipants;
