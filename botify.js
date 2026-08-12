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

// ── Rolling console log buffer (feeds the dashboard's Console tab) ────────────
// Wraps console.log/warn/error so terminal output is unchanged, but every line
// also lands in a capped in-memory buffer the dashboard can poll/tail.
const BOOT_TIME = Date.now();
const LOG_CAP = 2000;
const logBuffer = [];
let logSeq = 0;
function pushLog(text) {
    logSeq += 1;
    logBuffer.push({ id: logSeq, text: String(text) });
    if (logBuffer.length > LOG_CAP) logBuffer.splice(0, logBuffer.length - LOG_CAP);
}
function stripAnsi(s) { return s.replace(/\x1b\[[0-9;]*m/g, ''); }

// Local IPv4s — used to print a usable dashboard link on hosts (Termux,
// Pterodactyl/Katabump panels, local dev) that don't hand out a public URL.
function getLocalIPs() {
    try {
        const os = require('os');
        const nets = os.networkInterfaces();
        const ips = [];
        for (const ifaceList of Object.values(nets)) {
            for (const iface of ifaceList || []) {
                if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
            }
        }
        return ips;
    } catch (_) {
        return [];
    }
}
['log', 'warn', 'error'].forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args) => {
        original(...args);
        try {
            const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
            pushLog(stripAnsi(line));
        } catch (_) {}
    };
});

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
                process.stdout.write(red('[BOTIFY-X] ❌ Invalid format. Must start with BOTIFY-X= or MEGA-\n'));
                process.stdout.write('Paste Session ID → ');
                setImmediate(attempt);
                return;
            }

            writeEnvKey('SESSION_ID', id);
            process.env.SESSION_ID = id;
            process.stdout.write(green('[BOTIFY-X] ✅ Session ID saved.\n\n'));
            resolve(id);
        };

        setImmediate(attempt);
    });
}

// ── 3. Database migration ─────────────────────────────────────────────────────
function migrateDatabase(db) {
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
        ? cyan(`[BOTIFY-X] PostgreSQL URL: ✅ ${pgUrl.split('@').pop()}`)
        : cyan('[BOTIFY-X] PostgreSQL URL: ❌Not provided'));

    const PORT = process.env.PORT || 3000;
    console.log(cyan(`[BOTIFY-X] Running on port: ${PORT}`));

    require('./src/Core/developer');

    const { loadDatabase, saveDatabase, loadBlacklist } = require('./src/Core/database');
    const { downloadSessionData, createTmpFolder, detectPlatform } = require('./src/Core/bot');
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

    const db = loadDatabase();
    global.db = db;

    console.log(cyan('[BOTIFY-X] Connected to Chatbot Database.'));
    console.log(cyan('[BOTIFY-X] Connected to SQLite Database.'));
    console.log(cyan('[BOTIFY-X] Connected to Store Database.'));

    console.log(cyan('[BOTIFY-X] 🔧 Migrating old database schema...'));
    migrateDatabase(db);
    console.log(green('[BOTIFY-X] ✅ Database migration complete'));

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

    // ── Auto-detect session ID from any env var containing the BOTIFY-X= format ──
    // Some platforms (e.g. CypherX) inject the value under a different variable
    // name — scan all env vars so the bot works regardless of what name is used.
    if (!process.env.SESSION_ID) {
        const found = Object.entries(process.env).find(([, v]) => v && v.startsWith('BOTIFY-X='));
        if (found) {
            process.env.SESSION_ID = found[1];
            console.log(require('./lib/color').cyan('[BOTIFY-X] ✅ Session ID auto-detected from env var: ' + found[0]));
        }
    }

    // SESSION_ID (BOTIFY-X=... / MEGA-...) is now optional legacy support only.
    // If present, downloadSessionData() above will still restore it. If absent
    // and there's no local session on disk either, startBot() below will bring
    // up the web pairing dashboard instead of prompting on the console.

    // ── Listen for update results from the BotifyX bootstrap (parent process) ───
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

    // ── Dashboard state that must survive across reconnects ──────────────────────
    // startBot() runs again on every reconnect, so anything the dashboard reads
    // needs to live outside it and just get updated by each call, rather than be
    // recreated (recreating the dashboard would try to rebind the same port).
    let dashboardHandle   = null;
    let connectionState   = 'connecting'; // connecting | connected | awaiting pairing | disconnected
    let isRegisteredFlag  = false;
    const pkg = require('./package.json');

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
            markOnlineOnConnect: true,
            msgRetryCounterCache: new Map(),
            getMessage: async (key) => {
                const cached = global.msgCache?.get(key?.id);
                return cached?.message || { conversation: '' };
            },
        });

        global.Cypher = Cypher;
        isRegisteredFlag = !!state.creds.registered;
        connectionState = isRegisteredFlag ? 'connecting' : 'awaiting pairing';

        // ── Web dashboard (Home / Console / Settings) ────────────────────────────
        // Created once and kept alive across reconnects (startBot() re-runs on
        // every reconnect — recreating the server here would try to rebind the
        // same port and crash). Gated behind a random PAIR_TOKEN persisted to
        // .env: before pairing, whoever holds the link becomes the bot's owner;
        // after pairing, the same link exposes Console/Settings control.
        if (!dashboardHandle) {
            const { startDashboard, generateToken } = require('./src/Core/dashboard');

            let pairToken = process.env.PAIR_TOKEN;
            if (!pairToken) {
                pairToken = generateToken();
                writeEnvKey('PAIR_TOKEN', pairToken);
                process.env.PAIR_TOKEN = pairToken;
            }

            const isHeroku = !!process.env.DYNO;
            // On Heroku the bootstrap process already owns the externally
            // reachable PORT (bound immediately to satisfy the 60s boot
            // timeout) — so Core listens on an internal-only port here and
            // tells the bootstrap (over the existing IPC channel) to proxy
            // traffic to it. On every other platform Core owns the assigned
            // port directly. Pterodactyl/Katabump-style panels hand out the
            // allocated port via SERVER_PORT (not the generic PORT var most
            // PaaS platforms use) — check that first or we'd bind 3000 while
            // the panel actually routes traffic to a different port.
            const dashboardPort = isHeroku
                ? parseInt(process.env.CORE_INTERNAL_PORT || '4021', 10)
                : parseInt(process.env.SERVER_PORT || process.env.PORT || '3000', 10);

            const publicUrl =
                (process.env.SERVER_IP && process.env.SERVER_PORT) ? `http://${process.env.SERVER_IP}:${process.env.SERVER_PORT}` :
                process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` :
                process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL :
                process.env.KOYEB_PUBLIC_DOMAIN  ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}` :
                process.env.FLY_APP_NAME         ? `https://${process.env.FLY_APP_NAME}.fly.dev` :
                null;

            const dashboardUrlForDisplay = `${publicUrl || 'http://<your-deployed-host>'}/?token=${pairToken}`;

            try {
                dashboardHandle = await startDashboard({
                    port: dashboardPort,
                    token: pairToken,
                    ctx: {
                        requestPairingCode: (number) => global.Cypher.requestPairingCode(number),

                        getStatus: () => ({
                            registered:  isRegisteredFlag,
                            online:      connectionState === 'connected',
                            connection:  connectionState,
                            uptimeSeconds: process.uptime(),
                            platform:    detectPlatform(),
                            botNumber:   (global.Cypher?.user?.id || '').split(':')[0].split('@')[0] || global.ownerNumber || '',
                            port:        dashboardPort,
                            dashboardUrl: publicUrl ? `${publicUrl}/?token=${pairToken}` : null,
                            prefix:      db.settings.prefix ?? '.',
                            botname:     db.settings.botname || 'BotifyX',
                            version:     pkg.version || '0.0.0',
                            commands:    Array.isArray(global.plugins) ? global.plugins.length : 0,
                            developer:   pkg.author || 'Unknown',
                        }),

                        getLogs: (since) => ({
                            lines: logBuffer.filter((l) => l.id > since).map((l) => l.text),
                            nextCursor: logSeq,
                        }),

                        controlProcess: (action) => {
                            if (action === 'start') return 'Bot is already running.';
                            if (action === 'restart') {
                                setTimeout(() => {
                                    if (typeof process.send === 'function') {
                                        process.send({ type: 'restartRequested' });
                                    } else {
                                        process.exit(1);
                                    }
                                }, 300);
                                return 'Restart requested — the bot will be back shortly.';
                            }
                            if (action === 'stop') {
                                setTimeout(() => process.exit(0), 300);
                                return 'Stopping the bot.';
                            }
                        },

                        getSettings: () => ({ ...db.settings }),

                        updateSettings: (patch) => {
                            for (const key of Object.keys(patch)) {
                                if (Object.prototype.hasOwnProperty.call(db.settings, key)) {
                                    db.settings[key] = patch[key];
                                }
                            }
                            saveDatabase();
                            return { ...db.settings };
                        },
                    },
                });

                if (isHeroku && typeof process.send === 'function') {
                    process.send({ type: 'dashboardReady', port: dashboardPort });
                }

                console.log('');
                console.log(green('[BOTIFY-X] 🌐 Dashboard:'));
                console.log(green(`[BOTIFY-X]    ${dashboardUrlForDisplay}`));
                if (!publicUrl) {
                    console.log(cyan(`[BOTIFY-X]    http://localhost:${dashboardPort}/?token=${pairToken}`));
                    for (const ip of getLocalIPs()) {
                        console.log(cyan(`[BOTIFY-X]    http://${ip}:${dashboardPort}/?token=${pairToken}`));
                    }
                    console.log(cyan('[BOTIFY-X]    (no public URL detected for this platform — use one of the links above,'));
                    console.log(cyan('[BOTIFY-X]     or your panel/host\'s own address, with the ?token=... appended)'));
                }
                console.log('');
            } catch (e) {
                console.error(red(`[BOTIFY-X] ❌ Failed to start dashboard: ${e.message}`));
            }
        }

        // ── Custom Cypher methods ─────────────────────────────────────────────────
        // The Dark-Xploit fork does not ship these helpers; we add them once here
        // so every plugin that calls Cypher.sendFile / downloadMediaMessage / etc. works.
        {
            const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
            const { imageToWebp, videoToWebp, addExif } = require('./lib/exif');
            const nodeFetch = require('node-fetch');
            const FileType  = require('file-type');

            // heart.js hands us the raw media content object (imageMessage /
            // videoMessage / audioMessage / documentMessage / stickerMessage) —
            // NOT a full WAMessage — so we must use downloadContentFromMessage,
            // which downloads by content + a type string, and stream it into a buffer.
            const _mediaTypeOf = (content) => {
                const mime = content?.mimetype || '';
                if (content?.mtype === 'stickerMessage' || /webp/.test(mime)) return 'sticker';
                if (/^image\//.test(mime))  return 'image';
                if (/^video\//.test(mime))  return 'video';
                if (/^audio\//.test(mime))  return 'audio';
                return 'document';
            };
            const _streamToBuffer = async (stream) => {
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                return Buffer.concat(chunks);
            };

            // A1 — downloadMediaMessage as a socket method (heart.js wires m.download / m.quoted.download via this)
            Cypher.downloadMediaMessage = async (content) => {
                const stream = await downloadContentFromMessage(content, _mediaTypeOf(content));
                return _streamToBuffer(stream);
            };

            // A2 — download media + write to tmp file, returns the file path (used by ffmpeg commands)
            Cypher.downloadAndSaveMediaMessage = async (content, filename) => {
                const buffer = await Cypher.downloadMediaMessage(content);
                const ext    = (content.mimetype || '').split('/')[1]
                                   ?.split(';')[0]?.split('+')[0] || 'bin';
                const tmpDir = path.join(__dirname, 'tmp');
                if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
                const fp = path.join(tmpDir, filename || ('media_' + Date.now() + '.' + ext));
                fs.writeFileSync(fp, buffer);
                return fp;
            };

            // A3 — send buffer / path / URL as a document message
            Cypher.sendFile = async (jid, content, filename, caption, quoted, opts = {}) => {
                let buffer;
                if (Buffer.isBuffer(content)) {
                    buffer = content;
                } else if (typeof content === 'string' && /^https?:\/\//.test(content)) {
                    buffer = await nodeFetch(content).then(r => r.buffer());
                } else if (typeof content === 'string') {
                    buffer = fs.readFileSync(content);
                } else {
                    buffer = Buffer.from(content);
                }
                const ft   = await FileType.fromBuffer(buffer).catch(() => null);
                const mime = ft?.mime || 'application/octet-stream';
                return Cypher.sendMessage(jid, {
                    document: buffer,
                    fileName: filename || 'file',
                    caption:  caption  || '',
                    mimetype: mime,
                }, { quoted: quoted || null, ...opts });
            };

            // A4 — plain-text sender (heart.js m.reply uses this for text)
            Cypher.sendText = (jid, text, quoted, opts = {}) =>
                Cypher.sendMessage(jid, { text: String(text) }, { quoted: quoted || null, ...opts });

            // A5 — image (buffer / URL / path) → WhatsApp sticker
            Cypher.sendImageAsSticker = async (jid, content, quoted, opts = {}) => {
                let buffer;
                if (Buffer.isBuffer(content)) {
                    buffer = content;
                } else if (typeof content === 'string' && /^https?:\/\//.test(content)) {
                    buffer = await nodeFetch(content).then(r => r.buffer());
                } else {
                    buffer = fs.readFileSync(content);
                }
                const webpBuf    = await imageToWebp(buffer);
                const stickerBuf = await addExif(
                    webpBuf,
                    opts.packname || global.packname || '',
                    opts.author   || global.author   || ''
                );
                return Cypher.sendMessage(jid, { sticker: stickerBuf }, { quoted: quoted || null });
            };

            // A6 — video (buffer / URL / path) → animated WhatsApp sticker
            Cypher.sendVideoAsSticker = async (jid, content, quoted, opts = {}) => {
                let buffer;
                if (Buffer.isBuffer(content)) {
                    buffer = content;
                } else if (typeof content === 'string' && /^https?:\/\//.test(content)) {
                    buffer = await nodeFetch(content).then(r => r.buffer());
                } else {
                    buffer = fs.readFileSync(content);
                }
                const webpBuf    = await videoToWebp(buffer);
                const stickerBuf = await addExif(
                    webpBuf,
                    opts.packname || global.packname || '',
                    opts.author   || global.author   || ''
                );
                return Cypher.sendMessage(jid, { sticker: stickerBuf }, { quoted: quoted || null });
            };

            // A7 — display name for a JID (no full contacts store → fall back to number)
            Cypher.getName = async (jid) => {
                const num = jid.split('@')[0].replace(/[^0-9]/g, '');
                if (global.ownerNumber && num === global.ownerNumber.replace(/[^0-9]/g, ''))
                    return global.ownername || num;
                return global.db?.chats?.[jid]?.name || num;
            };

            // A8 — forward / copy a message to another chat
            Cypher.copyNForward = async (jid, message, forceForward = false, opts = {}) => {
                const fwd = forceForward
                    ? { ...message, key: { ...message.key, fromMe: false } }
                    : message;
                return Cypher.sendMessage(jid, { forward: fwd, force: true }, opts);
            };
        }


        // ── Track our own outgoing message IDs ──────────────────────────────────
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
                connectionState = 'connected';
                isRegisteredFlag = true;

                const botJid = Cypher.user?.id || '';
                const botNum = jidNormalizedUser(botJid);
                global.botNumber = botNum;

                // ── Owner: auto-detect from session (Option C) ───────────────
                // Whoever completed the WhatsApp pairing OWNS this instance.
                // On first boot OWNER_NUMBER won't be in .env yet — we read it
                // straight from the session credential and persist it so every
                // subsequent restart skips this step entirely.
                const botNumOnly = botNum.split('@')[0].replace(/[^0-9]/g, '');
                if (!process.env.OWNER_NUMBER || !process.env.OWNER_NUMBER.trim()) {
                    writeEnvKey('OWNER_NUMBER', botNumOnly);
                    process.env.OWNER_NUMBER = botNumOnly;
                    console.log(green(`[BOTIFY-X] ✅ Owner auto-detected from session: ${botNumOnly}`));
                }
                const ownerNum     = (process.env.OWNER_NUMBER || botNumOnly).replace(/[^0-9]/g, '');
                global.ownerNumber = ownerNum;
                global.ownernumber = ownerNum;
                global.creator     = `${ownerNum}@s.whatsapp.net`;
                global.botname     = db.settings.botname   || 'BotifyX';
                global.wm          = db.settings.watermark || '©BOTIFY X';
                global.timezones   = db.settings.timezone  || 'Africa/Lagos';
                global.ownername   = db.settings.ownername || 'Mr Stark';

                // Claim window is retired — session detection handles first boot.
                global.pendingOwnerClaim = false;
                if (global.ownerClaimTimer) {
                    clearTimeout(global.ownerClaimTimer);
                    global.ownerClaimTimer = null;
                }

                // ── Capture LID (Member-Privacy groups) ──────────────────────
                // Groups with Member Privacy send the sender JID as a LID instead
                // of a phone number. We store both bot and owner LID here where
                // state.creds is in scope so executor.js can match them later.
                try {
                    const rawLid = state.creds.me?.lid || Cypher.user?.lid || '';
                    const numLid = rawLid.split(':')[0].replace(/[^0-9]/g, '');
                    if (numLid) {
                        global.botLID   = numLid;
                        global.ownerLID = numLid; // owner = this session
                        console.log(cyan(`[BOTIFY-X] 🔑 LID captured: ${numLid}`));
                    }
                } catch (_) {}

                console.log(green(`[BOTIFY-X] ✅ Connected as ${Cypher.user?.name || botNum}`));
                console.log(cyan(`[BOTIFY-X] Owner     : ${global.creator}`));
                console.log(cyan(`[BOTIFY-X] Mode      : ${db.settings.mode || 'private'}`));

                cleanTmp();

                // ── Connection message ──────────────────────────────────────────────
                // WhatsApp routes self-messages via LID JID (@lid), not @s.whatsapp.net.
                // Fall back to phone JID only if no LID was captured.
                const _rawId    = Cypher.user?.id || '';
                const _phoneNum = _rawId.split(':')[0].replace(/[^0-9]/g, '');
                const _sendJid  = global.botLID
                    ? global.botLID + '@lid'
                    : (_phoneNum ? _phoneNum + '@s.whatsapp.net' : null);
                if (_sendJid) {
                    let _botVersion = 'unknown';
                    try { _botVersion = require('./package.json').version || 'unknown'; } catch (_) {}
                    const _statusMsg =
                        `——『 BOTIFY-X 』——
` +
                        `» Username: ${Cypher.user?.name || global.ownernumber || ''}
` +
                        `» Platform: ${detectPlatform()}
` +
                        `» Prefix: [ ${db.settings.prefix ?? '.'} ]
` +
                        `» Mode: ${db.settings.mode || 'private'}
` +
                        `» Version: [ ${_botVersion} ]
` +
                        `» https://t.me/+yxIy3nwj6Ig4YjM0
` +
                        `» https://t.me/botifyxspace`;
                    setTimeout(() => {
                        Cypher.sendMessage(_sendJid, { text: _statusMsg })
                            .catch(err => console.error('[BOTIFY-X] connection msg failed:', err?.message || err));
                    }, 3000);
                }
            }

            if (connection === 'close') {
                const reason    = new Boom(lastDisconnect?.error)?.output?.statusCode;
                const loggedOut = reason === DisconnectReason.loggedOut;

                connectionState = 'disconnected';
                console.log(red(`[BOTIFY-X] Disconnected — code ${reason}`));

                if (loggedOut) {
                    if (dashboardHandle) dashboardHandle.close();
                    try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch (_) {}
                    writeEnvKey('SESSION_ID', '');
                    writeEnvKey('PAIR_TOKEN', ''); // fresh token next boot
                    console.log(red('[BOTIFY-X] Session expired. Restart to re-pair via the web dashboard.'));
                    process.exit(1);
                }

                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    const delay = Math.min(3000 * retryCount, 30000);
                    connectionState = 'connecting';
                    console.log(yellow(`[BOTIFY-X] Reconnecting in ${delay / 1000}s (attempt ${retryCount})…`));
                    setTimeout(startBot, delay);
                } else {
                    console.log(red('[BOTIFY-X] Max reconnect attempts reached. Restarting process…'));
                    process.exit(1);
                }
            }
        });

        Cypher.ev.on('creds.update', saveCreds);

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
                        : `🚨 *CALL DETECTED!*\n\n@${call.from.split('@')[0]}, my owner cannot receive ${callType} calls.\n⚠️ Your call was *declined*. Please message instead.`;
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
