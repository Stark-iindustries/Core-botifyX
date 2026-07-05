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
        if (!m || !m.message || !m.chat) return;
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
        const ownerJid  = global.creator || '';
        const isSudo    = Array.isArray(db.sudo) && db.sudo.includes(sender);
        let   isCreator =
            (numOnly(sender) && numOnly(ownerJid) && numOnly(sender) === numOnly(ownerJid)) ||
            isSudo ||
            (m.fromMe && !m.isBaileys);

        // @lid group-metadata cross-reference:
        if (!isCreator && isGroup && groupMetadata && global.ownernumber) {
            const senderN = numOnly(sender);
            const participant = (groupMetadata.participants || []).find(p => {
                if (!p) return false;
                return numOnly(p.id) === senderN || numOnly(p.lid) === senderN;
            });
            if (participant) {
                const allJids = [participant.id, participant.lid].filter(Boolean);
                const matched = allJids.some(j => numOnly(j) === global.ownernumber);
                if (matched) isCreator = true;
            }
        }

        // ── 6. Auto-owner claim ───────────────────────────────────────────────
        // If no custom owner has been set, the first person to send a private
        // DM to the bot (within the 5-min window opened at connect) is
        // automatically registered as the owner — zero config needed.
        if (global.pendingOwnerClaim && !isGroup) {
            const { writeEnvKey } = require('./bot');
            const claimedNum = numOnly(sender);
            if (claimedNum) {
                // Close the window
                global.pendingOwnerClaim = false;
                if (global.ownerClaimTimer) {
                    clearTimeout(global.ownerClaimTimer);
                    global.ownerClaimTimer = null;
                }
                // Update all globals so every subsequent message works
                global.ownerNumber  = claimedNum;
                global.ownernumber  = claimedNum;
                global.creator      = `${claimedNum}@s.whatsapp.net`;
                // Persist to .env so future restarts remember this number
                writeEnvKey('OWNER_NUMBER', claimedNum);
                process.env.OWNER_NUMBER = claimedNum;
                console.log(color(`[BOTIFY-X] ✅ Owner auto-registered: ${claimedNum}`, 'green'));
                // Treat this very message as coming from the owner
                isCreator = true;
                // Notify the new owner
                await Cypher.sendMessage(chat, {
                    text: `✅ *You've been registered as the BotifyX owner!*\n\n` +
                          `📱 Your number: *${claimedNum}*\n\n` +
                          `You can now control the bot from groups too.\n` +
                          `_This was a one-time setup — your number is saved permanently._`,
                }, { quoted: m });
            }
        }

        // ── 7. Mode gate ──────────────────────────────────────────────────────
        const allowed =
            isCreator ||
            mode === 'public' ||
            (mode === 'group' && isGroup) ||
            (mode === 'pm'    && !isGroup);
        if (!allowed) return;

        // ── 8. Autoread ───────────────────────────────────────────────────────
        if (db.settings.autoread === 'all' ||
            (db.settings.autoread === 'group' && isGroup) ||
            (db.settings.autoread === 'pm'    && !isGroup)) {
            await Cypher.readMessages([m.key]).catch(() => {});
        }

        // ── 9. Presence ───────────────────────────────────────────────────────
        if (db.settings.autotype === 'all' ||
            (db.settings.autotype === 'group' && isGroup) ||
            (db.settings.autotype === 'pm'    && !isGroup)) {
            await Cypher.sendPresenceUpdate('composing', chat).catch(() => {});
        } else if (db.settings.autorecord === 'all' ||
            (db.settings.autorecord === 'group' && isGroup) ||
            (db.settings.autorecord === 'pm'    && !isGroup)) {
            await Cypher.sendPresenceUpdate('recording', chat).catch(() => {});
        }

        // ── 10. Antibot ───────────────────────────────────────────────────────
        await antiBot(Cypher, m, db).catch(() => {});
        await handleBotKickReply(Cypher, m, db).catch(() => {});

        // ── 11. Autoreact ─────────────────────────────────────────────────────
        const emojis    = (db.settings.statusemoji || '🧡').split(',').map(e => e.trim());
        const randEmoji = () => emojis[Math.floor(Math.random() * emojis.length)];
        if (db.settings.autoreact === 'all' ||
            (db.settings.autoreact === 'group' && isGroup) ||
            (db.settings.autoreact === 'pm'    && !isGroup)) {
            await Cypher.sendMessage(chat, { react: { text: randEmoji(), key: m.key } }).catch(() => {});
        }

        // ── 12. Command detection ─────────────────────────────────────────────
        const body  = m.body || '';
        const pfxRe = prefix
            ? new RegExp(`^[${prefix.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`)
            : null;
        const isCmd = pfxRe ? pfxRe.test(body) : body.length > 0;

        // ── 13. Chatbot ───────────────────────────────────────────────────────
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

        // ── 14. Extract command ───────────────────────────────────────────────
        const rawCmd  = prefix ? body.slice(prefix.length).trim() : body.trim();
        const parts   = rawCmd.split(/\s+/);
        const command = (parts[0] || '').toLowerCase();
        const args    = parts.slice(1);
        const text    = args.join(' ');
        const q       = text;
        if (!command) return;

        // ── 15. Helpers ───────────────────────────────────────────────────────
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

        // ── 16. Context ───────────────────────────────────────────────────────
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

        // ── 17. Sticker alias ─────────────────────────────────────────────────
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

        // ── 18. Find plugin ───────────────────────────────────────────────────
        const plugin = plugins.find(p => {
            const cmds = Array.isArray(p.command) ? p.command : [p.command];
            return cmds.includes(command);
        });

        if (!plugin) {
            console.log(color(`[BOTIFY-X] no plugin: "${command}"`, 'yellow'));
            return;
        }

        // ── 19. Pre-command auto features ─────────────────────────────────────
        if (plugin.react && db.settings.autoreact === 'command') {
            await Cypher.sendMessage(chat, { react: { text: plugin.react, key: m.key } }).catch(() => {});
        }
        if (db.settings.autotype   === 'command') await Cypher.sendPresenceUpdate('composing', chat).catch(() => {});
        if (db.settings.autorecord === 'command') await Cypher.sendPresenceUpdate('recording', chat).catch(() => {});
        if (db.settings.autoread   === 'command') await Cypher.readMessages([m.key]).catch(() => {});

        // ── 20. Execute ───────────────────────────────────────────────────────
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
