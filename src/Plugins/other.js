const os = require('os');
const fs = require('fs');
const fetch = require('node-fetch');
const axios = require('axios');
const fonts = require('../Core/fonts.js');
const moment = require('moment-timezone');
const { execSync } = require("child_process");
const { formatSize, checkBandwidth, runtime } = require('../../lib/myfunc');
const checkDiskSpace = require('check-disk-space').default;
const performance = require('perf_hooks').performance;
const { getMenuImage } = require('../Core/menuimg');
const { detectPlatform } = require('../Core/bot');
const si = require("systeminformation");

function getCPUUsage() {
  return new Promise(resolve => {
    const start = os.cpus();
    setTimeout(() => {
      const end = os.cpus();
      let idleDiff = 0, totalDiff = 0;
      for (let i = 0; i < start.length; i++) {
        const startCpu = start[i].times;
        const endCpu = end[i].times;
        const idle = endCpu.idle - startCpu.idle;
        const total = Object.keys(startCpu).reduce((acc, key) => acc + (endCpu[key] - startCpu[key]), 0);
        idleDiff += idle;
        totalDiff += total;
      }
      const usage = (1 - idleDiff / totalDiff) * 100;
      resolve(usage.toFixed(2) + "%");
    }, 1000);
  });
}

module.exports = [
{
  command: ["botstatus", "statusbot"],
  react: "📊",
  operate: async ({ Cypher, m, reply, db }) => {
    const fontTransform = fonts[db.settings.fontstyle] || fonts.default;

    const latencyStart = performance.now();
    await reply(fontTransform("⏳ *Calculating server status...*"));
    const latencyEnd = performance.now();
    const ping = `${(latencyEnd - latencyStart).toFixed(2)} ms`;

    const used = process.memoryUsage();
    const ramUsage = `${formatSize(used.heapUsed)} / ${formatSize(os.totalmem())}`;
    const freeRam = formatSize(os.freemem());
    const disk = await checkDiskSpace(process.cwd());
    const cpuUsage = await getCPUUsage();

    const { download, upload } = await checkBandwidth();
    const networkInterfaces = os.networkInterfaces();
    const ipAddress = Object.values(networkInterfaces)
      .flat()
      .find(i => i.family === "IPv4" && !i.internal)?.address || "N/A";

    const cpuCores = os.cpus().length;
    const cpuModel = os.cpus()[0].model;
    const osInfo = `${os.type()} ${os.release()} (${os.arch()})`;
    const uptime = runtime(process.uptime());
    const systemUptime = runtime(os.uptime());

    const processes = execSync("ps -e --no-headers | wc -l").toString().trim();
    const temp = (await si.cpuTemperature()).main || "N/A";
    const swap = (await si.mem()).swapused;
    const swapTotal = (await si.mem()).swaptotal;

    const response = fontTransform(`
      *${"🔹".repeat(3)} BOT STATUS ${"🔹".repeat(3)}*

🔸 *Performance*:
▸ *Ping:* ${ping}
▸ *Bot Uptime:* ${uptime}
▸ *System Uptime:* ${systemUptime}

🔸 *Resources*:
▸ *RAM:* ${ramUsage}
▸ *Free RAM:* ${freeRam}
▸ *Swap:* ${formatSize(swap)} / ${formatSize(swapTotal)}
▸ *Heap:* ${formatSize(used.heapUsed)}
▸ *RSS:* ${formatSize(used.rss)}
▸ *Disk:* ${formatSize(disk.size - disk.free)} / ${formatSize(disk.size)}
▸ *Free Disk:* ${formatSize(disk.free)}

🔸 *Processor*:
▸ *Model:* ${cpuModel}
▸ *Cores:* ${cpuCores}
▸ *Usage:* ${cpuUsage}
▸ *Temperature:* ${temp}°C

🔸 *Network*:
▸ *IP:* ${ipAddress}
▸ *Downloaded:* ${download}
▸ *Uploaded:* ${upload}
▸ *Platform:* ${detectPlatform()}

🔸 *Software*:
▸ *OS:* ${osInfo}
▸ *NodeJS:* ${process.version}
▸ *PID:* ${process.pid}
▸ *Bot:* ${db.settings.botname}: v${require("../../package.json").version}
    `);

    Cypher.sendMessage(
      m.chat,
      { 
        text: response.trim(),
        contextInfo: { forwardingScore: 0, isForwarded: false }
      },
      { quoted: m }
    );
  }
},
  {
    command: ['pair'],
    react: "🔗",
    operate: async ({ m, text, reply }) => {
      if (!text) return reply('*Provide a phone number*\nExample: .pair 2348123456789');
      const number = text.replace(/\+|\s/g, '').trim();

      // Use the BOTIFY-X pairing portal
      const portalUrl = process.env.PAIRING_PORTAL_URL || '';
      if (!portalUrl) return reply('❌ *Pairing portal URL not configured.*\n\nSet PAIRING_PORTAL_URL in your environment and visit it to get a session.');

      try {
        const response = await fetch(`${portalUrl}/code?number=${encodeURIComponent(number)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const pairCode = data.code || 'No code received';

        await m.reply(`${pairCode}`);
        return reply(`*🔹 Pair Code:*\n\`\`\`${pairCode}\`\`\`\n\n🔹 *How to Link:*
1. Open WhatsApp on your phone.
2. Go to *Settings > Linked Devices*.
3. Tap *Link a Device* then *Link with Phone*.
4. Enter the pair code above.
\n⏳ *Code expires in 2 minutes!*`);
      } catch (error) {
        reply(`❌ *Error fetching pair code:* ${error.message}`);
      }
    }
  },
  {
    command: ['ping', 'p'],
    react: "🏓",
    operate: async ({ m, Cypher, db }) => {
      const startTime = performance.now();
      const fontTransform = fonts[db.settings.fontstyle] || fonts.default;

      try {
        const sentMessage = await Cypher.sendMessage(m.chat, {
          text: "🔸Pong!",
          contextInfo: { quotedMessage: m.message }
        });

        const endTime = performance.now();
        const latency = `${(endTime - startTime).toFixed(2)} ms`;

        await Cypher.sendMessage(m.chat, {
          text: fontTransform(`*🔹 ${db.settings.botname || 'BotifyX'} Speed:* ${latency}`),
          edit: sentMessage.key,
          contextInfo: { quotedMessage: m.message }
        });
      } catch (error) {
        console.error('Error sending ping message:', error);
        await Cypher.sendMessage(m.chat, {
          text: 'An error occurred while trying to ping.',
          contextInfo: { quotedMessage: m.message }
        });
      }
    }
  },
  {
      command: ['menu'],
      operate: async ({ Cypher, m, db, plugins, prefix }) => {
        const t0 = performance.now();
        const loadingMsg = await Cypher.sendMessage(m.chat, { text: 'Loading menu...' }, { quoted: m });
        const pingMs = (performance.now() - t0).toFixed(2);

        // Gather live data concurrently
        const [cpuUsage] = await Promise.all([getCPUUsage()]);

        const totalRam = os.totalmem();
        const usedRam  = totalRam - os.freemem();
        const ramPct   = Math.round((usedRam / totalRam) * 100);
        const filled   = Math.round(ramPct / 10);
        const ramBar   = '█'.repeat(filled) + '░'.repeat(10 - filled);

        const version     = require('../../package.json').version;
        const platform    = detectPlatform();
        const botname     = db.settings.botname  || 'BotifyX';
        const owner       = db.settings.ownername || 'Not Set!';
        const mode        = db.settings.mode     || 'private';
        const pluginCount = plugins ? plugins.length : 0;

        const menu =
          `┏▣ ◈ *${botname}* ◈\n` +
          `┃ *ᴏᴡɴᴇʀ* : ${owner}\n` +
          `┃ *ᴘʀᴇғɪˣ* : ${prefix}\n` +
          `┃ *ʜᴏɢᴛ* : ${platform}\n` +
          `┃ *ᴘʟᴜɢɪɴs* : ${pluginCount}\n` +
          `┃ *ᴍᴏᴅᴇ* : ${mode}\n` +
          `┃ *ᴠᴇʀsɪᴏɴ* : v${version}\n` +
          `┃ *sᴘᴇᴇᴅ* : ${pingMs} ms\n` +
          `┃ *ᴜɢᴀɢᴇ* : ${cpuUsage}\n` +
          `┃ *ʀᴀᴍ:* [${ramBar}] ${ramPct}%\n` +
          `┗▣`;

        await Cypher.sendMessage(m.chat, {
          text: menu,
          edit: loadingMsg.key,
        });
      }
    },
    {
      command: ['runtime', 'uptime'],
    react: "⏱️",
    operate: async ({ Cypher, m, reply }) => {
      const botUptime = runtime(process.uptime());
      reply(`*🔹 ${botUptime}*`);
    }
  },
  {
    command: ['repo', 'sc', 'repository', 'script'],
    react: "🔸",
    operate: async ({ m, Cypher, reply }) => {
      try {
        const repoUrl = 'https://github.com/YOUR_GITHUB_USERNAME/botify-x';
        const { data } = await axios.get('https://api.github.com/repos/YOUR_GITHUB_USERNAME/botify-x');
        const repoInfo = `
        *🔹 BOT REPOSITORY 🔹*
        
🔸 *Name:* ${data.name}
🔸 *Stars:* ${data.stargazers_count}
🔸 *Forks:* ${data.forks_count}
🔸 *GitHub Link:* 
${repoUrl}

@${m.sender.split("@")[0]}👋, Don't forget to star and fork our repository!`;

        Cypher.sendMessage(m.chat, {
          text: repoInfo.trim(),
          contextInfo: {
            mentionedJid: [m.sender]
          }
        }, { quoted: m });
      } catch (error) {
        reply('❌ *Error fetching repository details.*');
      }
    }
  },
  {
    command: ['time', 'date'],
    react: "⏰",
    operate: async ({ m, reply }) => {
      const now = moment().tz(global.timezones);
      const timeInfo = `
      *🔹 CURRENT TIME 🔹*

🔸 *Day:* ${now.format('dddd')}
🔸 *Time:* ${now.format('HH:mm:ss')}
🔸 *Date:* ${now.format('LL')}
🔸 *Timezone:* ${global.timezones}
`;
      reply(timeInfo.trim());
    }
  },
];
