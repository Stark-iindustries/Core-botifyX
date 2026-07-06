'use strict';

const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// ── Send the "connected" status message to the owner ("Message Yourself") ─────
async function sendConnectionMessage(Cypher, db, detectPlatform) {
    try {
        // Wait for multi-device key sync before sending, otherwise the message
        // shows "waiting for this message" until keys finish syncing.
        await new Promise((r) => setTimeout(r, 10000));

        let botVersion = 'unknown';
        try { botVersion = require('../../package.json').version || 'unknown'; } catch (_) {}

        const selfJid  = jidNormalizedUser(Cypher.user?.id) || global.creator;
        const botNum   = jidNormalizedUser(Cypher.user?.id || '').split('@')[0];
        const username = Cypher.user?.name || botNum;
        const platform = detectPlatform();
        const prefix   = db.settings.prefix ?? '.';
        const mode     = db.settings.mode   || 'private';

        const statusMsg =
            `——『 BOTIFY-X 』——\n` +
            `» Username: ${username}\n` +
            `» Platform: ${platform}\n` +
            `» Prefix: [ ${prefix} ]\n` +
            `» Mode: ${mode}\n` +
            `» Version: [ ${botVersion} ]\n` +
            `» https://t.me/+yxIy3nwj6Ig4YjM0\n` +
            `» https://t.me/botifyxspace`;

        await Cypher.sendMessage(selfJid, { text: statusMsg });
    } catch (_) {}
}

module.exports = { sendConnectionMessage };
