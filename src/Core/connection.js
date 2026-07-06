'use strict';

// ── Send the "connected" status message to the owner ("Message Yourself") ─────
// Uses global.Cypher and global.creator so a reconnect mid-send doesn't
// leave us holding a stale socket reference.
async function sendConnectionMessage(Cypher, db, detectPlatform) {
    let botVersion = 'unknown';
    try { botVersion = require('../../package.json').version || 'unknown'; } catch (_) {}

    const username = global.Cypher?.user?.name || global.ownernumber || '';
    const platform = detectPlatform();
    const prefix   = db.settings.prefix ?? '.';
    const mode     = db.settings.mode   || 'private';
    const target   = global.creator;   // owner's bare JID e.g. 234xxx@s.whatsapp.net

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

    // Try immediately, then once more after 5 s if it fails.
    for (const delay of [0, 5000]) {
        try {
            if (delay) await new Promise((r) => setTimeout(r, delay));
            await global.Cypher.sendMessage(target, { text: statusMsg });
            console.log('[BOTIFY-X] ✅ Connection message sent to owner.');
            return;
        } catch (err) {
            console.error(`[BOTIFY-X] ⚠️  Connection message attempt failed: ${err.message}`);
        }
    }
    console.error('[BOTIFY-X] ❌ Connection message could not be delivered after 2 attempts.');
}

module.exports = { sendConnectionMessage };
