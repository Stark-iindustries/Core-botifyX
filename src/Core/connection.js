'use strict';

// -- Send the connected status message to the owner (Message Yourself) -----
async function sendConnectionMessage(Cypher, db, detectPlatform) {
    let botVersion = 'unknown';
    try { botVersion = require('../../package.json').version || 'unknown'; } catch (_) {}

    const username = global.Cypher?.user?.name || global.ownernumber || '';
    const platform = detectPlatform();
    const prefix   = db.settings.prefix ?? '.';
    const mode     = db.settings.mode   || 'private';

    const rawId  = global.Cypher?.user?.id || '';
    const target = rawId;

    if (!target) {
        console.error('[BOTIFY-X] ❌ Connection message skipped -- Cypher.user.id not available.');
        return;
    }

    console.log(`[BOTIFY-X] 🔍 target JID: ${target}`);

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
            const result = await global.Cypher.sendMessage(target, { text: statusMsg });
            console.log(`[BOTIFY-X] ✅ Connection message sent. key: ${JSON.stringify(result?.key)}`);
            return;
        } catch (err) {
            console.error(`[BOTIFY-X] ⚠️  Connection message failed (delay=${delay}ms): ${err.message}`);
        }
    }
    console.error('[BOTIFY-X] ❌ Connection message could not be delivered after 2 attempts.');
}

module.exports = { sendConnectionMessage };
