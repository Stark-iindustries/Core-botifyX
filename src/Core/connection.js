'use strict';

// -- Send the connected status message to the owner (Message Yourself) -----
async function sendConnectionMessage(Cypher, db, detectPlatform) {
    let botVersion = 'unknown';
    try { botVersion = require('../../package.json').version || 'unknown'; } catch (_) {}

    const username = global.Cypher?.user?.name || global.ownernumber || '';
    const platform = detectPlatform();
    const prefix   = db.settings.prefix ?? '.';
    const mode     = db.settings.mode   || 'private';

    // Bare JID (no device suffix) = Message Yourself chat
    const rawId  = global.Cypher?.user?.id || '';
    const target = rawId.split(':')[0] + '@s.whatsapp.net';

    if (!rawId) {
        console.error('[BOTIFY-X] ❌ Connection message skipped -- Cypher.user.id not available.');
        return;
    }

    const statusMsg =
        `——『 BOTIFY-X 』——\n` +
        `» Username: ${username}\n` +
        `» Platform: ${platform}\n` +
        `» Prefix: [ ${prefix} ]\n` +
        `» Mode: ${mode}\n` +
        `» Version: [ ${botVersion} ]\n` +
        `» https://t.me/+yxIy3nwj6Ig4YjM0\n` +
        `» https://t.me/botifyxspace`;

    // 3 s grace period lets the session fully establish pre-keys before
    // attempting to encrypt a self-message. Then subscribe to own presence
    // to open the chat channel before sending.
    await new Promise((r) => setTimeout(r, 3000));

    for (const delay of [0, 5000]) {
        try {
            if (delay) await new Promise((r) => setTimeout(r, delay));
            await global.Cypher.presenceSubscribe(target).catch(() => {});
            await global.Cypher.sendMessage(target, { text: statusMsg });
            console.log(`[BOTIFY-X] ✅ Connection message sent to ${target}`);
            return;
        } catch (err) {
            console.error(`[BOTIFY-X] ⚠️  Connection message failed: ${err.message}`);
        }
    }
    console.error('[BOTIFY-X] ❌ Connection message could not be delivered after 2 attempts.');
}

module.exports = { sendConnectionMessage };
