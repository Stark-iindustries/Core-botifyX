const fs = require('fs');
const path = require('path');
const { color } = require(path.join(__dirname, '../../lib/color'));

if (fs.existsSync(path.join(__dirname, '../../.env'))) {
    require('dotenv').config({ path: path.join(__dirname, '../../.env') });
}

// TODO: Replace with your own API server URL (or leave empty if you don't have one)
// File: src/Core/developer.js — Line below
global.api = process.env.API_URL || "";

global.siputzx = "https://api.siputzx.my.id";

global.wwe  = "https://www.wwe.com/api/news";
global.wwe1 = "https://www.thesportsdb.com/api/v1/json/3/searchfilename.php?e=wwe";
global.wwe2 = "https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=wrestling";

// TODO: Replace with your own secondary API URL if needed
global.falcon = process.env.FALCON_URL || "";

// Load helpers from config file
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

global.SESSION_ID = process.env.SESSION_ID || '';

let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(color(`Updated '${__filename}'`, 'red'));
    delete require.cache[file];
    require(file);
});
