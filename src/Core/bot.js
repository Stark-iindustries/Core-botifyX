'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { File } = require('megajs');
const { color } = require('../../lib/color');

const pkg = require('../../package.json');

const SESSION_DIR = path.join(__dirname, '..', '..', 'src', 'Session');

/**
 * checkForUpdates — Compare local version against GitHub latest release.
 * @returns {Promise<string>} Human-readable update message.
 */
async function checkForUpdates() {
    try {
        const url = `https://api.github.com/repos/${pkg.repository || 'YOUR_GITHUB_USERNAME/botify-x'}/releases/latest`;
        const response = await axios.get(url, { timeout: 8000 });
        const latest  = (response.data.tag_name || '').replace('v', '');
        const current = pkg.version;
        if (latest && latest !== current) {
            return `🆙 New update available: v${latest} (you have v${current}). Please update!`;
        }
        return `✅ BotifyX is up to date (v${current}).`;
    } catch (e) {
        return `⚠️ Failed to check for updates: ${e.message}`;
    }
}

/**
 * downloadSessionData — Extract session from SESSION_ID env var.
 * Supports MEGA-<id> and BOTIFY-X=<base64> formats.
 * @param {Function} callback - Called after session is ready.
 */
async function downloadSessionData(callback) {
    try {
        await fs.promises.mkdir(SESSION_DIR, { recursive: true });

        const sessionId = global.SESSION_ID || '';

        if (sessionId.includes('MEGA-')) {
            // MEGA download path
            const megaId = sessionId.split('MEGA-')[1];
            const file = File.fromURL('mega://' + megaId);
            file.download(async (err, data) => {
                if (err) throw err;
                try {
                    const zip = new AdmZip(data);
                    zip.extractAllTo(SESSION_DIR, true);
                    console.log(color('✅ Session downloaded from MEGA successfully!', 'green'));
                } catch (_) {
                    // Fallback: write raw data as creds.json
                    await fs.promises.writeFile(path.join(SESSION_DIR, 'creds.json'), data);
                    console.log(color('✅ Session (creds.json) saved from MEGA.', 'green'));
                }
                if (typeof callback === 'function') await callback();
            });
        } else if (sessionId.includes('BOTIFY-X=')) {
            // Base64-encoded zip
            let encoded = sessionId.split('BOTIFY-X=')[1];
            encoded = encoded.replace(/\*/g, '/');           // reverse URL-safe substitution
            const buffer = Buffer.from(encoded, 'base64');
            const zip = new AdmZip(buffer);
            zip.extractAllTo(SESSION_DIR, true);
            console.log(color('✅ Session loaded from BOTIFY-X base64 string.', 'green'));
            if (typeof callback === 'function') await callback();
        } else {
            // No session prefix — check if session files already exist locally
            const credsPath = path.join(SESSION_DIR, 'creds.json');
            if (fs.existsSync(credsPath)) {
                console.log(color('✅ Using existing local session.', 'green'));
                if (typeof callback === 'function') await callback();
            } else {
                console.error(color('❌ No valid SESSION_ID found. Set SESSION_ID=BOTIFY-X=<base64> in your environment.', 'red'));
                process.exit(1);
            }
        }
    } catch (err) {
        console.error(color('❌ Session error:', 'red'), err.message);
        process.exit(1);
    }
}

/**
 * createTmpFolder — Ensure the tmp directory exists.
 */
function createTmpFolder() {
    const tmpDir = path.join(__dirname, '..', '..', 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
}

/**
 * detectPlatform — Detect the deployment platform from env vars.
 * @returns {string} Platform name.
 */
function detectPlatform() {
    const env = process.env;
    if (env.DYNO)                                    return 'Heroku';
    if (env.RENDER)                                  return 'Render';
    if (env.RAILWAY_SERVICE_ID ||
        env.RAILWAY_STATIC_URL ||
        env.RAILWAY_ENVIRONMENT)                     return 'Railway';
    if (env.P_SERVER_UUID ||
        env.PTERODACTYL_UUID ||
        (env.HOSTNAME && env.HOSTNAME.startsWith('pterodactyl'))) return 'Pterodactyl Panel';
    if (env.TERMUX_VERSION ||
        (env.PREFIX && env.SHELL && env.SHELL.includes('com.termux'))) return 'Termux';
    if (env.KOYEB_APP_NAME)                          return 'Koyeb';
    if (env.FLY_APP_NAME)                            return 'Fly.io';
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
};
