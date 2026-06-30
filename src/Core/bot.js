'use strict';

const fs    = require('fs');
const os    = require('os');
const path  = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { File } = require('megajs');
const { color } = require('../../lib/color');

const pkg = require('../../package.json');

const ROOT        = path.join(__dirname, '..', '..');
const SESSION_DIR = path.join(ROOT, 'src', 'Session');
const ENV_FILE    = path.join(ROOT, '.env');

// ── GITHUB REPO FOR UPDATE CHECKS ─────────────────────────────────────────────
// Set GITHUB_REPO in your .env file:  GITHUB_REPO=username/reponame
// Or leave unset — update checks will be skipped gracefully.
const GITHUB_REPO = process.env.GITHUB_REPO || '';

// ─── .env writer ──────────────────────────────────────────────────────────────
/**
 * Write / update a key=value pair in the .env file.
 * Preserves all other existing lines.
 */
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
async function checkForUpdates() {
    if (!GITHUB_REPO) {
        return 'ℹ️  GITHUB_REPO not set in .env — update checks skipped.';
    }
    try {
        const url      = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
        const response = await axios.get(url, { timeout: 8000 });
        const latest   = (response.data.tag_name || '').replace(/^v/, '');
        const current  = pkg.version;
        if (latest && latest !== current) {
            return `🆙 New update available: v${latest} (you have v${current}). Update your bot!`;
        }
        return `✅ BotifyX is up to date (v${current}).`;
    } catch (e) {
        return `⚠️ Failed to check for updates: ${e.message}`;
    }
}

// ─── Extract owner number from creds.json ─────────────────────────────────────
/**
 * After extracting session files, read creds.json → me.id to get the
 * WhatsApp phone number. Saves OWNER_NUMBER to .env and sets global.ownerNumber.
 */
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

        global.ownerNumber = number;
        writeEnvKey('OWNER_NUMBER', number);
        console.log(color(`[BOTIFY-X] Owner number detected: ${number}`, 'cyan'));
    } catch (e) {
        console.warn(color(`[BOTIFY-X] Could not extract owner number from creds: ${e.message}`, 'yellow'));
    }
}

// ─── downloadSessionData ──────────────────────────────────────────────────────
/**
 * Decode the SESSION_ID set in global.SESSION_ID and extract session files.
 * Supported formats:
 *   BOTIFY-X=<base64>   — ZIP of WA auth state encoded as base64
 *   MEGA-<megaId>       — MEGA file containing the session zip or creds.json
 */
async function downloadSessionData(callback) {
    try {
        await fs.promises.mkdir(SESSION_DIR, { recursive: true });

        const sessionId = global.SESSION_ID || '';

        if (sessionId.startsWith('BOTIFY-X=')) {
            // ── BOTIFY-X base64 format ───────────────────────────────────────
            let encoded = sessionId.slice('BOTIFY-X='.length).trim();
            // GitHub / URL safe base64 may use * instead of /
            encoded = encoded.replace(/\*/g, '/');

            const buffer = Buffer.from(encoded, 'base64');

            try {
                const zip = new AdmZip(buffer);
                zip.extractAllTo(SESSION_DIR, true);
                console.log(color('✅ Session extracted from BOTIFY-X base64.', 'green'));
            } catch (_) {
                // If it's not a zip, treat as raw creds.json
                fs.writeFileSync(path.join(SESSION_DIR, 'creds.json'), buffer);
                console.log(color('✅ Session (creds.json) saved from BOTIFY-X base64.', 'green'));
            }

            extractOwnerFromCreds();
            if (typeof callback === 'function') await callback();

        } else if (sessionId.startsWith('MEGA-')) {
            // ── MEGA format ──────────────────────────────────────────────────
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
            // ── Existing local session ───────────────────────────────────────
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
    GITHUB_REPO,
};
