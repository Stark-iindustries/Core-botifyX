'use strict';

const fs   = require('fs');
const path = require('path');

const { heart }                        = require('./heart');
const { antiBot, handleBotKickReply }  = require('./antibot');
const { initChatEntry, saveBlacklist } = require('./database');
const GroupDB                          = require('./group');
const { color }                        = require('../../lib/color');

const kickQueue  = new Map();
const msgCache   = new Map();

function loadBadWords() {
    const badPath = path.join(__dirname, '../../src/Database/badwords.json');
    try {
        if (!fs.existsSync(badPath)) { fs.writeFileSync(badPath, JSON.stringify([], null, 2)); return []; }
        return JSON.parse(fs.readFileSync(badPath, 'utf8'));
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
            await Cypher.sendMessage(m.chat, { text: `🚫 @${user.split('@')[0]} has been kicked after ${limit} warnings.`, mentions: [user] });
        }
        saveDatabase();
    };
}

async function processMessage(Cypher, msg, db, plugins, saveDatabase, loadBlacklist) {
    try {
        // ── 1. Parse ──────────────────────────────────────────────────────────
        const m = heart(Cypher, msg);

        // CHECKPOINT A — fires immediately after heart() for every group message,
        // before ANY other check. If this does NOT appear in console, heart() is
        // returning null (bad parse) or the message isn't a group message.
        const rawGroup = (msg.key?.remoteJid || '').endsWith('@g.us');
        if (rawGroup) {
            const parsed = m ? 'OK' : 'NULL';
            console.log(color(
                `[BOTIFY-X] ◆ CHECKPOINT-A` +
                ` heart=${parsed}` +
                ` fromMe=${msg.key?.fromMe}` +
                ` id=${(msg.key?.id || '').slice(-8)}`,
                'magenta'
            ));
        }

        if (!m || !m.message || !m.chat) return;

        // CHECKPOINT B — heart() succeeded, message is valid.
        // Fires before isBaileys / blacklist / allowed checks.
        if (m.isGroup) {
            console.log(color(
                `[BOTIFY-X] ◆ CHECKPOINT-B` +
                ` isBaileys=${m.isBaileys}` +
                ` sender=${(m.sender || '').split('@')[0]}` +
                ` creator=${(global.creator || '').split('@')[0]}` +
                ` body="${(m.body || '').slice(0, 35)}"`,
                'cyan'
            ));
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
        if (!isGroup && db.settings.autoblock && sender !== global.creator) {
            const senderCode   = sender.replace('@s.whatsapp.net', '');
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

        // ── 5. Owner / sudo ───────────────────────────────────────────────────
        const ownerJid = global.creator || '';
        const isSudo   = Array.isArray(db.sudo) && db.sudo.includes(sender);
        // m.fromMe && !m.isBaileys = owner typed this from their own phone,
        // not a bot echo.  Covers any JID-format mismatch in the string compare.
        let isCreator = sender === ownerJid || isSudo || (m.fromMe && !m.isBaileys);

        // @lid identity fallback (newer WhatsApp)
        if (!isCreator && isGroup && groupMetadata && global.ownernumber) {
            const participant = (groupMetadata.participants || []).find(p => p.id === sender || p.lid === sender);
            if (participant) {
                const phoneForm = [participant.id, participant.lid].filter(Boolean)
                    .find(j => j.endsWith('@s.whatsapp.net'));
                if (phoneForm && phoneForm.split('@')[0] === global.ownernumber) isCreator = true;
            }
        }

        // ── 6. Mode check ─────────────────────────────────────────────────────
        const allowed =
            isCreator ||
            mode === 'public' ||
            (mode === 'group' && isGroup) ||
            (mode === 'pm'    && !isGroup);

        // CHECKPOINT C — shows result of the allowed gate
        if (isGroup) {
            console.log(color(
                `[BOTIFY-X] ◆ CHECKPOINT-C` +
                ` isCreator=${isCreator}` +
                ` mode=${mode}` +
                ` allowed=${allowed}`,
                'cyan'
            ));
        }

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

        // CHECKPOINT D — prefix / command detection
        if (isGroup) {
            console.log(color(
                `[BOTIFY-X] ◆ CHECKPOINT-D` +
                ` prefix="${prefix}"` +
                ` body="${body.slice(0, 35)}"` +
                ` isCmd=${isCmd}`,
                'cyan'
            ));
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
            isGroupOwner:  groupMetadata?.owner ? sender === groupMetadata.owner : false,
            plugins,
        };

        // ── 16. Sticker alias ─────────────────────────────────────────────────
        if (m.msg?.mtype === 'stickerMessage' && db.settings.stickerAliases) {
            const hash      = [...(m.msg.fileSha256 || [])].toString();
            const aliasCmd  = db.settings.stickerAliases[hash];
            if (aliasCmd) {
                const aliasPlugin = plugins.find(p => {
                    const cmds = Array.isArray(p.command) ? p.command : [p.command];
                    return cmds.includes(aliasCmd);
                });
                if (aliasPlugin) {
                    try { await aliasPlugin.operate({ ...context, command: aliasCmd }); }
                    catch (e) {
                        console.error(color(`[BOTIFY-X] Plugin error (${aliasCmd}): ${e.message}`, 'red'));
                        try { await Cypher.sendMessage(chat, { text: `❌ *Error in* \`${aliasCmd}\`\n${e.message}` }, { quoted: m }); } catch (_) {}
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

        // ── 18. Pre-command auto-features ─────────────────────────────────────
        if (plugin.react && db.settings.autoreact === 'command') {
            await Cypher.sendMessage(chat, { react: { text: plugin.react, key: m.key } }).catch(() => {});
        }
        if (db.settings.autotype   === 'command') await Cypher.sendPresenceUpdate('composing',  chat).catch(() => {});
        if (db.settings.autorecord === 'command') await Cypher.sendPresenceUpdate('recording',  chat).catch(() => {});
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
        console.error(color(`[BOTIFY-X] processMessage crash: ${err.message}`, 'red'));
    }
}

module.exports = { processMessage };
