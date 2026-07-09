'use strict';

// Shared moderation helpers for: antisticker, antigroupstatus, muteuser
// enforcement, and two hidden owner-only forwarding features.
//
// Design note: each feature gets its OWN warning counter/limit (stickerWarnings
// limit 5, muteWarnings limit 15, statusWarnings limit 5) instead of sharing the
// generic `db.chats[chat].warnings` object used by antilink/antitag/antibadword.
// This keeps features fully isolated - changing one feature's warn count can
// never accidentally affect another's.

function buildCustomWarnHandler(Cypher, m, db, saveDatabase, { counterField, limit, reason }) {
    return async (user) => {
        if (!user) return;
        const chat = db.chats[m.chat];
        if (!chat) return;
        if (!chat[counterField]) chat[counterField] = {};
        chat[counterField][user] = (chat[counterField][user] || 0) + 1;
        const count = chat[counterField][user];

        await Cypher.sendMessage(m.chat, {
            text: `⚠️ *Warning ${count}/${limit}* for @${user.split('@')[0]} — ${reason}`,
            mentions: [user],
        }, { quoted: m }).catch(() => {});

        if (count >= limit) {
            chat[counterField][user] = 0;
            await Cypher.groupParticipantsUpdate(m.chat, [user], 'remove').catch(() => {});
            await Cypher.sendMessage(m.chat, {
                text: `🚫 @${user.split('@')[0]} kicked after ${limit} warnings (${reason}).`,
                mentions: [user],
            }).catch(() => {});
        }
        saveDatabase();
    };
}

// Broad emoji-only matcher: passes for strings made up entirely of emoji /
// ZWJ joiners / variation selectors / whitespace, with nothing else.
const EMOJI_ONLY_RE = /^(?:[\u2600-\u27BF\u2190-\u21FF\u2300-\u23FF\u2B00-\u2BFF\uFE0F\u200D\s]|[\uD800-\uDBFF][\uDC00-\uDFFF])+$/;

function isEmojiOnly(text) {
    if (!text || !text.trim()) return false;
    return EMOJI_ONLY_RE.test(text.trim());
}

const VIEW_ONCE_TYPES = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'];

/**
 * Hidden owner-only feature (never listed in the menu/plugins):
 *  1. Reply to a Status with text or an emoji -> the status content is
 *     forwarded to "Message Yourself" (the owner's own chat with themself).
 *  2. Reply to a view-once media with ONLY emoji(s) -> the media is
 *     downloaded and forwarded to "Message Yourself" before it disappears.
 *
 * Fires only when isCreator is true (this is a self-bot on the owner's own
 * WhatsApp account, so these replies only happen when the OWNER, using their
 * own phone, replies through the real WhatsApp client - the bot just observes
 * its own outgoing traffic and reacts).
 */
async function handleSecretForwards(Cypher, m, isCreator) {
    if (!isCreator || !m.quoted) return;

    try {
        // ── 1. Reply to a Status with text/emoji -> forward to self ────────────
        if (m.quoted.chat === 'status@broadcast') {
            const replyText = (m.text || m.body || '').trim();
            if (!replyText) return;

            const selfJid = Cypher.user.id;
            const mtype   = m.quoted.mtype;

            if (mtype === 'imageMessage' || mtype === 'videoMessage') {
                const buf = await Cypher.downloadMediaMessage(m.quoted);
                const key = mtype === 'imageMessage' ? 'image' : 'video';
                await Cypher.sendMessage(selfJid, { [key]: buf, caption: m.quoted.text || '' });
            } else if (m.quoted.text) {
                await Cypher.sendMessage(selfJid, { text: m.quoted.text });
            }
            return;
        }

        // ── 2. Reply to a view-once with ONLY emoji -> forward media to self ───
        const rawType = m.quoted.mtype;
        if (VIEW_ONCE_TYPES.includes(rawType) && isEmojiOnly(m.text || m.body)) {
            const { getContentType } = require('@whiskeysockets/baileys');
            const innerMsg  = m.quoted.message || m.quoted;
            const innerType = getContentType(innerMsg);
            const media     = innerMsg ? innerMsg[innerType] : null;
            if (!media) return;

            const buf     = await Cypher.downloadMediaMessage(media);
            const selfJid = Cypher.user.id;
            const key     = innerType === 'imageMessage' ? 'image'
                           : innerType === 'videoMessage' ? 'video'
                           : null;
            if (key) {
                await Cypher.sendMessage(selfJid, { [key]: buf, caption: media.caption || '👁️ Saved view-once media' });
            }
        }
    } catch (_) {
        // Silent by design - this is a background convenience feature, never
        // let it throw into the main message pipeline.
    }
}

/**
 * antigroupstatus: fires whenever ANY personal Status update passes through
 * the bot's own status feed. For every group the poster is a member of that
 * has antigroupstatus warn/kick enabled, warn or kick them in that group.
 *
 * Note: WhatsApp provides no API to delete another person's personal Status -
 * only the poster can remove their own. So "delete" is intentionally not a
 * supported mode here; only warn/kick act within the group itself.
 */
async function handleGroupStatusPost(Cypher, m, db, saveDatabase) {
    if (m.chat !== 'status@broadcast' || !m.sender) return;

    try {
        const allGroups = await Cypher.groupFetchAllParticipating();
        for (const groupId of Object.keys(allGroups || {})) {
            const cfg = db.chats && db.chats[groupId];
            if (!cfg || (!cfg.antigroupstatuswarn && !cfg.antigroupstatuskick)) continue;

            const participants = (allGroups[groupId].participants || []);
            const isMember = participants.some(p => p.id === m.sender);
            if (!isMember) continue;

            if (cfg.antigroupstatuskick) {
                await Cypher.groupParticipantsUpdate(groupId, [m.sender], 'remove').catch(() => {});
                await Cypher.sendMessage(groupId, {
                    text: `🚫 @${m.sender.split('@')[0]} was kicked for posting a Status update.`,
                    mentions: [m.sender],
                }).catch(() => {});
            } else {
                const fakeM = { chat: groupId, key: { remoteJid: groupId } };
                const warn = buildCustomWarnHandler(Cypher, fakeM, db, saveDatabase, {
                    counterField: 'statusWarnings',
                    limit: 5,
                    reason: 'posting a Status update',
                });
                await warn(m.sender);
            }
        }
    } catch (_) {}
}

module.exports = {
    buildCustomWarnHandler,
    isEmojiOnly,
    handleSecretForwards,
    handleGroupStatusPost,
};
