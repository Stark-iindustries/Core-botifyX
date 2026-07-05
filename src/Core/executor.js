'use strict';

const fs   = require('fs');
const path = require('path');

const { heart }                        = require('./heart');
const { antiBot, handleBotKickReply }  = require('./antibot');
const { initChatEntry, saveBlacklist } = require('./database');
const { writeEnvKey }                  = require('./bot');
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
        // Direct comparison: strip @domain so @lid and @s.whatsapp.net with
        // the same phone number are treated as equal.
        const ownerJid  = global.creator || '';
        const isSudo    = Array.isArray(db.sudo) && db.sudo.includes(sender);
        let   isCreator =
            (numOnly(sender) && numOnly(ownerJid) && numOnly(sender) === numOnly(ownerJid)) ||
            isSudo ||
            (m.fromMe && !m.isBaileys);

        // ── 6. LID/JID cross-reference (group messages only) ─────────────────
        // WhatsApp groups with Member Privacy use @lid (Linked ID) for the
        // sender JID instead of the @s.whatsapp.net phone-number JID.
        // The numeric part of an @lid (e.g. "178100214202616") is a hashed
        // device identifier — NOT the phone number — so numOnly() comparison
        // above fails.  We bridge this with three passes:
        //
        //  Pass 1 — Fast cache hit: if we previously learned the owner's LID
        //           (stored in global.ownerLID / OWNER_LID .env key), compare
        //           directly. O(1).
        //
        //  Pass 2 — Forward scan: find the participant entry whose p.id or
        //           p.lid matches the sender's ID, then verify any of that
        //           participant's JIDs resolves to the owner's phone number.
        //           Covers groups where p.id = phone JID, p.lid = LID.
        //
        //  Pass 3 — Reverse scan: find the participant entry whose p.id or
        //           p.lid matches the owner's phone number, then check if the
        //           sender matches any of that participant's JIDs.
        //           Covers groups where p.id = phone JID and the bot needs to
        //           go the other direction.
        //
        // When either Pass 2 or 3 succeeds we also cache the discovered LID in
        // global.ownerLID and persist it to .env so Pass 1 fires on all
        // subsequent messages.
        if (!isCreator && isGroup && groupMetadata) {
            const senderN      = numOnly(sender);
            const participants = groupMetadata.participants || [];

            // Pass 0 — Own-account LID: Baileys reports fromMe=false for the owner's
            // own phone messages in groups with Member Privacy. The sender arrives as
            // an @lid identifier that never matches the stored phone number, so Passes
            // 1-3 all fail. Fix: compare the sender's LID against the bot's own
            // account LID stored in its Baileys credentials — if they match, the
            // sender IS the owner/bot account.
            if (!isCreator) {
                try {
                    // Cypher.authState is not on the socket — use Cypher.user.lid instead
                    const myLid = Cypher.user?.lid;
                    if (myLid && numOnly(myLid) === senderN) {
                        isCreator = true;
                        if (!global.ownerLID) {
                            global.ownerLID = senderN;
                            writeEnvKey('OWNER_LID', senderN);
                        }
                        console.log(color('[BOTIFY-X] ✅ isCreator via own-account LID (Pass 0)', 'green'));
                    }
                } catch (_) {}
            }

            // Pass 1 — ownerLID cache
            if (global.ownerLID && senderN === global.ownerLID) {
                isCreator = true;
                console.log(color('[BOTIFY-X] ✅ isCreator via ownerLID cache', 'green'));
            }

            if (!isCreator && global.ownernumber) {
                // Pass 2 — Forward: who sent this message? Do any of their JIDs match owner's phone?
                const bySender = participants.find(p => p && (
                    numOnly(p.id)  === senderN ||
                    numOnly(p.lid) === senderN
                ));
                if (bySender) {
                    const jids    = [bySender.id, bySender.lid].filter(Boolean);
                    const matched = jids.some(j => numOnly(j) === global.ownernumber);
                    if (matched) {
                        isCreator = true;
                        // Cache the LID so Pass 1 catches it next time
                        const lidJid = jids.find(j => j && j.endsWith('@lid'));
                        if (lidJid && !global.ownerLID) {
                            global.ownerLID = numOnly(lidJid);
                            writeEnvKey('OWNER_LID', global.ownerLID);
                        }
                        console.log(color(`[BOTIFY-X] ✅ isCreator via forward-LID scan (LID=${global.ownerLID || senderN})`, 'green'));
                    }
                }

                // Pass 3 — Reverse: find owner by phone number among participants,
                //          then check if the sender is one of their JIDs.
                if (!isCreator) {
                    const byPhone = participants.find(p => p && (
                        numOnly(p.id)  === global.ownernumber ||
                        numOnly(p.lid) === global.ownernumber
                    ));
                    if (byPhone) {
                        const jids    = [byPhone.id, byPhone.lid].filter(Boolean);
                        const matched = jids.some(j => numOnly(j) === senderN);
                        if (matched) {
                            isCreator = true;
                            // Cache the LID
                            const lidJid = jids.find(j => j && j.endsWith('@lid'));
                            if (lidJid && !global.ownerLID) {
                                global.ownerLID = numOnly(lidJid);
                                writeEnvKey('OWNER_LID', global.ownerLID);
                            }
                            console.log(color(`[BOTIFY-X] ✅ isCreator via reverse-phone scan (LID=${global.ownerLID || senderN})`, 'green'));
                        }
                    }
                }
            }

            // Diagnostic — always log for groups so we can see what's happening
            console.log(color(
                `[BOTIFY-X] ◆ GROUP-CHECK  sender=${senderN} ownerNum=${global.ownernumber || '?'} ownerLID=${global.ownerLID || '?'} isCreator=${isCreator} mode=${mode}`,
                isCreator ? 'green' : 'cyan'));
        }

        // ── 7. Auto-owner claim ───────────────────────────────────────────────
        // If no custom owner has been set, the first person to send a private
        // DM to the bot (within the 5-min window opened at connect) is
        // automatically registered as the owner — zero config needed.
        if (global.pendingOwnerClaim && !isGroup) {
            const claimedNum = numOnly(sender);
            if (claimedNum) {
                // Close the window
                global.pendingOwnerClaim = false;
                if (global.ownerClaimTimer) {
                    clearTimeout(global.ownerClaimTimer);
                    global.ownerClaimTimer = null;
                }
                // Update all globals
                global.ownerNumber  = claimedNum;
                global.ownernumber  = claimedNum;
                global.creator      = `${claimedNum}@s.whatsapp.net`;
                // Clear any stale LID — it belongs to the old (bot) number
                global.ownerLID     = (process.env.OWNER_LID || '').replace(/[^0-9]/g, '') || null;
                // Persist phone number to .env
                writeEnvKey('OWNER_NUMBER', claimedNum);
                process.env.OWNER_NUMBER = claimedNum;
                console.log(color(`[BOTIFY-X] ✅ Owner auto-registered: ${claimedNum}`, 'green'));
                isCreator = true;
                await Cypher.sendMessage(chat, {
                    text: `✅ *You've been registered as the BotifyX owner!*\n\n` +
                          `📱 Your number: *${claimedNum}*\n\n` +
                          `You can now control the bot from groups too.\n` +
                          `_This was a one-time setup — your number is saved permanently._`,
                }, { quoted: m });
            }
        }

        // ── 8. Mode gate ──────────────────────────────────────────────────────
        const allowed =
            isCreator ||
            mode === 'public' ||
            (mode === 'group' && isGroup) ||
            (mode === 'pm'    && !isGroup);
        if (!allowed) return;

        // ── 9. Autoread ───────────────────────────────────────────────────────
        if (db.settings.autoread === 'all' ||
            (db.settings.autoread === 'group' && isGroup) ||
            (db.settings.autoread === 'pm'    && !isGroup)) {
            await Cypher.readMessages([m.key]).catch(() => {});
        }

        // ── 10. Presence ──────────────────────────────────────────────────────
        if (db.settings.autotype === 'all' ||
            (db.settings.autotype === 'group' && isGroup) ||
            (db.settings.autotype === 'pm'    && !isGroup)) {
            await Cypher.sendPresenceUpdate('composing', chat).catch(() => {});
        } else if (db.settings.autorecord === 'all' ||
            (db.settings.autorecord === 'group' && isGroup) ||
            (db.settings.autorecord === 'pm'    && !isGroup)) {
            await Cypher.sendPresenceUpdate('recording', chat).catch(() => {});
        }

        // ── 11. Antibot ───────────────────────────────────────────────────────
        await antiBot(Cypher, m, db).catch(() => {});
        await handleBotKickReply(Cypher, m, db).catch(() => {});

        // ── 12. Autoreact ─────────────────────────────────────────────────────
        const emojis    = (db.settings.statusemoji || '🧡').split(',').map(e => e.trim());
        const randEmoji = () => emojis[Math.floor(Math.random() * emojis.length)];
        if (db.settings.autoreact === 'all' ||
            (db.settings.autoreact === 'group' && isGroup) ||
            (db.settings.autoreact === 'pm'    && !isGroup)) {
            await Cypher.sendMessage(chat, { react: { text: randEmoji(), key: m.key } }).catch(() => {});
        }

        // ── 13. Command detection ─────────────────────────────────────────────
        const body  = m.body || '';
        const pfxRe = prefix
            ? new RegExp(`^[${prefix.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`)
            : null;
        const isCmd = pfxRe ? pfxRe.test(body) : body.length > 0;

        // ── 14. Chatbot ───────────────────────────────────────────────────────
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

        // ── 15. Extract command ───────────────────────────────────────────────
        const rawCmd  = prefix ? body.slice(prefix.length).trim() : body.trim();
        const parts   = rawCmd.split(/\s+/);
        const command = (parts[0] || '').toLowerCase();
        const args    = parts.slice(1);
        const text    = args.join(' ');
        const q       = text;
        if (!command) return;

        // ── 16. Helpers ───────────────────────────────────────────────────────
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

        // ── 17. Context ───────────────────────────────────────────────────────
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

        // ── 18. Sticker alias ─────────────────────────────────────────────────
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

        // ── 19. Find plugin ───────────────────────────────────────────────────
        const plugin = plugins.find(p => {
            const cmds = Array.isArray(p.command) ? p.command : [p.command];
            return cmds.includes(command);
        });

        if (!plugin) {
            console.log(color(`[BOTIFY-X] no plugin: "${command}"`, 'yellow'));
            return;
        }

        // ── 20. Pre-command auto features ─────────────────────────────────────
        if (plugin.react && db.settings.autoreact === 'command') {
            await Cypher.sendMessage(chat, { react: { text: plugin.react, key: m.key } }).catch(() => {});
        }
        if (db.settings.autotype   === 'command') await Cypher.sendPresenceUpdate('composing', chat).catch(() => {});
        if (db.settings.autorecord === 'command') await Cypher.sendPresenceUpdate('recording', chat).catch(() => {});
        if (db.settings.autoread   === 'command') await Cypher.readMessages([m.key]).catch(() => {});

        // ── 21. Execute ───────────────────────────────────────────────────────
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
