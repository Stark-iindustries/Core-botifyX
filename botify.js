'use strict';

const path = require('path');
const fs   = require('fs');
const pino = require('pino');

// ── 1. Load .env first ────────────────────────────────────────────────────────
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });

// ── Colour helpers ────────────────────────────────────────────────────────────
const cyan   = (t) => `\x1b[36m${t}\x1b[0m`;
const green  = (t) => `\x1b[32m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const red    = (t) => `\x1b[31m${t}\x1b[0m`;

// ── .env writer ───────────────────────────────────────────────────────────────
function writeEnvKey(key, value) {
    let lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8').split('\n') : [];
    const idx  = lines.findIndex(l => l.startsWith(key + '='));
    if (idx >= 0) lines[idx] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
    fs.writeFileSync(ENV_FILE, lines.join('\n'), 'utf8');
}

// ── Platform: which environments support interactive console input ─────────────
function canPromptInteractively() {
    const e = process.env;
    const isCloudNoConsole = !!(
        e.RAILWAY_SERVICE_ID || e.RAILWAY_STATIC_URL ||
        e.DYNO || e.RENDER || e.KOYEB_APP_NAME || e.FLY_APP_NAME
    );
    return !isCloudNoConsole;
}

// ── 2. Session ID prompt ──────────────────────────────────────────────────────
// Uses fs.readSync(fd=0) — a raw BLOCKING read directly on stdin file descriptor.
// This bypasses Node.js stream events entirely. On Pterodactyl/Katabump the
// stream API fires 'end' immediately at startup (WebSocket not yet attached),
// but the underlying FD 0 stays connected. readSync blocks until the user
// actually pastes something, then returns. No stream events, no crashes.
function promptForSessionId() {
    return new Promise((resolve, reject) => {
        process.stdout.write(red('\nPlease wait for a few seconds to enter your session id!\n'));
        process.stdout.write(cyan('[BOTIFY-X] Session ID format: BOTIFY-X=<base64string>\n'));
        process.stdout.write('\nPaste Session ID → ');

        const readLineBlocking = () => {
            const buf = Buffer.allocUnsafe(4096);
            let n;
            try {
                n = fs.readSync(0, buf, 0, 4096, null);
            } catch (e) {
                return null;
            }
            if (!n) return null;
            return buf.slice(0, n).toString('utf8').split('\n')[0].trim();
        };

        const attempt = () => {
            const id = readLineBlocking();

            if (id === null) {
                reject(new Error('stdin FD closed — cannot read session ID'));
                return;
            }

            if (!id) {
                process.stdout.write(red('[BOTIFY-X] Nothing entered. Try again.\n'));
                process.stdout.write('Paste Session ID → ');
                setImmediate(attempt);
                return;
            }

            if (!id.startsWith('BOTIFY-X=') && !id.startsWith('MEGA-')) {
                process.stdout.write(red('[BOTIFY-X] \u274c Invalid format. Must start with BOTIFY-X= or MEGA-\n'));
                process.stdout.write('Paste Session ID → ');
                setImmediate(attempt);
                return;
            }

            writeEnvKey('SESSION_ID', id);
            process.env.SESSION_ID = id;
            process.stdout.write(green('[BOTIFY-X] \u2705 Session ID saved.\n\n'));
            resolve(id);
        };

        // setImmediate lets any queued console output flush before we block
        setImmediate(attempt);
    });
}

// ── 3. Database migration ─────────────────────────────────────────────────────
function migrateDatabase(db) {
    const defaults = {
        mode: 'private', botname: 'BotifyX', ownername: 'Not Set!',
        watermark: '\u00a9BOTIFY X', packname: 'BOTIFY X', author: 'Mr Stark',
        timezone: 'Africa/Lagos', alwaysonline: true, anticall: false,
        antidelete: 'private', antibug: false, autoreact: false,
        autoread: false, autotype: false, autorecord: false,
        autoblock: false, autobio: false, chatbot: false,
        autoviewstatus: true, autoreactstatus: false, statusantidelete: true,
        fontstyle: false, menustyle: '2', menuimage: '', warnings: {}, warnLimit: 5,
    };
    let changed = false;
    for (const [k, v] of Object.entries(defaults)) {
        if (db.settings[k] === undefined) { db.settings[k] = v; changed = true; }
    }
    if (!Array.isArray(db.sudo))  { db.sudo  = []; changed = true; }
    if (!db.chats)                { db.chats  = {}; changed = true; }
    if (!Array.isArray(db.users)) { db.users  = []; changed = true; }
    return changed;
}

// ── 4. Clean old chatbot messages ─────────────────────────────────────────────
function cleanChatbotMessages(db) {
    if (!db.chatbotHistory) return 0;
    const cutoff = Date.now() - 86400000;
    let removed = 0;
    for (const jid of Object.keys(db.chatbotHistory)) {
        const before = (db.chatbotHistory[jid] || []).length;
        db.chatbotHistory[jid] = (db.chatbotHistory[jid] || []).filter(m => m.ts > cutoff);
        removed += before - db.chatbotHistory[jid].length;
    }
    return removed;
}

// ── 5. Clean old tmp messages ─────────────────────────────────────────────────
function cleanOldMessages(db) {
    if (!db.chats) return 0;
    let count = 0;
    const cutoff = Date.now() - 3600000;
    for (const jid of Object.keys(db.chats)) {
        const chat = db.chats[jid];
        if (Array.isArray(chat.messages)) {
            const before = chat.messages.length;
            chat.messages = chat.messages.filter(m => (m.ts || 0) > cutoff);
            count += before - chat.messages.length;
        }
    }
    return count;
}

// ── 6. Main ───────────────────────────────────────────────────────────────────
(async () => {
    console.log(cyan('[BOTIFY-X] Starting 1/3...'));
    console.log(yellow('[AUTH] Using better-sqlite3 as auth state'));

    const pgUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
    console.log(pgUrl
        ? cyan(`[BOTIFY-X] PostgreSQL URL: \u2705 ${pgUrl.split('@').pop()}`)
        : cyan('[BOTIFY-X] PostgreSQL URL: \u274cNot provided'));

    const PORT = process.env.PORT || 3000;
    console.log(cyan(`[BOTIFY-X] Running on port: ${PORT}`));

    require('./src/Core/developer');

    const { loadDatabase, saveDatabase, loadBlacklist } = require('./src/Core/database');
    const { downloadSessionData, createTmpFolder, detectPlatform } = require('./src/Core/bot');
    const { processMessage }          = require('./src/Core/executor');
    const { handleGroupParticipants } = require('./src/Core/group');
    const { cleanTmp }                = require('./src/Core/cleaner');
    const { sendConnectionMessage }   = require('./src/Core/connection');
    const { color }                   = require('./lib/color');

    const {
        default: makeWASocket,
        useMultiFileAuthState,
        makeCacheableSignalKeyStore,
        DisconnectReason,
        fetchLatestBaileysVersion,
        Browsers,
        jidNormalizedUser,
    } = require('@whiskeysockets/baileys');
    const { Boom } = require('@hapi/boom');

    const SESSION_DIR = path.join(__dirname, 'src', 'Session');
    const PLUGIN_DIR  = path.join(__dirname, 'src', 'Plugins');

    createTmpFolder();

    const db = loadDatabase();
    global.db = db;

    console.log(cyan('[BOTIFY-X] Connected to Chatbot Database.'));
    console.log(cyan('[BOTIFY-X] Connected to SQLite Database.'));
    console.log(cyan('[BOTIFY-X] Connected to Store Database.'));

    // ── Database migration + cleanup (moved before session prompt) ─────────────
    console.log(cyan('[BOTIFY-X] \uD83D\uDD27 Migrating old database schema...'));
    migrateDatabase(db);
    console.log(green('[BOTIFY-X] \u2705 Database migration complete'));

    cleanChatbotMessages(db);
    console.log(cyan('[BOTIFY-X] Cleaned up chatbot messages older than 1 days.'));

    const oldMsgCount = cleanOldMessages(db);
    console.log(cyan(`[BOTIFY-X] Cleaned up ${oldMsgCount} old messages`));

    const pluginFiles = fs.readdirSync(PLUGIN_DIR).filter(f => f.endsWith('.js'));
    const plugins = [];
    for (const file of pluginFiles) {
        try {
            const mod = require(path.join(PLUGIN_DIR, file));
            if (Array.isArray(mod)) {
                // Tag each command with a category derived from its source file so
                // `.menu` can group commands live, without any hardcoded list.
                const category = file.replace(/\.js$/i, '').toUpperCase();
                for (const cmdObj of mod) {
                    if (cmdObj && typeof cmdObj === 'object' && !cmdObj._category) {
                        cmdObj._category = category;
                    }
                }
                plugins.push(...mod);
            }
        } catch (e) {
            console.error(red(`[BOTIFY-X] Plugin load error (${file}): ${e.message}`));
        }
    }
    global.plugins = plugins;

    console.log(green(`[BOTIFY-X] Plugins loaded: ${pluginFiles.length} files`));
    console.log(green(`[BOTIFY-X] Commands loaded: ${plugins.length}`));

    console.log(cyan('[BOTIFY-X] Starting 2/3...'));
    console.log(cyan(`[BOTIFY-X] Platform : ${detectPlatform()}`));
    console.log(cyan(`[BOTIFY-X] Node.js  : ${process.version}`));

    // ── Session ID check — everything else (DB, plugins, commands) is fully ───
    // loaded by this point. This is intentionally the LAST step before we hand
    // off to the connection logic, so the console prompt only appears once the
    // bot is otherwise ready to go.
    if (!process.env.SESSION_ID) {
        if (canPromptInteractively()) {
            try {
                await promptForSessionId();
            } catch (e) {
                console.error(red(`[BOTIFY-X] \u274c Could not read Session ID: ${e.message}`));
                process.exit(1);
            }
        } else {
            console.error(red('[BOTIFY-X] \u274c SESSION_ID is not set.'));
            console.error(cyan('[BOTIFY-X] On Railway  \u2192 Variables tab \u2192 add  SESSION_ID = BOTIFY-X=...'));
            console.error(cyan('[BOTIFY-X] On Heroku   \u2192 Settings \u2192 Config Vars \u2192 add SESSION_ID'));
            console.error(cyan('[BOTIFY-X] On Render   \u2192 Environment \u2192 add SESSION_ID'));
            console.error(cyan('[BOTIFY-X] Then redeploy / restart.'));
            process.exit(1);
        }
    }

    // ── Listen for update results from the BotifyX bootstrap (parent process) ───
    // Lets the `.update` command give real feedback in WhatsApp instead of only
    // the console, since the bootstrap is the one that actually checks/applies.
    if (typeof process.send === 'function') {
        process.on('message', async (msg) => {
            if (!msg || msg.type !== 'updateResult') return;
            try {
                const target = global.creator;
                if (!target || !global.Cypher) return;
                if (!msg.ok) {
                    await global.Cypher.sendMessage(target, { text: `⚠️ Update check failed: ${msg.message || 'unknown error'}` });
                } else if (msg.updating) {
                    await global.Cypher.sendMessage(target, { text: `🔄 Update found (v${msg.latest}) — applying now. The bot will restart shortly.` });
                } else {
                    await global.Cypher.sendMessage(target, { text: `✅ Already up to date (v${msg.installed || msg.latest}).` });
                }
            } catch (_) {}
        });
    }

    let retryCount = 0;
    const MAX_RETRIES = 5;

    async function startBot() {
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        const { version }          = await fetchLatestBaileysVersion();

        console.log(cyan('[BOTIFY-X] Starting 3/3...'));
        console.log(cyan(`[BOTIFY-X] WA Web v${version.join('.')}`));

        const Cypher = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: {
                creds: state.creds,
                keys:  makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            browser:           Browsers.ubuntu('Edge'),
            printQRInTerminal: false,
            syncFullHistory:   false,
            getMessage: async () => ({ conversation: '' }),
        });

        global.Cypher = Cypher;

        // ── Track our own outgoing message IDs ──────────────────────────────────
        // Relying on WhatsApp message-ID length/prefix patterns to detect "this is
        // an echo of a message WE just sent" is unreliable — the mobile app now
        // generates IDs in the same format the library uses, which was silently
        // swallowing real messages typed by the owner (e.g. in groups). Instead,
        // record every ID we actually send through `sendMessage` and check
        // membership in heart.js. This is exact, not a guess.
        global.sentMsgIds = global.sentMsgIds || new Set();
        const _origSendMessage = Cypher.sendMessage.bind(Cypher);
        Cypher.sendMessage = async (...args) => {
            const result = await _origSendMessage(...args);
            try {
                const id = result?.key?.id;
                if (id) {
                    global.sentMsgIds.add(id);
                    if (global.sentMsgIds.size > 1000) {
                        global.sentMsgIds.delete(global.sentMsgIds.values().next().value);
                    }
                }
            } catch (_) {}
            return result;
        };

        Cypher.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                retryCount = 0;
                const botJid = Cypher.user?.id || '';
                const botNum = jidNormalizedUser(botJid);
                global.botNumber = botNum;

                const ownerRaw     = global.ownerNumber || botNum.split('@')[0];
                global.ownernumber = ownerRaw.replace(/[^0-9]/g, '');
                global.creator     = `${global.ownernumber}@s.whatsapp.net`;
                global.botname     = db.settings.botname   || 'BotifyX';
                global.wm          = db.settings.watermark || '\u00a9BOTIFY X';
                global.timezones   = db.settings.timezone  || 'Africa/Lagos';
                global.ownername   = db.settings.ownername || 'Mr Stark';

                console.log(green(`[BOTIFY-X] \u2705 Connected as ${Cypher.user?.name || botNum}`));
                console.log(cyan(`[BOTIFY-X] Owner     : ${global.creator}`));
                console.log(cyan(`[BOTIFY-X] Mode      : ${db.settings.mode || 'private'}`));

                cleanTmp();

                // ── Send a status message to "Message Yourself" on successful connect ─
                // See src/Core/connection.js for the message content/logic.
                sendConnectionMessage(Cypher, db, detectPlatform);
            }

            if (connection === 'close') {
                const reason    = new Boom(lastDisconnect?.error)?.output?.statusCode;
                const loggedOut = reason === DisconnectReason.loggedOut;

                console.log(red(`[BOTIFY-X] Disconnected \u2014 code ${reason}`));

                if (loggedOut) {
                    try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch (_) {}
                    writeEnvKey('SESSION_ID', '');
                    console.log(red('[BOTIFY-X] Session expired. Restart and paste a new Session ID.'));
                    process.exit(1);
                }

                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    const delay = Math.min(3000 * retryCount, 30000);
                    console.log(yellow(`[BOTIFY-X] Reconnecting in ${delay / 1000}s (attempt ${retryCount})\u2026`));
                    setTimeout(startBot, delay);
                } else {
                    console.log(red('[BOTIFY-X] Max reconnect attempts reached. Restarting process\u2026'));
                    process.exit(1);
                }
            }
        });

        Cypher.ev.on('creds.update', saveCreds);

        Cypher.ev.on('messages.upsert', async ({ messages, type }) => {
                        // RAW diagnostic — fires for every group message before the type filter
            for (const raw of messages) {
                if ((raw.key && raw.key.remoteJid || '').endsWith('@g.us')) {
                    console.log(cyan('[BOTIFY-X] RAW-GROUP type=' + type + ' fromMe=' + (raw.key && raw.key.fromMe) + ' id=' + ((raw.key && raw.key.id) || '').slice(-8)));
                }
            }
            if (type !== 'notify') return;
            for (const msg of messages) {
                try {
                    await processMessage(Cypher, msg, db, plugins, saveDatabase, loadBlacklist);
                } catch (e) {
                    console.error(red(`[BOTIFY-X] Message error: ${e.message}`));
                }
            }
        });

        Cypher.ev.on('messages.update', async (updates) => {
            for (const update of updates) {
                try {
                    const { key, update: upd } = update;
                    if (upd.messageStubType === 1 && db.settings.antidelete) {
                        const cached = global.msgCache?.get?.(key.id);
                        if (cached) {
                            const target = db.settings.antidelete === 'private' ? global.creator : key.remoteJid;
                            await Cypher.sendMessage(target, { forward: cached, force: true });
                        }
                    }
                } catch (_) {}
            }
        });

        Cypher.ev.on('call', async (calls) => {
            for (const call of calls) {
                if (!db.settings.anticall || call.status !== 'offer') continue;
                try {
                    await Cypher.rejectCall(call.id, call.from);
                    if (db.settings.anticall === 'block') {
                        await Cypher.updateBlockStatus(call.from, 'block');
                    }
                    const callType = call.isVideo ? 'video' : 'audio';
                    const rawMsg   = db.settings.anticallmsg || '';
                    const replyMsg = rawMsg
                        ? rawMsg.replace(/{user}/g, `@${call.from.split('@')[0]}`).replace(/{calltype}/g, callType)
                        : `\uD83D\uDEA8 *CALL DETECTED!*\n\n@${call.from.split('@')[0]}, my owner cannot receive ${callType} calls.\n\u26a0\ufe0f Your call was *declined*. Please message instead.`;
                    await Cypher.sendMessage(call.from, { text: replyMsg, mentions: [call.from] });
                } catch (_) {}
            }
        });

        Cypher.ev.on('group-participants.update', async (update) => {
            try { await handleGroupParticipants(Cypher, update, db); } catch (_) {}
        });

        Cypher.ev.on('contacts.update', async (contacts) => {
            if (!db.users) db.users = [];
            for (const c of contacts) {
                if (c.id && !db.users.includes(c.id)) db.users.push(c.id);
            }
        });

        if (db.settings.alwaysonline) {
            setInterval(() => Cypher.sendPresenceUpdate('available').catch(() => {}), 30000);
        }

        if (db.settings.autobio) {
            const { runtime } = require('./lib/myfunc');
            setInterval(async () => {
                try {
                    const uptime = runtime(process.uptime());
                    await Cypher.updateProfileStatus(`[BOTIFY-X] Uptime: ${uptime} | ${db.settings.mode}`);
                } catch (_) {}
            }, 60000);
        }
    }

    await downloadSessionData(startBot);
})();

