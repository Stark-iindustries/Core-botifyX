'use strict';

const path     = require('path');
const fs       = require('fs');
const readline = require('readline');
const pino     = require('pino');

// ── 1. Load .env first ────────────────────────────────────────────────────────
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });

// ── Colour helpers (no chalk dependency at this point) ────────────────────────
const cyan   = (t) => `\x1b[36m${t}\x1b[0m`;
const green  = (t) => `\x1b[32m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const red    = (t) => `\x1b[31m${t}\x1b[0m`;
const bold   = (t) => `\x1b[1m${t}\x1b[0m`;

// ── .env writer ───────────────────────────────────────────────────────────────
function writeEnvKey(key, value) {
    let lines = [];
    if (fs.existsSync(ENV_FILE)) {
        lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
    }
    const idx  = lines.findIndex(l => l.startsWith(key + '='));
    const line = `${key}=${value}`;
    if (idx >= 0) lines[idx] = line;
    else lines.push(line);
    fs.writeFileSync(ENV_FILE, lines.join('\n'), 'utf8');
}

// ── 2. Session ID prompt ──────────────────────────────────────────────────────
function promptForSessionId() {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input:  process.stdin,
            output: process.stdout,
            terminal: false,
        });

        const ask = () => {
            process.stdout.write(red('\nPlease wait for a few seconds to enter your session id!\n'));
            process.stdout.write(cyan('[BOTIFY-X] Session ID format: BOTIFY-X=<base64string>\n'));
            process.stdout.write('\nPaste Session ID → ');

            rl.once('line', (input) => {
                const id = input.trim();
                if (!id) {
                    process.stdout.write(red('[BOTIFY-X] Nothing entered. Try again.\n\n'));
                    return ask();
                }
                if (!id.startsWith('BOTIFY-X=') && !id.startsWith('MEGA-')) {
                    process.stdout.write(red('[BOTIFY-X] ❌ Invalid format. Must start with BOTIFY-X= or MEGA-\n\n'));
                    return ask();
                }
                rl.close();
                writeEnvKey('SESSION_ID', id);
                process.env.SESSION_ID = id;
                process.stdout.write(green('[BOTIFY-X] ✅ Session ID saved.\n\n'));
                resolve(id);
            });
        };

        rl.on('error', reject);
        ask();
    });
}

// ── 3. Database migration ─────────────────────────────────────────────────────
function migrateDatabase(db) {
    let changed = false;
    const defaults = {
        mode: 'private', botname: 'BotifyX', ownername: 'Not Set!',
        watermark: '©BOTIFY X', packname: 'BOTIFY X', author: 'Mr Stark',
        timezone: 'Africa/Lagos', alwaysonline: true, anticall: false,
        antidelete: 'private', antibug: false, autoreact: false,
        autoread: false, autotype: false, autorecord: false,
        autoblock: false, autobio: false, chatbot: false,
        autoviewstatus: true, autoreactstatus: false, statusantidelete: true,
        fontstyle: false, menustyle: '2', menuimage: '', warnings: {}, warnLimit: 5,
    };
    for (const [k, v] of Object.entries(defaults)) {
        if (db.settings[k] === undefined) { db.settings[k] = v; changed = true; }
    }
    if (!Array.isArray(db.sudo))  { db.sudo  = []; changed = true; }
    if (!db.chats)                { db.chats  = {}; changed = true; }
    if (!Array.isArray(db.users)) { db.users  = []; changed = true; }
    return changed;
}

// ── 4. Clean old chatbot messages (older than 1 day) ─────────────────────────
function cleanChatbotMessages(db) {
    if (!db.chatbotHistory) return 0;
    const cutoff = Date.now() - 86400000;
    let removed  = 0;
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

    // Auth state info
    console.log(yellow('[AUTH] Using better-sqlite3 as auth state'));

    // PostgreSQL
    const pgUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
    if (pgUrl) {
        console.log(cyan(`[BOTIFY-X] PostgreSQL URL: ✅ ${pgUrl.split('@').pop()}`));
    } else {
        console.log(cyan('[BOTIFY-X] PostgreSQL URL: ❌Not provided'));
    }

    // Port
    const PORT = process.env.PORT || 3000;
    console.log(cyan(`[BOTIFY-X] Running on port: ${PORT}`));

    // Load globals / developer config
    require('./src/Core/developer');

    const { loadDatabase, saveDatabase, loadBlacklist } = require('./src/Core/database');
    const { checkForUpdates, downloadSessionData, createTmpFolder, detectPlatform } = require('./src/Core/bot');
    const { processMessage }          = require('./src/Core/executor');
    const { handleGroupParticipants } = require('./src/Core/group');
    const { cleanTmp }                = require('./src/Core/cleaner');
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

    // ── Load database ──────────────────────────────────────────────────────────
    const db = loadDatabase();
    global.db = db;

    console.log(cyan('[BOTIFY-X] Connected to Chatbot Database.'));
    console.log(cyan('[BOTIFY-X] Connected to SQLite Database.'));
    console.log(cyan('[BOTIFY-X] Connected to Store Database.'));

    // Clean old messages
    const oldMsgCount = cleanOldMessages(db);
    console.log(cyan(`[BOTIFY-X] Cleaned up ${oldMsgCount} old messages`));

    // ── Load plugins ───────────────────────────────────────────────────────────
    const pluginFiles = fs.readdirSync(PLUGIN_DIR).filter(f => f.endsWith('.js'));
    const plugins = [];
    for (const file of pluginFiles) {
        try {
            const mod = require(path.join(PLUGIN_DIR, file));
            if (Array.isArray(mod)) plugins.push(...mod);
        } catch (e) {
            console.error(red(`[BOTIFY-X] Plugin load error (${file}): ${e.message}`));
        }
    }
    global.plugins = plugins;

    console.log(green(`[BOTIFY-X] Plugins loaded: ${pluginFiles.length} files`));
    console.log(green(`[BOTIFY-X] Commands loaded: ${plugins.length}`));

    // ── Session ID check ───────────────────────────────────────────────────────
    if (!process.env.SESSION_ID) {
        const isTTY = process.stdin.isTTY;
        if (isTTY) {
            try {
                await promptForSessionId();
            } catch (e) {
                console.error(red(`[BOTIFY-X] ❌ Could not read Session ID: ${e.message}`));
                process.exit(1);
            }
        } else {
            console.error(red('[BOTIFY-X] ❌ SESSION_ID is not set.'));
            console.error(cyan('[BOTIFY-X] On Railway  → Variables tab → add  SESSION_ID = BOTIFY-X=...'));
            console.error(cyan('[BOTIFY-X] On Heroku   → Settings → Config Vars → add SESSION_ID'));
            console.error(cyan('[BOTIFY-X] On Render   → Environment → add SESSION_ID'));
            console.error(cyan('[BOTIFY-X] Then redeploy / restart.'));
            process.exit(1);
        }
    }

    // ── Database migration ─────────────────────────────────────────────────────
    console.log(cyan('[BOTIFY-X] 🔧 Migrating old database schema...'));
    migrateDatabase(db);
    console.log(green('[BOTIFY-X] ✅Database migration complete'));

    // Clean chatbot messages older than 1 day
    const cbCleaned = cleanChatbotMessages(db);
    console.log(cyan(`[BOTIFY-X] Cleaned up chatbot messages older than 1 days.`));

    console.log(cyan('[BOTIFY-X] Starting 2/3...'));
    console.log(cyan(`[BOTIFY-X] Platform : ${detectPlatform()}`));
    console.log(cyan(`[BOTIFY-X] Node.js  : ${process.version}`));

    let retryCount = 0;
    const MAX_RETRIES = 5;

    // ── Bot connect ────────────────────────────────────────────────────────────
    async function startBot() {
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        const { version }          = await fetchLatestBaileysVersion();

        console.log(cyan(`[BOTIFY-X] Starting 3/3...`));
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

        // connection.update ────────────────────────────────────────────────────
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
                global.wm          = db.settings.watermark || '©BOTIFY X';
                global.timezones   = db.settings.timezone  || 'Africa/Lagos';
                global.ownername   = db.settings.ownername || 'Mr Stark';

                console.log(green(`[BOTIFY-X] ✅ Connected as ${Cypher.user?.name || botNum}`));
                console.log(cyan(`[BOTIFY-X] Owner     : ${global.creator}`));
                console.log(cyan(`[BOTIFY-X] Mode      : ${db.settings.mode || 'private'}`));

                checkForUpdates()
                    .then(msg => console.log(yellow(`[BOTIFY-X] ${msg}`)))
                    .catch(() => {});

                cleanTmp();
            }

            if (connection === 'close') {
                const reason    = new Boom(lastDisconnect?.error)?.output?.statusCode;
                const loggedOut = reason === DisconnectReason.loggedOut;

                console.log(red(`[BOTIFY-X] Disconnected — code ${reason}`));

                if (loggedOut) {
                    try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch (_) {}
                    writeEnvKey('SESSION_ID', '');
                    console.log(red('[BOTIFY-X] Session expired. Restart the bot and paste a new Session ID.'));
                    process.exit(1);
                }

                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    const delay = Math.min(3000 * retryCount, 30000);
                    console.log(yellow(`[BOTIFY-X] Reconnecting in ${delay / 1000}s (attempt ${retryCount})…`));
                    setTimeout(startBot, delay);
                } else {
                    console.log(red('[BOTIFY-X] Max reconnect attempts reached. Restarting process…'));
                    process.exit(1);
                }
            }
        });

        // creds.update ─────────────────────────────────────────────────────────
        Cypher.ev.on('creds.update', saveCreds);

        // messages.upsert ──────────────────────────────────────────────────────
        Cypher.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            for (const msg of messages) {
                try {
                    await processMessage(Cypher, msg, db, plugins, saveDatabase, loadBlacklist);
                } catch (e) {
                    console.error(red(`[BOTIFY-X] Message error: ${e.message}`));
                }
            }
        });

        // messages.update ──────────────────────────────────────────────────────
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

        // call ─────────────────────────────────────────────────────────────────
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
                        : `🚨 *CALL DETECTED!*\n\n@${call.from.split('@')[0]}, my owner cannot receive ${callType} calls.\n⚠️ Your call was *declined*. Please message instead.`;
                    await Cypher.sendMessage(call.from, { text: replyMsg, mentions: [call.from] });
                } catch (_) {}
            }
        });

        // group-participants.update ────────────────────────────────────────────
        Cypher.ev.on('group-participants.update', async (update) => {
            try {
                await handleGroupParticipants(Cypher, update, db);
            } catch (_) {}
        });

        // contacts.update ──────────────────────────────────────────────────────
        Cypher.ev.on('contacts.update', async (contacts) => {
            if (!db.users) db.users = [];
            for (const c of contacts) {
                if (c.id && !db.users.includes(c.id)) db.users.push(c.id);
            }
        });

        // Intervals ────────────────────────────────────────────────────────────
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

    // ── Download session then start ────────────────────────────────────────────
    await downloadSessionData(startBot);
})();
