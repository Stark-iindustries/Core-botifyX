'use strict';

const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// ── Send the "connected" status message to the owner ("Message Yourself") ─────
// Sends immediately on connect. If it fails (keys not yet synced), retries
// once after 5 seconds. That's it — no long delays, no missed messages.
async function sendConnectionMessage(Cypher, db, detectPlatform) {
    let botVersion = 'unknown';
    try { botVersion = require('../../package.json').version || 'unknown'; } catch (_) {}

    const selfJid  = jidNormalizedUser(Cypher.user?.id) || global.creator;
    const botNum   = jidNormalizedUser(Cypher.user?.id || '').split('@')[0];
    const username = Cypher.user?.name || botNum;
    const platform = detectPlatform();
    const prefix   = db.settings.prefix ?? '.';
    const mode     = db.settings.mode   || 'private';

    const statusMsg =
        `——『 BOTIFY-X 』——
` +
        `» Username: ${username}
` +
        `» Platform: ${platform}
` +
        `» Prefix: [ ${prefix} ]
` +
        `» Mode: ${mode}
` +
        `» Version: [ ${botVersion} ]
` +
        `» https://t.me/+yxIy3nwj6Ig4YjM0
` +
        `» https://t.me/botifyxspace`;

    try {
        await Cypher.sendMessage(selfJid, { text: statusMsg });
    } catch (_) {
        // First attempt failed — retry once after 5 seconds
        try {
            await new Promise((r) => setTimeout(r, 5000));
            await Cypher.sendMessage(selfJid, { text: statusMsg });
        } catch (_) {}
    }
}

module.exports = { sendConnectionMessage };
