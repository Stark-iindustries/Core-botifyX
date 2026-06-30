module.exports = [
  {
    command: ['feedback'],
    operate: async ({ m, mess, text, Cypher, isCreator, versions, prefix, command, reply }) => {
      if (!isCreator) return reply(mess.owner);
      if (!text) return reply(`Example: ${prefix + command} Hey dev, this bot is very awesome🔥`);

      const confirmationMsg = `
Hi ${m.pushName},

Thanks for sharing your feedback with us. We value every message and will review it shortly.

🤖 *BotifyX Team*
      `.trim();

      Cypher.sendMessage(m.chat, { text: confirmationMsg, mentions: [m.sender] }, { quoted: m });
    }
  },
  {
    command: ['helpers', 'support'],
    operate: async ({ m, args, reply }) => {
      const search = args.join(' ').toLowerCase();

      const filtered = global.helpersList.filter(helper =>
        !search || helper.country.toLowerCase().includes(search)
      );

      if (!filtered.length) {
        return reply(`❌ No helper found for "${search}".\nTry using: *.helpers* to see all.`);
      }

      filtered.sort((a, b) => a.country.localeCompare(b.country));

      let text = `*🌍 BotifyX Verified Helpers*\n\n`;
      filtered.forEach((helper, index) => {
        text += `${index + 1}. ${helper.flag} *${helper.country}*\n   • ${helper.name}: ${helper.number}\n\n`;
      });

      text += `✅ BotifyX Team\n`;
      text += `📢 Need general help? Join our support group:\n`;
      text += `👉 Telegram: https://t.me/+yxIy3nwj6Ig4YjM0\n`;
      text += `📢 Channel: https://t.me/botifyxspace\n`;
      text += `⚠️ Charges may apply depending on the service provided.`;

      reply(text);
    }
  }
];
