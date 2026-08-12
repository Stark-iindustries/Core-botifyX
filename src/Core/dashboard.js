'use strict';

const express = require('express');
const crypto  = require('crypto');

/**
 * BotifyX web dashboard (v1): Home / Console / Settings.
 *
 * Serves a single-page app. Everything is gated behind `token` — a random
 * secret generated on first boot and persisted to .env — because before a
 * session exists, completing pairing here makes you the bot's owner, and
 * after that, Settings/Console expose real control over the bot.
 *
 * All state is read live via the `ctx` getters passed in, so the same
 * server instance can be created once and stay up across reconnects,
 * pairing -> connected transitions, etc. Callers just keep ctx's
 * getters returning fresh values.
 */
function startDashboard({ port, token, ctx }) {
    return new Promise((resolve, reject) => {
        const app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        const checkToken = (req, res, next) => {
            const supplied = req.query.token || req.body.token || req.headers['x-pair-token'];
            if (supplied !== token) return res.status(404).json({ error: 'not found' });
            next();
        };

        // -- Page shell -----------------------------------------------------------
        app.get('/', checkToken, (req, res) => {
            res.type('html').send(renderShell({ token }));
        });

        // -- Pairing ----------------------------------------------------------------
        app.post('/api/pair', checkToken, async (req, res) => {
            const number = String(req.body.number || '').replace(/[^0-9]/g, '');
            if (!number || number.length < 8) {
                return res.status(400).json({ error: 'Enter a valid phone number with country code, digits only.' });
            }
            try {
                const code = await ctx.requestPairingCode(number);
                res.json({ code });
            } catch (e) {
                res.status(500).json({ error: e.message || 'Failed to generate pairing code.' });
            }
        });

        // -- Live status (Home tab + pairing-screen polling) ------------------------
        app.get('/api/status', checkToken, (req, res) => {
            res.json(ctx.getStatus());
        });

        // -- Console log tail --------------------------------------------------------
        app.get('/api/console', checkToken, (req, res) => {
            const since = parseInt(req.query.since, 10) || 0;
            const { lines, nextCursor } = ctx.getLogs(since);
            res.json({ lines, nextCursor });
        });

        app.post('/api/console/action', checkToken, (req, res) => {
            const action = req.body.action;
            if (!['start', 'stop', 'restart'].includes(action)) {
                return res.status(400).json({ error: 'Unknown action.' });
            }
            try {
                const result = ctx.controlProcess(action);
                res.json({ ok: true, message: result || (action + ' requested.') });
            } catch (e) {
                res.status(500).json({ error: e.message || 'Action failed.' });
            }
        });

        // -- Settings -----------------------------------------------------------------
        app.get('/api/settings', checkToken, (req, res) => {
            res.json(ctx.getSettings());
        });

        app.post('/api/settings', checkToken, (req, res) => {
            try {
                const saved = ctx.updateSettings(req.body || {});
                res.json({ ok: true, settings: saved });
            } catch (e) {
                res.status(500).json({ error: e.message || 'Failed to save settings.' });
            }
        });

        const server = app.listen(port, () => {
            resolve({ close: () => server.close() });
        });
        server.on('error', reject);
    });
}

function generateToken() {
    return crypto.randomBytes(9).toString('base64url');
}

// -- Single-page app shell (pairing screen + tabbed dashboard) -------------------
function renderShell({ token }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BotifyX Dashboard</title>
<style>
  :root {
    --bg:#0b0f19; --card:#141a26; --border:#232b3d; --text:#e7ebf3; --muted:#8b96ad;
    --accent:#6d6cf0; --green:#22c55e; --amber:#f59e0b; --red:#ef4444;
  }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
         background:var(--bg); color:var(--text); min-height:100vh; }
  .topbar { display:flex; align-items:center; gap:4px; padding:14px 12px; border-bottom:1px solid var(--border);
            position:sticky; top:0; background:var(--bg); z-index:5; }
  .brand { font-weight:700; font-size:15px; margin-right:8px; white-space:nowrap; }
  .tabs { display:flex; gap:4px; overflow-x:auto; flex:1; scrollbar-width:none; }
  .tabs::-webkit-scrollbar { display:none; }
  .tab { padding:8px 12px; border-radius:8px; color:var(--muted); font-size:14px; white-space:nowrap;
         cursor:pointer; border:none; background:transparent; font-weight:600; }
  .tab.active { color:var(--text); background:var(--card); }
  .theme-dot { width:34px; height:34px; border-radius:9px; background:var(--card); border:1px solid var(--border);
               display:flex; align-items:center; justify-content:center; margin-left:4px; flex-shrink:0; }
  .wrap { max-width:520px; margin:0 auto; padding:16px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:16px; margin-bottom:12px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .stat-label { font-size:11px; letter-spacing:.06em; color:var(--muted); text-transform:uppercase; margin-bottom:6px; }
  .stat-value { font-size:19px; font-weight:700; }
  .ok { color:var(--green); } .warn { color:var(--amber); } .bad { color:var(--red); }
  .section-title { font-size:11px; letter-spacing:.08em; color:var(--muted); text-transform:uppercase; margin:18px 4px 8px; }
  .row { display:flex; justify-content:space-between; align-items:center; padding:12px 4px; border-bottom:1px solid var(--border); font-size:14px; gap:12px; }
  .row:last-child { border-bottom:none; }
  .row .k { color:var(--muted); } .row .v { font-weight:600; text-align:right; word-break:break-all; }
  .row .v a { color:var(--accent); }
  input, select { width:100%; padding:10px 12px; border-radius:8px; border:1px solid var(--border);
                  background:var(--bg); color:var(--text); font-size:14px; }
  label.field { display:block; padding:10px 4px; }
  label.field .lbl { font-weight:600; font-size:14px; }
  label.field .sub { font-size:12px; color:var(--muted); margin-bottom:6px; }
  button.primary { width:100%; padding:12px; border-radius:8px; border:none; background:var(--accent);
                   color:#fff; font-weight:700; font-size:15px; cursor:pointer; }
  button.primary:disabled { opacity:.6; }
  .btnrow { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px; margin-top:10px; }
  .btnrow button { padding:11px 4px; border-radius:8px; border:none; font-weight:700; font-size:13px; cursor:pointer; }
  .btn-stop { background:#3a1414; color:#fca5a5; } .btn-start { background:#0f2e1c; color:#86efac; }
  .btn-restart { background:#3a2a0a; color:#fcd34d; } .btn-copy { background:#1b2232; color:#c7d2fe; }
  .console { background:#05070c; border:1px solid var(--border); border-radius:10px; padding:12px;
             font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12px; line-height:1.6;
             height:52vh; overflow-y:auto; white-space:pre-wrap; word-break:break-word; }
  .console .l-error { color:#f87171; } .console .l-warn { color:#fbbf24; }
  .console .l-ok { color:#4ade80; } .console .l-info { color:#93c5fd; }
  .toggle-row { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--muted); margin-bottom:10px; }
  .code { font-size:26px; letter-spacing:4px; font-weight:700; background:var(--bg);
          border:1px dashed var(--green); padding:16px; border-radius:10px; margin-top:14px;
          color:var(--green); text-align:center; }
  .steps { text-align:left; font-size:12.5px; color:var(--muted); margin-top:14px; line-height:1.7; }
  .err { color:var(--red); font-size:13px; margin-top:10px; }
  .toast { position:fixed; bottom:16px; left:50%; transform:translateX(-50%); background:var(--card);
           border:1px solid var(--border); padding:10px 16px; border-radius:10px; font-size:13px; display:none; }
  .center-screen { display:flex; align-items:center; justify-content:center; min-height:80vh; padding:20px; }
  .pair-card { width:100%; max-width:360px; text-align:center; }
  .hide { display:none !important; }
</style>
</head>
<body>

<div id="pairScreen" class="center-screen hide">
  <div class="card pair-card">
    <div style="font-size:20px;font-weight:700;margin-bottom:4px;">BotifyX</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:18px;">Link your WhatsApp account</div>
    <form id="pairForm">
      <input id="pairNumber" placeholder="Phone number, e.g. 2348012345678" required autofocus />
      <button class="primary" style="margin-top:10px;" type="submit" id="pairBtn">Get pairing code</button>
    </form>
    <div id="pairCode"></div>
    <div id="pairErr" class="err"></div>
  </div>
</div>

<div id="app" class="hide">
  <div class="topbar">
    <div class="brand" id="brandName">BotifyX</div>
    <div class="tabs">
      <button class="tab active" data-tab="home">Home</button>
      <button class="tab" data-tab="console">Console</button>
      <button class="tab" data-tab="settings">Settings</button>
    </div>
    <div class="theme-dot">&#127769;</div>
  </div>

  <div class="wrap">

    <div id="tab-home" class="tabpanel">
      <div class="grid2">
        <div class="card"><div class="stat-label">Status</div><div class="stat-value ok" id="s-status">-</div></div>
        <div class="card"><div class="stat-label">Uptime</div><div class="stat-value" id="s-uptime">-</div></div>
        <div class="card"><div class="stat-label">Connection</div><div class="stat-value warn" id="s-connection">-</div></div>
        <div class="card"><div class="stat-label">Platform</div><div class="stat-value" id="s-platform">-</div></div>
      </div>
      <div class="section-title">Bot Info</div>
      <div class="card" id="botinfo"></div>
    </div>

    <div id="tab-console" class="tabpanel hide">
      <div class="toggle-row"><input type="checkbox" id="autoscroll" checked> Auto-scroll</div>
      <div class="console" id="consoleBox"></div>
      <div class="btnrow">
        <button class="btn-stop" data-action="stop">Stop</button>
        <button class="btn-start" data-action="start">Start</button>
        <button class="btn-restart" data-action="restart">Restart</button>
        <button class="btn-copy" id="copyLogsBtn">Copy</button>
      </div>
    </div>

    <div id="tab-settings" class="tabpanel hide">
      <div class="section-title">Bot Settings - General</div>
      <div class="card" id="settingsForm"></div>
      <button class="primary" id="saveSettingsBtn">Save changes</button>
    </div>

  </div>
</div>

<div class="toast" id="toast"></div>

<script>
const TOKEN = ${JSON.stringify(token)};
const qs = 'token=' + encodeURIComponent(TOKEN);
let consoleCursor = 0;
let paired = false;

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2500);
}

function fmtUptime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const parts = [];
  if (h) parts.push(h + ' hour' + (h !== 1 ? 's' : ''));
  parts.push(m + ' minute' + (m !== 1 ? 's' : ''));
  parts.push(s + ' second' + (s !== 1 ? 's' : ''));
  return parts.join(', ');
}

async function api(path, opts) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(path + sep + qs, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || ('HTTP ' + res.status));
  }
  return res.json();
}

// -- Pairing --------------------------------------------------------------------
document.getElementById('pairForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('pairBtn');
  const number = document.getElementById('pairNumber').value;
  document.getElementById('pairErr').textContent = '';
  btn.disabled = true; btn.textContent = 'Requesting...';
  try {
    const { code } = await api('/api/pair', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number })
    });
    document.getElementById('pairCode').innerHTML =
      '<div class="code">' + code + '</div>' +
      '<div class="steps">1. Open WhatsApp on your phone<br>' +
      '2. Settings -&gt; Linked Devices -&gt; Link a device<br>' +
      '3. Tap "Link with phone number instead"<br>' +
      '4. Enter the code above (expires in ~60s)</div>';
  } catch (err) {
    document.getElementById('pairErr').textContent = err.message;
  }
  btn.disabled = false; btn.textContent = 'Get pairing code';
});

// -- Tabs -------------------------------------------------------------------------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tabpanel').forEach(p => p.classList.add('hide'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hide');
    if (btn.dataset.tab === 'console') pollConsole(true);
    if (btn.dataset.tab === 'settings') loadSettings();
  });
});

// -- Home / status polling --------------------------------------------------------
function renderStatus(s) {
  document.getElementById('brandName').textContent = s.botname || 'BotifyX';
  document.getElementById('s-status').textContent = s.online ? 'ONLINE' : 'OFFLINE';
  document.getElementById('s-status').className = 'stat-value ' + (s.online ? 'ok' : 'bad');
  document.getElementById('s-uptime').textContent = fmtUptime(s.uptimeSeconds || 0);
  document.getElementById('s-connection').textContent = s.connection;
  document.getElementById('s-connection').className = 'stat-value ' +
    (s.connection === 'connected' ? 'ok' : s.connection === 'awaiting pairing' ? 'warn' : 'bad');
  document.getElementById('s-platform').textContent = s.platform || '-';

  const rows = [
    ['Bot Number', s.botNumber || '-'],
    ['Server Port', s.port],
    ['Dashboard URL', s.dashboardUrl ? ('<a href="' + s.dashboardUrl + '">' + s.dashboardUrl + '</a>') : '-'],
    ['Prefix', s.prefix],
    ['Version', s.version],
    ['Commands', s.commands],
    ['Developer', s.developer],
    ['Session', s.online ? 'Active' : 'Inactive'],
  ];
  document.getElementById('botinfo').innerHTML = rows.map(([k, v]) =>
    '<div class="row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'
  ).join('');
}

async function pollStatus() {
  try {
    const s = await api('/api/status');
    paired = s.registered;
    document.getElementById('pairScreen').classList.toggle('hide', paired);
    document.getElementById('app').classList.toggle('hide', !paired);
    if (paired) renderStatus(s);
  } catch (_) {}
}

// -- Console ------------------------------------------------------------------------
function lineClass(line) {
  if (/error|failed/i.test(line)) return 'l-error';
  if (/warn/i.test(line)) return 'l-warn';
  if (/connected|success/i.test(line)) return 'l-ok';
  return 'l-info';
}

async function pollConsole(reset) {
  if (reset) { consoleCursor = 0; document.getElementById('consoleBox').innerHTML = ''; }
  try {
    const { lines, nextCursor } = await api('/api/console?since=' + consoleCursor);
    consoleCursor = nextCursor;
    if (lines.length) {
      const box = document.getElementById('consoleBox');
      for (const l of lines) {
        const div = document.createElement('div');
        div.className = lineClass(l);
        div.textContent = l;
        box.appendChild(div);
      }
      if (document.getElementById('autoscroll').checked) box.scrollTop = box.scrollHeight;
    }
  } catch (_) {}
}

document.querySelectorAll('.btnrow [data-action]').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to ' + btn.dataset.action + ' the bot?')) return;
    try {
      const r = await api('/api/console/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: btn.dataset.action })
      });
      toast(r.message);
    } catch (err) { toast(err.message); }
  });
});

document.getElementById('copyLogsBtn').addEventListener('click', () => {
  const text = document.getElementById('consoleBox').innerText;
  navigator.clipboard?.writeText(text).then(() => toast('Logs copied.')).catch(() => toast('Copy failed.'));
});

// -- Settings -------------------------------------------------------------------------
const SETTINGS_FIELDS = [
  { key: 'prefix', label: 'Prefix', sub: 'Command prefix character' },
  { key: 'mode', label: 'Mode', sub: 'Bot mode: private, public, group, pm',
    type: 'select', options: ['private', 'public', 'group', 'pm'] },
  { key: 'menustyle', label: 'Menu Style', sub: 'Menu display style',
    type: 'select', options: ['1', '2', '3', '4', '5', '6'] },
  { key: 'botname', label: 'Bot Name', sub: 'Bot display name' },
  { key: 'ownername', label: 'Owner Name', sub: 'Owner display name' },
  { key: 'ownernumber', label: 'Owner Number', sub: 'Owner phone number' },
  { key: 'watermark', label: 'Watermark', sub: 'Media watermark text' },
  { key: 'author', label: 'Sticker Author', sub: 'Sticker pack author' },
  { key: 'packname', label: 'Sticker Pack', sub: 'Sticker pack name' },
  { key: 'timezone', label: 'Timezone', sub: 'Bot timezone (TZ format)' },
];

async function loadSettings() {
  const s = await api('/api/settings');
  document.getElementById('settingsForm').innerHTML = SETTINGS_FIELDS.map(f => {
    const val = (s[f.key] ?? '');
    if (f.type === 'select') {
      return '<label class="field"><div class="lbl">' + f.label + '</div><div class="sub">' + f.sub + '</div>' +
        '<select data-key="' + f.key + '">' +
        f.options.map(o => '<option value="' + o + '"' + (o === val ? ' selected' : '') + '>' + o + '</option>').join('') +
        '</select></label>';
    }
    return '<label class="field"><div class="lbl">' + f.label + '</div><div class="sub">' + f.sub + '</div>' +
      '<input data-key="' + f.key + '" value="' + String(val).replace(/"/g, '&quot;') + '"></label>';
  }).join('');
}

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const patch = {};
  document.querySelectorAll('#settingsForm [data-key]').forEach(el => { patch[el.dataset.key] = el.value; });
  try {
    await api('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    toast('Settings saved.');
  } catch (err) { toast(err.message); }
});

pollStatus();
setInterval(pollStatus, 3000);
setInterval(() => { if (paired && !document.getElementById('tab-console').classList.contains('hide')) pollConsole(false); }, 2000);
</script>
</body>
</html>`;
}

module.exports = { startDashboard, generateToken };
