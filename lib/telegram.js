'use strict';

/**
 * lib/telegram.js
 * Telegram sticker-pack downloader for the telesticker command.
 *
 * Requires TELEGRAM_TOKEN in .env.
 * Get a free bot token in 30 seconds:
 *   1. Open Telegram → search @BotFather
 *   2. Send /newbot, pick any name and username
 *   3. Copy the token and add to .env:  TELEGRAM_TOKEN=<token>
 */

const axios = require('axios');

/**
 * Fetches every sticker in a Telegram sticker pack as a list of direct HTTPS URLs.
 * @param {string} packUrl  e.g. https://t.me/addstickers/PackName
 * @returns {Promise<Array<{ url: string }>>}
 */
async function Telesticker(packUrl) {
    const token = process.env.TELEGRAM_TOKEN;
    if (!token) {
        throw new Error(
            'TELEGRAM_TOKEN not set in .env.\n' +
            'Get a free bot token: open Telegram → @BotFather → /newbot\n' +
            'Then add  TELEGRAM_TOKEN=<your_token>  to your .env file and restart.'
        );
    }

    // Extract pack name from URL
    const packName = packUrl.match(/t\.me\/addstickers\/([^\s/?#]+)/i)?.[1];
    if (!packName) throw new Error('Invalid Telegram sticker pack URL');

    const BASE = `https://api.telegram.org/bot${token}`;

    // 1 ─ Get the sticker set metadata
    const setRes = await axios.get(
        `${BASE}/getStickerSet?name=${encodeURIComponent(packName)}`,
        { timeout: 12000 }
    );
    if (!setRes.data.ok) {
        throw new Error(setRes.data.description || 'Failed to get sticker set from Telegram');
    }

    const stickers = setRes.data.result.stickers || [];

    // 2 ─ Resolve each file_id → direct CDN URL
    const results = [];
    for (const sticker of stickers) {
        try {
            const fileRes = await axios.get(
                `${BASE}/getFile?file_id=${sticker.file_id}`,
                { timeout: 8000 }
            );
            if (fileRes.data.ok && fileRes.data.result?.file_path) {
                results.push({
                    url: `https://api.telegram.org/file/bot${token}/${fileRes.data.result.file_path}`
                });
            }
        } catch (_) {
            // skip individual stickers that fail — don't abort the whole pack
        }
    }

    return results;
}

module.exports = { Telesticker };
