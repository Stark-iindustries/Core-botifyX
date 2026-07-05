'use strict';

const fs   = require('fs');
const path = require('path');
const { color } = require(path.join(__dirname, '../../lib/color'));

// dotenv is loaded by botify.js before this file is required.
// All user-specific values come from process.env (the .env file).

// ── SESSION ID ─────────────────────────────────────────────────────────────────
global.SESSION_ID = process.env.SESSION_ID || '';

// ── OWNER NUMBER ───────────────────────────────────────────────────────────────
global.ownerNumber = process.env.OWNER_NUMBER || '';

// ── OWNER LID ─────────────────────────────────────────────────────────────────
// Automatically discovered the first time the owner sends a group command
// after the bot connects.  Cached here so subsequent group messages skip the
// expensive groupMetadata scan and go straight to a numeric comparison.
global.ownerLID = (process.env.OWNER_LID || '').replace(/[^0-9]/g, '') || null;

// ── CUSTOM API URLS (optional — edit .env or leave blank) ─────────────────────
global.api    = process.env.CUSTOM_API_URL  || '';
global.falcon = process.env.FALCON_API_URL  || '';
global.pairingPortalUrl = process.env.PAIRING_PORTAL_URL || '';

// ── PUBLIC APIs (no changes needed) ──────────────────────────────────────────
global.siputzx = 'https://api.siputzx.my.id';
global.wwe     = 'https://www.wwe.com/api/news';
global.wwe1    = 'https://www.thesportsdb.com/api/v1/json/3/searchfilename.php?e=wwe';
global.wwe2    = 'https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=wrestling';

// ── HELPERS ────────────────────────────────────────────────────────────────────
let helpersList = [];
try {
    const helpersPath = path.join(__dirname, '../../config/helpers.json');
    if (fs.existsSync(helpersPath)) {
        const data = JSON.parse(fs.readFileSync(helpersPath, 'utf8'));
        helpersList = data.helpers || [];
    }
} catch (e) {
    console.error('[BOTIFY-X] Failed to load helpers.json:', e.message);
}
global.helpersList = helpersList;

// ── BOT RESPONSE MESSAGES ──────────────────────────────────────────────────────
global.mess = {
    done:     'Mission completed successfully.',
    success:  'Operation successful.',
    owner:    'This command is restricted to the owner and sudos only.',
    group:    'This command can only be used in group chats.',
    admin:    'Bot requires admin privileges to perform this action.',
    notadmin: 'Only group admins can use this command.',
    error:    'An error occurred. Please try again later.',
    wait:     'Processing your request. Please wait...',
    nolink:   'No valid link detected. Please provide a proper link.',
    notext:   'No input detected. Please provide the necessary text.',
    ban:      'You are currently banned from using the bot.',
    unban:    'You have been unbanned and can now use the bot.',
};

// ── HOT RELOAD ────────────────────────────────────────────────────────────────
let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(color('[BOTIFY-X] developer.js reloaded', 'yellow'));
    delete require.cache[file];
    require(file);
});
