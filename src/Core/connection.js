'use strict';

const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// ── Send the "connected" status message to the owner ("Message Yourself") ─────
async function sendConnectionMessage(Cypher, db, detectPlatform) {
    try {
        // Wait for the multi-device key sync before sending, otherwise the
        // message shows "waiting for this message" until keys finish syncing.
        await new Promise((r) => setTimeout(r, 10000));

        const selfJid = jidNormalizedUser(Cypher.user?.id) || global.creator;

        // ── YOUR MESSAGE TEXT GOES HERE ───────────────────────────────────────
        const statusMsg = `YOUR_MESSAGE_HERE`;
        // ─────────────────────────────────────────────────────────────────────

        await Cypher.sendMessage(selfJid, { text: statusMsg });
    } catch (_) {}
}

module.exports = { sendConnectionMessage };
