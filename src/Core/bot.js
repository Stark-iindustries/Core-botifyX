'use strict';

const fs    = require('fs');
const os    = require('os');
const path  = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { File } = require('megajs');
const { color } = require('../../lib/color');

const ROOT        = path.join(__dirname, '..', '..');
const SESSION_DIR = path.join(ROOT, 'src', 'Session');
const ENV_FILE    = path.join(ROOT, '.env');

// ─── .env writer ──────────────────────────────────────────────────────────────
function writeEnvKey(key, value) {
    let lines = [];
    if (fs.existsSync(ENV_FILE)) {
        lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
    }
    const idx = lines.findIndex(l => l.startsWith(key + '='));
    const line = `${key}=${value}`;
    if (idx >= 0) {
        lines[idx] = line;
    } else {
        lines.push(line);
    }
    fs.writeFileSync(ENV_FILE, lines.join('\n'), 'utf8');
}

// ─── checkForUpdates ──────────────────────────────────────────────────────────
// Reads INSTALLED_VERSION from process.env (written by the BotifyX bootstrap
// after each successful download/update). Compares it against the latest
// GitHub release tag on the Stark-iindustries/BotifyX repo — exactly the same
// source the bootstrap uses, so the displayed version always matches reality.
async function checkForUpdates() {
    const BOTIFY_REPO = 'Stark-iindustries/BotifyX';
    try {
        const url      = `https://api.github.com/repos/${BOTIFY_REPO}/releases/latest`;
        const response = await axios.get(url, {
            timeout: 8000,
            headers: { 'User-Agent': 'BotifyX-Core', 'Accept': 'application/vnd.github+json' },
        });
        const latest    = (response.data.tag_name || '').replace(/^v/, '');
        const installed = (process.env.INSTALLED_VERSION || '').replace(/^v/, '');

        if (!latest) return '⚠️ Could not read latest release info from GitHub.';

        if (!installed) {
            return `ℹ️ No installed version on record yet. Latest release: *v${latest}*.\nSend *update* to apply it.`;
        }

        // Semver comparison (same logic as bootstrap isNewer)
        const parse = (s) => s.split('.').map(n => parseInt(n, 10) || 0);
        const a = parse(latest), b = parse(installed);
        let newer = false;
        for (let i = 0; i < 3; i++) {
            if (a[i] > b[i]) { newer = true; break; }
            if (a[i] < b[i]) break;
        }

        if (newer) {
            return `🆙 *New update available!*\n\n📦 Installed : v${installed}\n🚀 Latest    : v${latest}\n\nSend *update* to apply it now.`;
        }
        return `✅ BotifyX is *up to date* (v${installed}).`;
    } catch (e) {
        return `⚠️ Failed to check for updates: ${e.message}`;
    }
}

// ─── Extract owner number from creds.json ─────────────────────────────────────
function extractOwnerFromCreds() {
    try {
        const credsPath = path.join(SESSION_DIR, 'creds.json');
        if (!fs.existsSync(credsPath)) return;

        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        const jid   = creds?.me?.id || creds?.me?.jid || '';
        if (!jid) return;

        // JID format: 2348012345678:XX@s.whatsapp.net  or  2348012345678@s.whatsapp.net
        const number = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        if (!number) return;

        // Always record the session's own number separately so other
        // code can distinguish "bot account" from "owner's personal number".
        global.botOwnNumber = number;

        // OWNER_NUMBER is who commands the bot.  When the bot runs on a
        // SEPARATE WhatsApp account from the owner's personal phone the user
        // must set OWNER_NUMBER in .env to their personal number.
        // We must NOT overwrite that value on every restart, or the bot will
        // lock the owner out of group commands every time it restarts.
        const existingOwner = (process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
        if (existingOwner && existingOwner !== number) {
            // User has configured a personal owner number — respect it.
            global.ownerNumber = existingOwner;
            console.log(color(`[BOTIFY-X] Bot number   : ${number}`, 'cyan'));
            console.log(color(`[BOTIFY-X] Owner number : ${existingOwner} (custom — from .env)`, 'green'));
        } else {
            // Self-bot mode or first run — bot number IS the owner number.
            global.ownerNumber = number;
            writeEnvKey('OWNER_NUMBER', number);
            console.log(color(`[BOTIFY-X] Owner number detected: ${number}`, 'cyan'));
        }
    } catch (e) {
        console.warn(color(`[BOTIFY-X] Could not extract owner number from creds: ${e.message}`, 'yellow'));
    }
}

// ─── downloadSessionData ──────────────────────────────────────────────────────
async function downloadSessionData(callback) {
    try {
        await fs.promises.mkdir(SESSION_DIR, { recursive: true });

        const sessionId = global.SESSION_ID || '';

        if (sessionId.startsWith('BOTIFY-X=')) {
            let encoded = sessionId.slice('BOTIFY-X='.length).trim();
            encoded = encoded.replace(/\*/g, '/');

            const buffer = Buffer.from(encoded, 'base64');

            try {
                const zip = new AdmZip(buffer);
                zip.extractAllTo(SESSION_DIR, true);
                console.log(color('✅ Session extracted from BOTIFY-X base64.', 'green'));
            } catch (_) {
                fs.writeFileSync(path.join(SESSION_DIR, 'creds.json'), buffer);
                console.log(color('✅ Session (creds.json) saved from BOTIFY-X base64.', 'green'));
            }

            extractOwnerFromCreds();
            if (typeof callback === 'function') await callback();

        } else if (sessionId.startsWith('MEGA-')) {
            const megaId = sessionId.slice('MEGA-'.length).trim();
            const file   = File.fromURL('mega://' + megaId);
            file.download(async (err, data) => {
                if (err) {
                    console.error(color(`❌ MEGA download failed: ${err.message}`, 'red'));
                    process.exit(1);
                }
                try {
                    const zip = new AdmZip(data);
                    zip.extractAllTo(SESSION_DIR, true);
                    console.log(color('✅ Session extracted from MEGA.', 'green'));
                } catch (_) {
                    fs.writeFileSync(path.join(SESSION_DIR, 'creds.json'), data);
                    console.log(color('✅ Session (creds.json) saved from MEGA.', 'green'));
                }
                extractOwnerFromCreds();
                if (typeof callback === 'function') await callback();
            });

        } else {
            const credsPath = path.join(SESSION_DIR, 'creds.json');
            if (fs.existsSync(credsPath)) {
                console.log(color('✅ Using existing local session.', 'green'));
                extractOwnerFromCreds();
                if (typeof callback === 'function') await callback();
            } else {
                console.error(color('❌ No valid session found. Paste a valid BOTIFY-X= session ID when prompted.', 'red'));
                process.exit(1);
            }
        }
    } catch (err) {
        console.error(color('❌ Session error:', 'red'), err.message);
        process.exit(1);
    }
}

// ─── createTmpFolder ──────────────────────────────────────────────────────────
function createTmpFolder() {
    const tmpDir = path.join(ROOT, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
}

// ─── detectPlatform ───────────────────────────────────────────────────────────
function detectPlatform() {
    const env = process.env;
    if (env.RAILWAY_SERVICE_ID || env.RAILWAY_STATIC_URL || env.RAILWAY_ENVIRONMENT) return 'Railway';
    if (env.DYNO)           return 'Heroku';
    if (env.RENDER)         return 'Render';
    if (env.KOYEB_APP_NAME) return 'Koyeb';
    if (env.FLY_APP_NAME)   return 'Fly.io';
    if (env.P_SERVER_UUID || env.PTERODACTYL_UUID ||
        (env.HOSTNAME && env.HOSTNAME.startsWith('pterodactyl'))) return 'Pterodactyl';
    if (env.TERMUX_VERSION ||
        (env.PREFIX && env.SHELL && env.SHELL.includes('com.termux'))) return 'Termux';
    const platform = os.platform();
    if (platform === 'win32')  return 'Windows';
    if (platform === 'darwin') return 'macOS';
    return 'Linux';
}

module.exports = {
    checkForUpdates,
    downloadSessionData,
    createTmpFolder,
    detectPlatform,
    writeEnvKey,
};
