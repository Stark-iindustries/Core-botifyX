'use strict';

const path     = require('path');
const fs       = require('fs');
const readline = require('readline');
const pino     = require('pino');

// ── 1. Load .env first (before anything else reads process.env) ───────────────
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });

// ── .env writer (shared helper, duplicated here so it works before bot.js loads)
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
/**
 * Prompt the user on stdin for their Session ID.
 * Validates it starts with BOTIFY-X= or MEGA-.
 * Saves to .env on success so future restarts skip the prompt.
 */
function promptForSessionId() {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input:  process.stdin,
            output: process.stdout,
            terminal: false,
        });

        const ask = () => {
            process.stdout.write('\n[BOTIFY-X] No SESSION_ID found.\n');
            process.stdout.write('[BOTIFY-X] Go to your pairing portal, generate a Session ID, then paste it here.\n');
            process.stdout.write('[BOTIFY-X] Session ID format:  BOTIFY-X=<base64string>\n');
            process.stdout.write('\nPaste Session ID → ');

            rl.once('line', (input) => {
                const id = input.trim();

                if (!id) {
                    process.stdout.write('[BOTIFY-X] Nothing entered. Try again.\n\n');
                    return ask();
                }

                if (!id.startsWith('BOTIFY-X=') && !id.startsWith('MEGA-')) {
                    process.stdout.write('[BOTIFY-X] ❌ Invalid format. Must start with BOTIFY-X= or MEGA-\n\n');
                    return ask();
                }

                rl.close();

                // Save to .env so next restart skips this prompt
                writeEnvKey('SESSION_ID', id);
                process.env.SESSION_ID = id;

                process.stdout.write('[BOTIFY-X] ✅ Session ID saved to .env\n\n');
                resolve(id);
            });
        };

        rl.on('error', reject);
        ask();
    });
}

// ── 3. Banner ─────────────────────────────────────────────────────────────────
function banner() {
    const { color } = require('./lib/color');
    console.log(color('╔══════════════════════════════════╗', 'cyan'));
    console.log(color('║         B O T I F Y - X          ║', 'cyan'));
    console.log(color('║   WhatsApp Bot by Mr Stark        ║', 'cyan'));
    console.log(color('║   Telegram: t.me/botifyxspace     ║', 'cyan'));
    console.log(color('╚══════════════════════════════════╝', 'cyan'));
}

// ── 4. Main ───────────────────────────────────────────────────────────────────
(async () => {
    banner();

    // Ensure SESSION_ID is present — prompt if missing
    if (!process.env.SESSION_ID) {
        const isTTY = process.stdin.isTTY;
        if (isTTY) {
            // Local / Termux / Pterodactyl — interactive terminal, can prompt
            try {
                await promptForSessionId();
            } catch (e) {
                console.error('[BOTIFY-X] ❌ Could not read Session ID:', e.message);
                process.exit(1);
            }
        } else {
            // Cloud platform (Railway, Heroku, Render, Koyeb…) — no interactive terminal
            console.error('[BOTIFY-X] ❌ SESSION_ID is not set.');
            console.error('[BOTIFY-X] On Railway  → Variables tab → add  SESSION_ID = BOTIFY-X=...');
            console.error('[BOTIFY-X] On Heroku   → Settings → Config Vars → add SESSION_ID');
            console.error('[BOTIFY-X] On Render   → Environment → add SESSION_ID');
            console.error('[BOTIFY-X] On any platform → create a .env file in the core folder:');
            console.error('[BOTIFY-X]   SESSION_ID=BOTIFY-X=<your_session_string>');
            console.error('[BOTIFY-X] Then redeploy / restart.');
            process.exit(1);
        }
    }

    // Now safe to load globals (they read from process.env)
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

    let retryCount = 0;
    const MAX_RETRIES = 5;

    createTmpFolder();
    console.log(color(`[BOTIFY-X] Platform : ${detectPlatform()}`, 'cyan'));
    console.log(color(`[BOTIFY-X] Node.js  : ${process.version}`, 'cyan'));

    // ── Plugin loader ─────────────────────────────────────────────────────────
    function loadPlugins() {
        const plugins = [];
        const files   = fs.readdirSync(PLUGIN_DIR).filter(f => f.endsWith('.js'));
        for (const file of files) {
            try {
                const mod = require(path.join(PLUGIN_DIR, file));
                if (Array.isArray(mod)) plugins.push(...mod);
            } catch (e) {
                console.error(color(`[BOTIFY-X] Plugin load error (${file}): ${e.message}`, 'red'));
            }
        }
        return plugins;
    }

    // ── Bot connect ───────────────────────────────────────────────────────────
    async function startBot() {
        const db = loadDatabase();
        global.db = db;

        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        const { version }          = await fetchLatestBaileysVersion();
        console.log(color(`[BOTIFY-X] WA Web v${version.join('.')}`, 'cyan'));

        const Cypher = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: {
                creds: state.creds,
                keys:  makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            browser:          Browsers.ubuntu('Chrome'),
            printQRInTerminal: false,
            syncFullHistory:   false,
            getMessage: async () => ({ conversation: '' }),
        });

        global.Cypher = Cypher;

        const plugins = loadPlugins();
        global.plugins = plugins;
        console.log(color(`[BOTIFY-X] ${plugins.length} commands loaded`, 'green'));

        // connection.update ───────────────────────────────────────────────────
        Cypher.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                retryCount = 0;
                const botJid = Cypher.user?.id || '';
                const botNum = jidNormalizedUser(botJid);
                global.botNumber = botNum;

                // Owner number: prefer value extracted from creds by bot.js,
                // then fall back to the connected account's own JID.
                const ownerRaw = global.ownerNumber || botNum.split('@')[0];
                global.ownernumber = ownerRaw.replace(/[^0-9]/g, '');
                global.creator     = `${global.ownernumber}@s.whatsapp.net`;
                global.botname     = db.settings.botname   || 'BotifyX';
                global.wm          = db.settings.watermark || '©BOTIFY X';
                global.timezones   = db.settings.timezone  || 'Africa/Lagos';
                global.ownername   = db.settings.ownername || 'Mr Stark';

                console.log(color(`[BOTIFY-X] Connected as ${Cypher.user?.name || botNum}`, 'green'));
                console.log(color(`[BOTIFY-X] Owner     : ${global.creator}`, 'cyan'));
                console.log(color(`[BOTIFY-X] Mode      : ${db.settings.mode || 'private'}`, 'cyan'));

                checkForUpdates()
                    .then(msg => console.log(color(`[BOTIFY-X] ${msg}`, 'yellow')))
                    .catch(() => {});

                cleanTmp();
            }

            if (connection === 'close') {
                const reason    = new Boom(lastDisconnect?.error)?.output?.statusCode;
                const loggedOut = reason === DisconnectReason.loggedOut;

                console.log(color(`[BOTIFY-X] Disconnected — code ${reason}`, 'red'));

                if (loggedOut) {
                    // Clear the saved session so user is prompted again on next start
                    try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch (_) {}
                    // Remove SESSION_ID from .env
                    writeEnvKey('SESSION_ID', '');
                    console.log(color('[BOTIFY-X] Session expired. Restart the bot and paste a new Session ID.', 'red'));
                    process.exit(1);
                }

                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    const delay = Math.min(3000 * retryCount, 30000);
                    console.log(color(`[BOTIFY-X] Reconnecting in ${delay / 1000}s (attempt ${retryCount})…`, 'yellow'));
                    setTimeout(startBot, delay);
                } else {
                    console.log(color('[BOTIFY-X] Max reconnect attempts reached. Restarting process…', 'red'));
                    process.exit(1);
                }
            }
        });

        // creds.update ────────────────────────────────────────────────────────
        Cypher.ev.on('creds.update', saveCreds);

        // messages.upsert ─────────────────────────────────────────────────────
        Cypher.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            for (const msg of messages) {
                try {
                    await processMessage(Cypher, msg, db, plugins, saveDatabase, loadBlacklist);
                } catch (e) {
                    console.error(color(`[BOTIFY-X] Message error: ${e.message}`, 'red'));
                }
            }
        });

        // messages.update (antidelete / antiedit) ─────────────────────────────
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

        // call ────────────────────────────────────────────────────────────────
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

        // group-participants.update ───────────────────────────────────────────
        Cypher.ev.on('group-participants.update', async (update) => {
            try {
                await handleGroupParticipants(Cypher, update, db);
            } catch (_) {}
        });

        // contacts.update ─────────────────────────────────────────────────────
        Cypher.ev.on('contacts.update', async (contacts) => {
            if (!db.users) db.users = [];
            for (const c of contacts) {
                if (c.id && !db.users.includes(c.id)) db.users.push(c.id);
            }
        });

        // Intervals ───────────────────────────────────────────────────────────
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

    // ── Download session then start ───────────────────────────────────────────
    await downloadSessionData(startBot);
})();
