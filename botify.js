'use strict';

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const path = require('path');
const fs   = require('fs');
const pino = require('pino');

// Load globals (api, siputzx, mess, SESSION_ID, …)
require('./src/Core/developer');

// ─── Local modules ────────────────────────────────────────────────────────────
const { loadDatabase, saveDatabase, loadBlacklist } = require('./src/Core/database');
const { checkForUpdates, downloadSessionData, createTmpFolder, detectPlatform } = require('./src/Core/bot');
const { processMessage } = require('./src/Core/executor');
const { handleGroupParticipants } = require('./src/Core/group');
const { cleanTmp } = require('./src/Core/cleaner');
const { color } = require('./lib/color');

// ─── Baileys ──────────────────────────────────────────────────────────────────
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

// ─── Constants ────────────────────────────────────────────────────────────────
const SESSION_DIR  = path.join(__dirname, 'src', 'Session');
const PLUGIN_DIR   = path.join(__dirname, 'src', 'Plugins');

let retryCount = 0;
const MAX_RETRIES = 5;

// ─── Plugin loader ────────────────────────────────────────────────────────────
function loadPlugins() {
    const plugins = [];
    const files = fs.readdirSync(PLUGIN_DIR).filter(f => f.endsWith('.js'));
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

// ─── Main connect ─────────────────────────────────────────────────────────────
async function startBot() {
    const db = loadDatabase();
    global.db = db;

    // Auth state from session directory (populated by downloadSessionData)
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    const { version } = await fetchLatestBaileysVersion();
    console.log(color(`[BOTIFY-X] WA Web v${version.join('.')}`, 'cyan'));

    const Cypher = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false,
        syncFullHistory: false,
        getMessage: async () => ({ conversation: '' }),
    });

    global.Cypher = Cypher;

    const plugins = loadPlugins();
    global.plugins = plugins;
    console.log(color(`[BOTIFY-X] ${plugins.length} commands loaded`, 'green'));

    // ── connection.update ──────────────────────────────────────────────────────
    Cypher.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            retryCount = 0;
            const botJid = Cypher.user?.id || '';
            const botNumber = jidNormalizedUser(botJid);
            global.botNumber = botNumber;

            // Resolve owner
            global.ownernumber = db.settings.ownernumber || botNumber.split('@')[0];
            global.creator     = `${global.ownernumber}@s.whatsapp.net`;
            global.botname     = db.settings.botname     || 'BotifyX';
            global.wm          = db.settings.watermark   || '©BOTIFY X';
            global.timezones   = db.settings.timezone    || 'Africa/Lagos';
            global.ownername   = db.settings.ownername   || 'Mr Stark';

            console.log(color(`[BOTIFY-X] Connected as ${Cypher.user?.name || botNumber}`, 'green'));
            console.log(color(`[BOTIFY-X] Platform: ${detectPlatform()}`, 'cyan'));
            console.log(color(`[BOTIFY-X] Mode: ${db.settings.mode || 'private'}`, 'cyan'));

            checkForUpdates()
                .then(msg => console.log(color(`[BOTIFY-X] ${msg}`, 'yellow')))
                .catch(() => {});

            cleanTmp();
        }

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const loggedOut = reason === DisconnectReason.loggedOut;

            console.log(color(`[BOTIFY-X] Disconnected — code ${reason}`, 'red'));

            if (!loggedOut && retryCount < MAX_RETRIES) {
                retryCount++;
                const delay = Math.min(3000 * retryCount, 30000);
                console.log(color(`[BOTIFY-X] Reconnecting in ${delay / 1000}s (attempt ${retryCount})…`, 'yellow'));
                setTimeout(startBot, delay);
            } else {
                console.log(color('[BOTIFY-X] Session ended. Set a new SESSION_ID and restart.', 'red'));
                process.exit(1);
            }
        }
    });

    // ── creds.update ──────────────────────────────────────────────────────────
    Cypher.ev.on('creds.update', saveCreds);

    // ── messages.upsert ───────────────────────────────────────────────────────
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

    // ── messages.update (antidelete / antiedit) ────────────────────────────────
    Cypher.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            try {
                const { key, update: upd } = update;
                // Antidelete
                if (upd.messageStubType === 1 && db.settings.antidelete) {
                    const cached = global.msgCache?.get?.(key.id);
                    if (cached && db.settings.antidelete !== false) {
                        const target = db.settings.antidelete === 'private' ? global.creator : key.remoteJid;
                        await Cypher.sendMessage(target, { forward: cached, force: true });
                    }
                }
            } catch (_) {}
        }
    });

    // ── call ──────────────────────────────────────────────────────────────────
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

    // ── group-participants.update ─────────────────────────────────────────────
    Cypher.ev.on('group-participants.update', async (update) => {
        try {
            await handleGroupParticipants(Cypher, update, db);
        } catch (_) {}
    });

    // ── contacts.update (track for status broadcast) ──────────────────────────
    Cypher.ev.on('contacts.update', async (contacts) => {
        if (!db.users) db.users = [];
        for (const c of contacts) {
            if (c.id && !db.users.includes(c.id)) db.users.push(c.id);
        }
    });

    // ── Intervals ─────────────────────────────────────────────────────────────
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

// ─── Entry point ──────────────────────────────────────────────────────────────
(async () => {
    console.log(color('╔══════════════════════════════════╗', 'cyan'));
    console.log(color('║         B O T I F Y - X          ║', 'cyan'));
    console.log(color('║   WhatsApp Bot by Mr Stark        ║', 'cyan'));
    console.log(color('║   Telegram: t.me/botifyxspace     ║', 'cyan'));
    console.log(color('╚══════════════════════════════════╝', 'cyan'));

    // Create tmp folder
    createTmpFolder();

    // Validate session
    if (!global.SESSION_ID) {
        console.error(color('[BOTIFY-X] SESSION_ID not set. Add SESSION_ID=BOTIFY-X=<base64> to your environment.', 'red'));
        process.exit(1);
    }

    // Download session, then connect
    await downloadSessionData(startBot);
})();
