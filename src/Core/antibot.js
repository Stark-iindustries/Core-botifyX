const { jidNormalizedUser } = require('@whiskeysockets/baileys');

const getGroupAdmins = (participants) => {
    let admins = []
    for (let i of participants) {
        i.admin === "superadmin" ? admins.push(i.id) : i.admin === "admin" ? admins.push(i.id) : ''
    }
    return admins || []
}

async function antiBot(Cypher, m, db) {
  if (!m.isGroup || !db.chats?.[m.chat]?.antibot || !m.isBaileys) return;

  const groupMetadata = m.isGroup ? await Cypher.groupMetadata(m.chat).catch(e => {}) : ''
  if (!groupMetadata) return;

  const botNumber = jidNormalizedUser(Cypher.user.id);
  const participants = groupMetadata.participants || [];
  const groupAdmins = await getGroupAdmins(participants);
  const isBotAdmin = groupAdmins.includes(botNumber);
  const isSenderAdmin = groupAdmins.includes(m.sender);

  if (!isBotAdmin || isSenderAdmin) return;

  const isBrotherBot = m.id && (m.id.startsWith("BOTIFY") || m.id.startsWith("BFYX"));

  if (isBrotherBot) {
    const promptText = `*⚠️ Brother Bot Detected:*\n@${m.sender.split('@')[0]} appears to be using a BotifyX Bot.\n\n`
      + `To remove this bot, an *admin* must reply to this message with \`1\` to confirm.\n\n`
      + `_If no action is taken, the bot will stay._`;

    const sentMsg = await Cypher.sendMessage(m.chat, {
      text: promptText,
      mentions: [m.sender]
    }, { quoted: m });

    if (!db.pendingBotKicks) db.pendingBotKicks = {};
    db.pendingBotKicks[`${m.chat}_${m.sender}`] = {
      chat: m.chat,
      bot: m.sender,
      promptId: sentMsg.key.id,
      detectedAt: Date.now()
    };

  } else {
    await Cypher.groupParticipantsUpdate(m.chat, [m.sender], "remove");
    await Cypher.sendMessage(m.chat, {
      text: `*🚫 BOT DETECTED:*\n@${m.sender.split('@')[0]} has been kicked for being detected as a bot.`,
      mentions: [m.sender]
    }, { quoted: m });
  }
}

async function handleBotKickReply(Cypher, m, db) {
  if (!m.isGroup || m.text !== "1" || !db.pendingBotKicks) return;

  const match = Object.entries(db.pendingBotKicks).find(([key, data]) =>
    key.startsWith(m.chat) &&
    m.quoted && m.quoted.id === data.promptId
  );

  if (!match) return;

  const [pendingKey, { chat, bot }] = match;
  const metadata = m.isGroup ? await Cypher.groupMetadata(chat).catch(e => {}) : ''
  const groupAdmins = await getGroupAdmins(metadata.participants);
  const isAdmin = groupAdmins.includes(m.sender);

  if (!isAdmin) {
    return m.reply("*❌ Access Denied:*\nOnly group admins can confirm bot removal.");
  }

  try {
    await Cypher.groupParticipantsUpdate(chat, [bot], "remove");
    await Cypher.sendMessage(chat, {
      text: `✅ *Bot Removed:*\n@${bot.split('@')[0]} was kicked as approved by admin @${m.sender.split('@')[0]}.`,
      mentions: [bot, m.sender]
    }, { quoted: m });
  } catch (err) {
    await m.reply(`❌ *Error:* Unable to remove bot.\n\nReason: ${err.message}`);
  }

  delete db.pendingBotKicks[pendingKey];
}

module.exports = { antiBot, handleBotKickReply };