const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../src/Database/database.json');

const defaultDB = {
    settings: {
        prefix: '.',
        mode: 'private',
        botname: 'BotifyX',
        ownername: 'Not Set!',
        ownernumber: '',
        watermark: '©BOTIFY X',
        packname: 'BOTIFY X',
        author: 'Mr Stark',
        timezone: 'Africa/Lagos',
        alwaysonline: true,
        anticall: false,
        anticallmsg: '',
        antidelete: 'private',
        antiedit: 'private',
        antibug: false,
        autoreact: false,
        autoread: false,
        autotype: false,
        autorecord: false,
        autorecordtype: false,
        autoblock: false,
        autobio: false,
        chatbot: false,
        autoviewstatus: true,
        autoreactstatus: false,
        statusantidelete: true,
        fontstyle: false,
        menustyle: '2',
        menuimage: '',
        contextlink: 'YOUR_SOCIAL_LINK_HERE',
        statusemoji: '🧡,💚,🔥,✨,❤️,🥰,😎',
        allowedCodes: [],
        stickerAliases: {},
        warnings: {},
        warnLimit: 5,
    },
    sudo: [],
    chats: {},
    users: [],
};

function loadDatabase() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
            fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2));
            return JSON.parse(JSON.stringify(defaultDB));
        }
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        const parsed = JSON.parse(raw);

        // Merge in any missing default settings keys
        parsed.settings = Object.assign({}, defaultDB.settings, parsed.settings);
        if (!Array.isArray(parsed.sudo))  parsed.sudo  = [];
        if (!parsed.chats)                parsed.chats = {};
        if (!Array.isArray(parsed.users)) parsed.users = [];
        return parsed;
    } catch (e) {
        console.error('[BOTIFY-X] Failed to load database, using defaults:', e.message);
        return JSON.parse(JSON.stringify(defaultDB));
    }
}

function saveDatabase() {
    try {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        fs.writeFileSync(DB_PATH, JSON.stringify(global.db, null, 2));
    } catch (e) {
        console.error('[BOTIFY-X] Failed to save database:', e.message);
    }
}

function loadBlacklist() {
    const blacklistPath = path.join(__dirname, '../../src/Database/blacklist.json');
    try {
        if (!fs.existsSync(blacklistPath)) {
            const empty = { blacklisted_numbers: [] };
            fs.writeFileSync(blacklistPath, JSON.stringify(empty, null, 2));
            return empty;
        }
        return JSON.parse(fs.readFileSync(blacklistPath, 'utf8'));
    } catch (e) {
        return { blacklisted_numbers: [] };
    }
}

function saveBlacklist(data) {
    const blacklistPath = path.join(__dirname, '../../src/Database/blacklist.json');
    try {
        fs.writeFileSync(blacklistPath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[BOTIFY-X] Failed to save blacklist:', e.message);
    }
}

function initChatEntry(jid) {
    if (!global.db.chats[jid]) {
        global.db.chats[jid] = {
            antilink: false,
            antibot: false,
            antibadword: false,
            antitag: false,
            antiforeign: false,
            welcome: false,
            welcomeMsg: '',
            goodbye: false,
            goodbyeMsg: '',
            warnings: {},
            warnLimit: 5,
            mute: false,
        };
    }
    return global.db.chats[jid];
}

module.exports = {
    loadDatabase,
    saveDatabase,
    loadBlacklist,
    saveBlacklist,
    initChatEntry,
    defaultDB,
};
