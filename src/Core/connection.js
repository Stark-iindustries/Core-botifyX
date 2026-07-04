'use strict';

const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// ── Send the "connected" status message to "Message Yourself" ─────────────────
// Sending immediately on 'open' can land before the encryption session for our
// own JID is fully established, which is why WhatsApp shows "waiting for this
// message" until keys sync minutes later. A longer delay plus using the
// socket's own normalized JID (with device id, instead of a manually rebuilt
// bare JID) gives the multi-device key sync time to finish before we send.
//
// All values shown (prefix, mode, version, etc.) are read live from `db` and
// `package.json` at send time — nothing here is hardcoded to a snapshot, so it
// always reflects whatever the user currently has configured.
async function sendConnectionMessage(Cypher, db, detectPlatform) {
    try {
        await new Promise((r) => setTimeout(r, 10000));

        let botVersion = 'unknown';
        try { botVersion = require('../../package.json').version || 'unknown'; } catch (_) {}

        const selfJid = jidNormalizedUser(Cypher.user?.id) || global.creator;
        const botNum  = jidNormalizedUser(Cypher.user?.id || '').split('@')[0];

        const statusMsg =
            `┏▣ ◈ *BOTIFY-X CONNECTED* ◈\n` +
            `┃ *ᴜsᴇʀ* : ${Cypher.user?.name || botNum}\n` +
            `┃ *ᴘʟᴀᴛғᴏʀᴍ* : ${detectPlatform()}\n` +
            `┃ *ᴘʀᴇғɪˣ* : ${db.settings.prefix ?? '.'}\n` +
            `┃ *ᴍᴏᴅᴇ* : ${db.settings.mode || 'private'}\n` +
            `┃ *ᴠᴇʀsɪᴏɴ* : v${botVersion}\n` +
            `┗▣\n\n` +
            `👉 Telegram: https://t.me/+yxIy3nwj6Ig4YjM0\n` +
            `📢 Channel: https://t.me/botifyxspace`;

        await Cypher.sendMessage(selfJid, { text: statusMsg });
    } catch (_) {}
}

module.exports = { sendConnectionMessage };
