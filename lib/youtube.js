'use strict';

/**
 * lib/youtube.js
 * YouTube download helpers used by the download plugin.
 * Uses Cobalt (api.cobalt.tools) — free, no API key required.
 */

const axios = require('axios');
const yts   = require('yt-search');

// ── internal ──────────────────────────────────────────────────────────────────

function extractVideoId(url) {
    const m = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/))([a-zA-Z0-9_-]{11})/
    );
    return m ? m[1] : null;
}

async function cobaltFetch(url, mode, quality) {
    const res = await axios.post(
        'https://api.cobalt.tools/',
        {
            url,
            downloadMode: mode,
            videoQuality:  quality || '720',
            audioFormat:  'mp3',
        },
        {
            headers: {
                Accept:         'application/json',
                'Content-Type': 'application/json',
            },
            timeout: 25000,
        }
    );

    const d = res.data;
    if (d.status === 'error') {
        throw new Error(d.error?.code || 'Cobalt returned an error');
    }

    // status: "tunnel" | "redirect" → single url
    // status: "picker"              → array of streams
    return d.url || d.picker?.[0]?.url || null;
}

// ── exports ───────────────────────────────────────────────────────────────────

/**
 * Returns a direct MP3 download URL for the given YouTube URL.
 * @param {string} youtubeUrl
 * @returns {Promise<string>}
 */
async function fetchMp3DownloadUrl(youtubeUrl) {
    const dlUrl = await cobaltFetch(youtubeUrl, 'audio', null);
    if (!dlUrl) throw new Error('Could not retrieve audio download URL');
    return dlUrl;
}

/**
 * Returns video info + download URL in the shape the video/ytmp4 command expects.
 * Shape: { BK9: { title, duration, formats: [{ quality, has_video, has_audio, extension, url, size }] } }
 * @param {string} youtubeUrl
 * @returns {Promise<object>}
 */
async function fetchVideoDownloadUrl(youtubeUrl) {
    const videoId = extractVideoId(youtubeUrl);

    // Metadata — best-effort, never crash the main flow
    let title    = 'Unknown Title';
    let duration = 'Unknown';
    try {
        if (videoId) {
            const info = await yts({ videoId });
            title    = info.title               || title;
            duration = info.duration?.timestamp || duration;
        }
    } catch (_) {}

    // Download URL from Cobalt at 720p
    const dlUrl = await cobaltFetch(youtubeUrl, 'auto', '720');
    if (!dlUrl) throw new Error('Could not retrieve video download URL');

    return {
        BK9: {
            title,
            duration,
            formats: [
                {
                    quality:   '720p',
                    has_video: true,
                    has_audio: true,
                    extension: 'mp4',
                    url:       dlUrl,
                    size:      'Unknown',
                },
            ],
        },
    };
}

module.exports = { fetchMp3DownloadUrl, fetchVideoDownloadUrl };
