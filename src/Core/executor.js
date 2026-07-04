'use strict';

const fs   = require('fs');
const path = require('path');

const { heart }                        = require('./heart');
const { antiBot, handleBotKickReply }  = require('./antibot');
const { initChatEntry, saveBlacklist } = require('./database');
const GroupDB                          = require('./group');
const { color }                        = require('../../lib/color');

const kickQueue = new Map();
const msgCache  = new Map();

function loadBadWords() {
    const p = path.join(__dirname, '../../src/Database/badwords.json');
    try {
        if (!fs.existsSync(p)) { fs.writeFileSync(p, '[]'); return []; }
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (_) { return []; }
}

function getAdmins(participants = []) {
    return participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
}

function buildWarnHandler(Cypher, m, db, saveDatabase) {
    return async (user) => {
        if (!user) return;
        if (!db.chats[m.chat]) initChatEntry(m.chat);
        const chat = db.chats[m.chat];
        if (!chat.warnings) chat.warnings = {};
        chat.warnings[user] = (chat.warnings[user] || 0) + 1;
        const count = chat.warnings[user];
        const limit = chat.warnLimit || db.settings.warnLimit || 5;
        await Cypher.sendMessage(m.chat, { text: `⚠️ *Warning ${count}/${limit}* for @${user.split('@')[0]}`, mentions: [user] }, { quoted: m });
        if (count >= limit) {
            chat.warnings[user] = 0;
            await Cypher.groupParticipantsUpdate(m.chat, [user], 'remove').catch(() => {});
            await Cypher.sendMessage(m.chat, { text: `🚫 @${user.split('@')[0]} kicked after ${limit} warnings.`, mentions: [user] });
        }
        saveDatabase();
    };
}

// Strip @domain suffix — normalises @s.whatsapp.net, @lid, @g.us etc.
// to a plain number string so comparisons never fail on domain mismatch.
function numOnly(jid) { return (jid || '').replace(/@\S+$/, ''); }

async function processMessage(Cypher, msg, db, plugins, saveDatabase, loadBlacklist) {
    try {
        // ── 1. Parse ──────────────────────────────────────────────────────────
        const m = heart(Cypher, msg);

        // CHECKPOINT A — very first thing, before every filter
        const rawGroup = (msg.key?.remoteJid || '').endsWith('@g.us');
        if (rawGroup) {
            console.log(color(
                `[BOTIFY-X] ◆ CK-A  heart=${m ? 'OK' : 'NULL'} fromMe=${msg.key?.fromMe} id=${(msg.key?.id || '').slice(-8)}`,
                'magenta'));
        }

        if (!m || !m.message || !m.chat) return;

        if (m.isGroup) {
            console.log(color(
                `[BOTIFY-X] ◆ CK-B  isBaileys=${m.isBaileys} sender=${numOnly(m.sender)} creator=${numOnly(global.creator)} body="${(m.body || '').slice(0, 30)}"`,
                'cyan'));
        }

        if (m.isBaileys) return;

        if (m.id) msgCache.set(m.id, msg);
        global.msgCache = msgCache;

        const sender  = m.sender || '';
        const chat    = m.chat   || '';
        const isGroup = m.isGroup || false;
        const prefix  = db.settings.prefix ?? '.';
        const mode    = db.settings.mode || 'private';

        // ── 2. Blacklist ──────────────────────────────────────────────────────
        const blacklist = loadBlacklist();
        if (blacklist.blacklisted_numbers.includes(sender)) return;
        if (blacklist.blacklisted_numbers.includes(chat))   return;

        // ── 3. Autoblock ──────────────────────────────────────────────────────
        if (!isGroup && db.settings.autoblock && numOnly(sender) !== numOnly(global.creator)) {
            const senderCode   = numOnly(sender);
            const allowedCodes = db.settings.allowedCodes || [];
            if (allowedCodes.length > 0 && !allowedCodes.some(c => senderCode.startsWith(c))) return;
        }

        // ── 4. Group metadata ─────────────────────────────────────────────────
        let groupMetadata = null;
        let isAdmins      = false;
        let isBotAdmins   = false;

        if (isGroup) {
            try {
                groupMetadata = await Cypher.groupMetadata(chat);
            } catch (e) {
                console.warn(color(`[BOTIFY-X] groupMetadata failed (${chat}): ${e.message}`, 'yellow'));
            }
            if (groupMetadata) {
                const admins = getAdmins(groupMetadata.participants || []);
                isAdmins    = admins.includes(sender);
                isBotAdmins = admins.includes(global.botNumber || '');
            }
            initChatEntry(chat);
            GroupDB.addMessage(chat, sender);
        }

        // ── 5. Owner / sudo / isCreator ───────────────────────────────────────
        // Comparison strips the @domain suffix so @lid and @s.whatsapp.net
        // are treated as equal when the numeric part matches.
        // Example: "178100214202616@lid" === "178100214202616@s.whatsapp.net"
        //          after numOnly() both become "178100214202616".
        const ownerJid  = global.creator || '';
        const isSudo    = Array.isArray(db.sudo) && db.sudo.includes(sender);
        let   isCreator =
            (numOnly(sender) && numOnly(ownerJid) && numOnly(sender) === numOnly(ownerJid)) ||
            isSudo ||
            (m.fromMe && !m.isBaileys);   // own-session message that isn't a bot echo

        // @lid group-metadata cross-reference:
        // If still not matched, look the sender up in groupMetadata.participants.
        // Each participant has an `id` (phone JID) and possibly a `lid` field.
        // We try all available JIDs for the participant and compare by number.
        if (!isCreator && isGroup && groupMetadata && global.ownernumber) {
            const senderN = numOnly(sender);
            const participant = (groupMetadata.participants || []).find(p => {
                if (!p) return false;
                return numOnly(p.id) === senderN || numOnly(p.lid) === senderN;
            });
            if (participant) {
                // Resolve to the phone-format JID and compare numerically
                const allJids = [participant.id, participant.lid].filter(Boolean);
                const matched = allJids.some(j => numOnly(j) === global.ownernumber);
                if (matched) isCreator = true;
            }
        }

        if (isGroup) {
            console.log(color(
                `[BOTIFY-X] ◆ CK-C  isCreator=${isCreator} mode=${mode} allowed=${
                    isCreator || mode==='public' || (mode==='group'&&isGroup) || (mode==='pm'&&!isGroup)}`,
                'cyan'));
        }

        // ── 6. Mode gate ──────────────────────────────────────────────────────
        const allowed =
            isCreator ||
            mode === 'public' ||
            (mode === 'group' && isGroup) ||
            (mode === 'pm'    && !isGroup);
        if (!allowed) return;

        // ── 7. Autoread ───────────────────────────────────────────────────────
        if (db.settings.autoread === 'all' ||
            (db.settings.autoread === 'group' && isGroup) ||
            (db.settings.autoread === 'pm'    && !isGroup)) {
            await Cypher.readMessages([m.key]).catch(() => {});
        }

        // ── 8. Presence ───────────────────────────────────────────────────────
        if (db.settings.autotype === 'all' ||
            (db.settings.autotype === 'group' && isGroup) ||
            (db.settings.autotype === 'pm'    && !isGroup)) {
            await Cypher.sendPresenceUpdate('composing', chat).catch(() => {});
        } else if (db.settings.autorecord === 'all' ||
            (db.settings.autorecord === 'group' && isGroup) ||
            (db.settings.autorecord === 'pm'    && !isGroup)) {
            await Cypher.sendPresenceUpdate('recording', chat).catch(() => {});
        }

        // ── 9. Antibot ────────────────────────────────────────────────────────
        await antiBot(Cypher, m, db).catch(() => {});
        await handleBotKickReply(Cypher, m, db).catch(() => {});

        // ── 10. Autoreact ─────────────────────────────────────────────────────
        const emojis    = (db.settings.statusemoji || '🧡').split(',').map(e => e.trim());
        const randEmoji = () => emojis[Math.floor(Math.random() * emojis.length)];
        if (db.settings.autoreact === 'all' ||
            (db.settings.autoreact === 'group' && isGroup) ||
            (db.settings.autoreact === 'pm'    && !isGroup)) {
            await Cypher.sendMessage(chat, { react: { text: randEmoji(), key: m.key } }).catch(() => {});
        }

        // ── 11. Command detection ─────────────────────────────────────────────
        const body  = m.body || '';
        const pfxRe = prefix
            ? new RegExp(`^[${prefix.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`)
            : null;
        const isCmd = pfxRe ? pfxRe.test(body) : body.length > 0;

        if (isGroup) {
            console.log(color(
                `[BOTIFY-X] ◆ CK-D  prefix="${prefix}" body="${body.slice(0,30)}" isCmd=${isCmd}`,
                'cyan'));
        }

        // ── 12. Chatbot ───────────────────────────────────────────────────────
        if (!isCmd && db.settings.chatbot && !m.isBaileys) {
            try {
                const GeminiAI = require('../Functions/gemini');
                const ai = new GeminiAI();
                const resp = await ai.chat(sender, body);
                if (resp) await Cypher.sendMessage(chat, { text: resp }, { quoted: m });
            } catch (_) {}
            return;
        }
        if (!isCmd) return;

        // ── 13. Extract command ───────────────────────────────────────────────
        const rawCmd  = prefix ? body.slice(prefix.length).trim() : body.trim();
        const parts   = rawCmd.split(/\s+/);
        const command = (parts[0] || '').toLowerCase();
        const args    = parts.slice(1);
        const text    = args.join(' ');
        const q       = text;
        if (!command) return;

        // ── 14. Helpers ───────────────────────────────────────────────────────
        const fontStyleReply = (txt) => {
            try {
                const fonts = require('./fonts');
                const style = db.settings.fontstyle;
                const fn    = (style && fonts[style]) ? fonts[style] : fonts.default;
                return fn(String(txt));
            } catch (_) { return String(txt); }
        };
        const reply  = async (txt) => Cypher.sendMessage(chat, { text: fontStyleReply(txt) }, { quoted: m });
        const bad    = loadBadWords();
        const isUrl  = (url) => /https?:\/\/[^\s]+/.test(url);
        const quoted = m.quoted || null;
        const mime   = quoted?.mimetype || m.msg?.mimetype || '';

        // ── 15. Context ───────────────────────────────────────────────────────
        const context = {
            Cypher, m, db, reply, loadBlacklist, saveDatabase, saveBlacklist,
            prefix, command, args, text, q,
            from:         chat,
            sender,
            pushName:     msg.pushName || '',
            isCreator,
            isSudo,
            isAdmin:      isAdmins,
            isAdmins,
            isBotAdmin:   isBotAdmins,
            isBotAdmins,
            isGroup,
            botNumber:    global.botNumber || '',
            mess:         global.mess,
            modeStatus:   mode,
            quoted,
            mime,
            sleep:        (ms) => new Promise(r => setTimeout(r, ms)),
            isUrl,
            bad,
            GroupDB,
            kickQueue,
            warnHandler:  buildWarnHandler(Cypher, m, db, saveDatabase),
            groupMetadata,
            participants:  groupMetadata?.participants || [],
            isGroupAdmins: isAdmins,
            isGroupOwner:  groupMetadata?.owner ? numOnly(sender) === numOnly(groupMetadata.owner) : false,
            plugins,
        };

        // ── 16. Sticker alias ─────────────────────────────────────────────────
        if (m.msg?.mtype === 'stickerMessage' && db.settings.stickerAliases) {
            const hash     = [...(m.msg.fileSha256 || [])].toString();
            const aliasCmd = db.settings.stickerAliases[hash];
            if (aliasCmd) {
                const aliasPlugin = plugins.find(p => {
                    const cmds = Array.isArray(p.command) ? p.command : [p.command];
                    return cmds.includes(aliasCmd);
                });
                if (aliasPlugin) {
                    try { await aliasPlugin.operate({ ...context, command: aliasCmd }); }
                    catch (e) {
                        console.error(color(`[BOTIFY-X] Alias error (${aliasCmd}): ${e.message}`, 'red'));
                        try { await Cypher.sendMessage(chat, { text: `❌ *Error:* \`${aliasCmd}\`\n${e.message}` }, { quoted: m }); } catch (_) {}
                    }
                    saveDatabase();
                    return;
                }
            }
        }

        // ── 17. Find plugin ───────────────────────────────────────────────────
        const plugin = plugins.find(p => {
            const cmds = Array.isArray(p.command) ? p.command : [p.command];
            return cmds.includes(command);
        });

        if (!plugin) {
            console.log(color(`[BOTIFY-X] no plugin: "${command}"`, 'yellow'));
            return;
        }

        // ── 18. Pre-command auto features ─────────────────────────────────────
        if (plugin.react && db.settings.autoreact === 'command') {
            await Cypher.sendMessage(chat, { react: { text: plugin.react, key: m.key } }).catch(() => {});
        }
        if (db.settings.autotype   === 'command') await Cypher.sendPresenceUpdate('composing', chat).catch(() => {});
        if (db.settings.autorecord === 'command') await Cypher.sendPresenceUpdate('recording', chat).catch(() => {});
        if (db.settings.autoread   === 'command') await Cypher.readMessages([m.key]).catch(() => {});

        // ── 19. Execute ───────────────────────────────────────────────────────
        try {
            await plugin.operate(context);
        } catch (pluginErr) {
            console.error(color(`[BOTIFY-X] Plugin error (${command}): ${pluginErr.stack || pluginErr.message}`, 'red'));
            try {
                await Cypher.sendMessage(chat, {
                    text: `❌ *Command Error:* \`${command}\`\n_${pluginErr.message}_`,
                }, { quoted: m });
            } catch (_) {}
        }
        saveDatabase();

    } catch (err) {
        console.error(color(`[BOTIFY-X] processMessage crash: ${err.stack || err.message}`, 'red'));
    }
}

module.exports = { processMessage };
