const fs = require('fs');
const path = require('path');

const TMP_DIR = path.join(__dirname, '../../tmp');
const JUNK_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.mp3', '.mp4', '.opus', '.webm', '.ogg',
    '.pdf', '.zip', '.json', '.txt'
];

function ensureTmpDir() {
    if (!fs.existsSync(TMP_DIR)) {
        fs.mkdirSync(TMP_DIR, { recursive: true });
    }
}

function cleanTmp() {
    ensureTmpDir();
    try {
        const files = fs.readdirSync(TMP_DIR);
        let removed = 0;
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (JUNK_EXTENSIONS.includes(ext)) {
                try {
                    fs.unlinkSync(path.join(TMP_DIR, file));
                    removed++;
                } catch (e) {
                    // file in use or already deleted — skip
                }
            }
        }
        if (removed > 0) {
            console.log(`[BOTIFY-X] 🧹 Cleaned ${removed} temp file(s)`);
        }
    } catch (e) {
        console.error('[BOTIFY-X] Cleaner error:', e.message);
    }
}

function startCleaner(intervalMs = 10 * 60 * 1000) {
    ensureTmpDir();
    cleanTmp();
    setInterval(cleanTmp, intervalMs);
    console.log('[BOTIFY-X] 🧹 Temp cleaner started (every', intervalMs / 60000, 'min)');
}

module.exports = { cleanTmp, startCleaner, ensureTmpDir };
