'use strict';

// -- Send the connected status message to the owner (Message Yourself) -----
async function sendConnectionMessage(Cypher, db, detectPlatform) {
    let botVersion = 'unknown';
    try { botVersion = require('../../package.json').version || 'unknown'; } catch (_) {}

    const username = global.Cypher?.user?.name || global.ownernumber || '';
    const platform = detectPlatform();
    const prefix   = db.settings.prefix ?? '.';
    const mode     = db.settings.mode   || 'private';

    // Message Yourself requires the bot's own socket JID (with device suffix
    // e.g. 234xxx:5@s.whatsapp.net) -- NOT the bare owner JID. Using the bare
    // JID causes Baileys to silently accept the send but WhatsApp drops it.
    const target = global.Cypher?.user?.id;

    if (!target) {
        console.error('[BOTIFY-X] ❌ Connection message skipped -- Cypher.user.id not available.');
        return;
    }

    console.log(`[BOTIFY-X] Sending connection message to: ${target}`);

    const statusMsg =
        `——『 BOTIFY-X 』——\n` +
        `» Username: ${username}\n` +
        `» Platform: ${platform}\n` +
        `» Prefix: [ ${prefix} ]\n` +
        `» Mode: ${mode}\n` +
        `» Version: [ ${botVersion} ]\n` +
        `» https://t.me/+yxIy3nwj6Ig4YjM0\n` +
        `» https://t.me/botifyxspace`;

    for (const delay of [0, 5000]) {
        try {
            if (delay) await new Promise((r) => setTimeout(r, delay));
            await global.Cypher.sendMessage(target, { text: statusMsg });
            console.log('[BOTIFY-X] ✅ Connection message sent to owner.');
            return;
        } catch (err) {
            console.error(`[BOTIFY-X] ⚠️ Connection message attempt failed: ${err.message}`);
        }
    }
    console.error('[BOTIFY-X] ❌ Connection message could not be delivered after 2 attempts.');
}

module.exports = { sendConnectionMessage };
