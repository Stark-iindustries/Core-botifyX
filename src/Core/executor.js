'use strict';

const fs   = require('fs');
const path = require('path');

const { heart }                        = require('./heart');
const { antiBot, handleBotKickReply }  = require('./antibot');
const { initChatEntry, saveBlacklist } = require('./database');
const GroupDB                          = require('./group');
const { color }                        = require('../../lib/color');

// ─── Persist across messages ──────────────────────────────────────────────────
const kickQueue  = new Map();
const msgCache   = new Map(); // antidelete cache

// ─── Bad words loader ─────────────────────────────────────────────────────────
function loadBadWords() {
    const badPath = path.join(__dirname, '../../src/Database/badwords.json');
    try {
        if (!fs.existsSync(badPath)) {
            fs.writeFileSync(badPath, JSON.stringify([], null, 2));
            return [];
        }
        return JSON.parse(fs.readFileSync(badPath, 'utf8'));
    } catch (_) { return []; }
}

// ─── Helper: group admins ─────────────────────────────────────────────────────
function getAdmins(participants = []) {
    return participants
        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
        .map(p => p.id);
}

// ─── Warn handler ─────────────────────────────────────────────────────────────
function buildWarnHandler(Cypher, m, db, saveDatabase) {
    return async (user) => {
        if (!user) return;
        if (!db.chats[m.chat]) initChatEntry(m.chat);
        const chat = db.chats[m.chat];
        if (!chat.warnings) chat.warnings = {};
        chat.warnings[user] = (chat.warnings[user] || 0) + 1;
        const count  = chat.warnings[user];
        const limit  = chat.warnLimit || db.settings.warnLimit || 5;
        await Cypher.sendMessage(m.chat, {
            text: `⚠️ *Warning ${count}/${limit}* for @${user.split('@')[0]}`,
            mentions: [user],
        }, { quoted: m });
        if (count >= limit) {
            chat.warnings[user] = 0;
            await Cypher.groupParticipantsUpdate(m.chat, [user], 'remove').catch(() => {});
            await Cypher.sendMessage(m.chat, {
                text: `🚫 @${user.split('@')[0]} has been kicked after ${limit} warnings.`,
                mentions: [user],
            });
        }
        saveDatabase();
    };
}

// ─── processMessage — main message router ─────────────────────────────────────
async function processMessage(Cypher, msg, db, plugins, saveDatabase, loadBlacklist) {
    try {
        // 1. Parse raw message
        const m = heart(Cypher, msg);
        if (!m || !m.message || !m.chat) return;
        if (m.isBaileys) return;

        // Cache for antidelete
        if (m.id) msgCache.set(m.id, msg);
        global.msgCache = msgCache;

        const sender   = m.sender || '';
        const chat     = m.chat   || '';
        const isGroup  = m.isGroup || false;
        const prefix   = db.settings.prefix ?? '.';
        const mode     = db.settings.mode || 'private';

        // 2. Blacklist check
        const blacklist = loadBlacklist();
        if (blacklist.blacklisted_numbers.includes(sender)) return;
        if (blacklist.blacklisted_numbers.includes(chat))   return;

        // 3. Autoblock (country code filter for PMs)
        if (!isGroup && db.settings.autoblock && sender !== global.creator) {
            const senderCode = sender.replace('@s.whatsapp.net', '');
            const allowed    = db.settings.allowedCodes || [];
            if (allowed.length > 0 && !allowed.some(c => senderCode.startsWith(c))) return;
        }

        // 4. Owner / sudo check
        const ownerJid  = global.creator || '';
        const isSudo    = Array.isArray(db.sudo) && db.sudo.includes(sender);
        const isCreator = sender === ownerJid || isSudo;

        // 5. Group metadata
        let groupMetadata = null;
        let isAdmins      = false;
        let isBotAdmins   = false;

        if (isGroup) {
            try {
                groupMetadata = await Cypher.groupMetadata(chat);
            } catch (_) {}
            if (groupMetadata) {
                const admins = getAdmins(groupMetadata.participants || []);
                isAdmins    = admins.includes(sender);
                isBotAdmins = admins.includes(global.botNumber || '');
            }
            // Init chat entry
            initChatEntry(chat);
            // Track messages for active-user stats
            GroupDB.addMessage(chat, sender);
        }

        // 6. Mode check (before auto-features so typing still triggers)
        const allowed =
            isCreator ||
            mode === 'public' ||
            (mode === 'group' && isGroup) ||
            (mode === 'pm'    && !isGroup);
        if (!allowed) return;

        // 7. Autoread
        if (db.settings.autoread === 'all' ||
            (db.settings.autoread === 'group' && isGroup) ||
            (db.settings.autoread === 'pm'    && !isGroup)) {
            await Cypher.readMessages([m.key]).catch(() => {});
        }

        // 8. Autotype / Autorecord presence
        const presenceChat = chat;
        if (db.settings.autotype === 'all' ||
            (db.settings.autotype === 'group' && isGroup) ||
            (db.settings.autotype === 'pm'    && !isGroup)) {
            await Cypher.sendPresenceUpdate('composing', presenceChat).catch(() => {});
        } else if (db.settings.autorecord === 'all' ||
            (db.settings.autorecord === 'group' && isGroup) ||
            (db.settings.autorecord === 'pm'    && !isGroup)) {
            await Cypher.sendPresenceUpdate('recording', presenceChat).catch(() => {});
        }

        // 9. Antibot check
        await antiBot(Cypher, m, db).catch(() => {});
        await handleBotKickReply(Cypher, m, db).catch(() => {});

        // 10. Autoreact (all / group / pm)
        const emojis    = (db.settings.statusemoji || '🧡').split(',').map(e => e.trim());
        const randEmoji = () => emojis[Math.floor(Math.random() * emojis.length)];
        if (db.settings.autoreact === 'all' ||
            (db.settings.autoreact === 'group' && isGroup) ||
            (db.settings.autoreact === 'pm'    && !isGroup)) {
            await Cypher.sendMessage(chat, {
                react: { text: randEmoji(), key: m.key },
            }).catch(() => {});
        }

        // 11. Chatbot (non-command messages)
        const body  = m.body || '';
        const pfxRe = prefix ? new RegExp(`^[${prefix.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`) : null;
        const isCmd = pfxRe ? pfxRe.test(body) : body.length > 0;

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

        // 12. Extract command + args
        const rawCmd = prefix ? body.slice(prefix.length).trim() : body.trim();
        const parts  = rawCmd.split(/\s+/);
        const command = (parts[0] || '').toLowerCase();
        const args    = parts.slice(1);
        const text    = args.join(' ');
        const q       = text;

        if (!command) return;

        // 13. Font transform (if enabled)
        const fontStyleReply = (txt) => {
            try {
                const fonts = require('./fonts');
                const style = db.settings.fontstyle;
                const fn    = (style && fonts[style]) ? fonts[style] : fonts.default;
                return fn(String(txt));
            } catch (_) { return String(txt); }
        };

        // 14. Build reply helper
        const reply = async (txt) => {
            const out = fontStyleReply(txt);
            return Cypher.sendMessage(chat, { text: out }, { quoted: m });
        };

        // 15. Bad words list
        const bad = loadBadWords();

        // 16. isUrl helper
        const isUrl = (url) => /https?:\/\/[^\s]+/.test(url);

        // 17. Quoted + mime
        const quoted = m.quoted || null;
        const mime   = quoted?.mimetype || m.msg?.mimetype || '';

        // 18. Full context
        const context = {
            Cypher, m, db, reply, loadBlacklist, saveDatabase, saveBlacklist,
            prefix, command, args, text, q,
            from:        chat,
            sender,
            pushName:    msg.pushName || '',
            isCreator,
            isSudo,
            isAdmin:     isAdmins,
            isAdmins,
            isBotAdmin:  isBotAdmins,
            isBotAdmins,
            isGroup,
            botNumber:   global.botNumber || '',
            mess:        global.mess,
            modeStatus:  mode,
            quoted,
            mime,
            sleep:       (ms) => new Promise(r => setTimeout(r, ms)),
            isUrl,
            bad,
            GroupDB,
            kickQueue,
            warnHandler: buildWarnHandler(Cypher, m, db, saveDatabase),
            groupMetadata,
        };

        // 19. Sticker alias check
        if (m.msg?.mtype === 'stickerMessage' && db.settings.stickerAliases) {
            const hash       = [...(m.msg.fileSha256 || [])].toString();
            const aliasCmd   = db.settings.stickerAliases[hash];
            if (aliasCmd) {
                const aliasPlugin = plugins.find(p => {
                    const cmds = Array.isArray(p.command) ? p.command : [p.command];
                    return cmds.includes(aliasCmd);
                });
                if (aliasPlugin) {
                    await aliasPlugin.operate({ ...context, command: aliasCmd }).catch(e =>
                        console.error(color(`[BOTIFY-X] Plugin error (${aliasCmd}): ${e.message}`, 'red'))
                    );
                    saveDatabase();
                    return;
                }
            }
        }

        // 20. Find plugin
        const plugin = plugins.find(p => {
            const cmds = Array.isArray(p.command) ? p.command : [p.command];
            return cmds.includes(command);
        });

        if (!plugin) return;

        // 21. Autoreact on command
        if (plugin.react && db.settings.autoreact === 'command') {
            await Cypher.sendMessage(chat, {
                react: { text: plugin.react, key: m.key },
            }).catch(() => {});
        }

        // 22. Autotype on command
        if (db.settings.autotype === 'command') {
            await Cypher.sendPresenceUpdate('composing', chat).catch(() => {});
        }
        if (db.settings.autorecord === 'command') {
            await Cypher.sendPresenceUpdate('recording', chat).catch(() => {});
        }
        if (db.settings.autoread === 'command') {
            await Cypher.readMessages([m.key]).catch(() => {});
        }

        // 23. Execute
        await plugin.operate(context);
        saveDatabase();

    } catch (err) {
        console.error(color(`[BOTIFY-X] processMessage error: ${err.message}`, 'red'));
    }
}

module.exports = { processMessage };
