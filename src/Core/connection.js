'use strict';

const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// ── Send the "connected" status message to the owner ("Message Yourself") ─────
// Retries up to 3 times with increasing delays so the message always arrives
// even on slow connections where the multi-device key sync takes longer.
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

    // Retry up to 3 times: 10s → 20s → 35s after connection open
    const delays = [10000, 20000, 35000];
    for (const delay of delays) {
        try {
            await new Promise((r) => setTimeout(r, delay));
            await Cypher.sendMessage(selfJid, { text: statusMsg });
            return; // sent successfully — stop retrying
        } catch (_) {
            // failed — loop continues to next delay
        }
    }
}

module.exports = { sendConnectionMessage };
