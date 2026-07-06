const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const https = require('https');
const { sleep } = require('../../lib/myfunc');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);
const { generateProfilePicture, downloadContentFromMessage } = require('@whiskeysockets/baileys'); 

const Jimp = require("jimp");

async function generateFullProfilePic(imagePath) {
  const image = await Jimp.read(imagePath);
  const resized = image.cover(720, 720); 
  const buffer = await resized.getBufferAsync(Jimp.MIME_JPEG);
  return { img: buffer };
}

module.exports = [
 {
  command: ['block'],
  operate: async ({ Cypher, m, reply, isCreator, mess, text }) => {
    if (!isCreator) return reply(mess.owner);
    if (!m.quoted && !m.mentionedJid[0] && !text) return reply("Reply to a message or mention/user ID to block");

    const userId = m.mentionedJid[0] || m.quoted?.sender || text.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    await Cypher.updateBlockStatus(userId, "block");
    reply(mess.done);
  }
},
{
  command: ['delete', 'del'],
  react: "🗑️",
  operate: async ({ Cypher, m, reply, isCreator, mess }) => {
    if (!isCreator) return reply(mess.owner);
    if (!m.quoted) return reply(`*Please reply to a message*`);

    try {
     
      await Cypher.sendMessage(m.chat, {
        delete: {
          remoteJid: m.quoted.fakeObj.key.remoteJid,
          fromMe: m.quoted.fakeObj.key.fromMe,
          id: m.quoted.fakeObj.key.id,
          participant: m.quoted.fakeObj.participant,
        }
      });

      
      await Cypher.sendMessage(m.chat, {
        delete: {
          remoteJid: m.key.remoteJid,
          fromMe: m.key.fromMe,
          id: m.key.id,
          participant: m.key.participant,
        }
      });

    } catch (err) {
      console.error(err);
      reply("⚠️ Failed to delete message.");
    }
  }
},
 {
  command: ['deljunk', 'deletejunk', 'clearjunk'],
  operate: async (context) => {
    const { Cypher, m, reply, isCreator, mess } = context;

    if (!isCreator) return reply(mess.owner);

    const tmpDir = path.resolve("./tmp");
    fsp.readdir(tmpDir, async function (err, files) {
      if (err) {
        console.log("Unable to scan directory: " + err);
        return reply("Unable to scan directory: " + err);
      }
      let junkFiles = files.filter(
        (item) =>
          item.endsWith("gif") ||
          item.endsWith("png") || 
          item.endsWith("mp3") ||
          item.endsWith("mp4") || 
          item.endsWith("opus") || 
          item.endsWith("jpg") ||
          item.endsWith("webp") ||
          item.endsWith("webm") ||
          item.endsWith("zip")
      );
      console.log(junkFiles.length);
      await sleep(2000);
      reply(`*Clearing ${junkFiles.length} junk files in the tmp folder...*`);
      await junkFiles.forEach(function (file) {
        fs.unlinkSync(`${tmpDir}/${file}`);
      });
      await sleep(2000);
      reply("*Successfully cleared all the junk files in the tmp folder*");
    });
  }
}, 
 {
  command: ['disk'],
  operate: async ({ Cypher, m, reply, isCreator, mess }) => {
    if (!isCreator) return reply(mess.owner);

    await reply('Please Wait');
    
    let o;
    try {
      o = await execAsync('cd && du -h --max-depth=1');
    } catch (e) {
      o = e;
    } finally {
      let { stdout, stderr } = o;
      if (stdout.trim()) reply(stdout);
      if (stderr.trim()) reply(stderr);
    }
  }
},
{
  command: ['dlvo', 'vv', 'rvo'],
  operate: async ({ Cypher, m, reply, isCreator, mess }) => {
    if (!isCreator) return reply(mess.owner);
    if (!m.quoted) return reply('*Please reply to a view once message!*');

    let msg = m.msg?.contextInfo?.quotedMessage;
    let type = Object.keys(msg)[0];

    if (type === 'viewOnceMessageV2') {
      const innerMsg = msg[type]?.message;
      if (!innerMsg) return reply('*Unsupported view-once message format.*');

      type = Object.keys(innerMsg)[0];
      msg = innerMsg;
    }

    if (!/imageMessage|videoMessage|audioMessage/.test(type)) {
      return reply('*Only view once images, videos, and audio messages are supported!*');
    }

    try {
      let media;
      let filename;
      let caption = msg[type]?.caption || global.wm;

      if (type === 'imageMessage') {
        media = await downloadContentFromMessage(msg[type], 'image');
        filename = 'media.jpg';
      } else if (type === 'videoMessage') {
        media = await downloadContentFromMessage(msg[type], 'video');
        filename = 'media.mp4';
      } else if (type === 'audioMessage') {
        media = await downloadContentFromMessage(msg[type], 'audio');
        filename = 'audio.mp3';
      }

      let bufferArray = [];
      for await (const chunk of media) {
        bufferArray.push(chunk);
      }
      let buffer = Buffer.concat(bufferArray);

      if (type === 'audioMessage') {
        await Cypher.sendMessage(
          m.chat,
          { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true },
          { quoted: m }
        );
      } else {
        await Cypher.sendFile(m.chat, buffer, filename, caption, m);
      }

    } catch (error) {
      console.error(error);
      reply('*Failed to retrieve media. The message might not be a valid view-once media.*');
    }
  }
},
 {
  command: ['gcaddprivacy'],
  operate: async ({ Cypher, m, reply, isCreator, mess, prefix, command, text, args }) => {
    if (!isCreator) return reply(mess.owner);
    if (!text) return reply(`Options: all/contacts/contact_blacklist\nExample: ${prefix + command} all`);

    const validOptions = ["all", "contacts", "contact_blacklist"];
    if (!validOptions.includes(args[0])) return reply("*Invalid option!*");

    await Cypher.updateGroupsAddPrivacy(text);
    await reply(mess.done);
  }
},
 {
  command: ['groupid', 'idgc'],
  operate: async ({ Cypher, m, reply, isCreator, mess, args, q }) => {
    if (!isCreator) return reply(mess.owner);
    if (!q) return reply('Please provide a group link!');
    
    let linkRegex = args.join(" ");
    let coded = linkRegex.split("https://chat.whatsapp.com/")[1];
    if (!coded) return reply("Link Invalid");

    Cypher.query({
      tag: "iq",
      attrs: {
        type: "get",
        xmlns: "w:g2",
        to: "@g.us"
      },
      content: [{ tag: "invite", attrs: { code: coded } }]
    }).then(async (res) => {
      const tee = `${res.content[0].attrs.id ? res.content[0].attrs.id : "undefined"}`;
      reply(tee + '@g.us');
    });
  }
},
 {
  command: ['hostip', 'ipbot'],
  operate: async ({ Cypher, m, reply, isCreator, mess }) => {
    if (!isCreator) return reply(mess.owner);

    https.get("https://api.ipify.org", (res) => {
      let data = '';
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => reply("Bot's public IP: " + data));
    });
  }
},
 {
  command: ['join'],
  operate: async ({ Cypher, m, reply, isCreator, mess, args, text, isUrl }) => {
    if (!isCreator) return reply(mess.owner);
    if (!text) return reply("Enter group link");
    if (!isUrl(args[0]) && !args[0].includes("whatsapp.com")) return reply("Invalid link");

    try {
      const link = args[0].split("https://chat.whatsapp.com/")[1];
      await Cypher.groupAcceptInvite(link);
      reply("Joined successfully");
    } catch {
      reply("Failed to join group");
    }
  }
},
 {
  command: ['lastseen'],
  operate: async ({ Cypher, m, reply, isCreator, mess, prefix, command, text, args }) => {
    if (!isCreator) return reply(mess.owner);
    if (!text) return reply(`Options: all/contacts/contact_blacklist/none\nExample: ${prefix + command} all`);

    const validOptions = ["all", "contacts", "contact_blacklist", "none"];
    if (!validOptions.includes(args[0])) return reply("Invalid option");

    await Cypher.updateLastSeenPrivacy(text);
    await reply(mess.done);
  }
},
 {
  command: ['leave', 'leavegc'],
  operate: async ({ Cypher, m, reply, isCreator, mess, sleep }) => {
    if (!isCreator) return reply(mess.owner);
    if (!m.isGroup) return reply(mess.group);

    reply("*Goodbye, it was nice being here!*");
    await sleep(3000);
    await Cypher.groupLeave(m.chat);
  }
},
 {
  command: ['listbadword'],
  operate: async ({ m, reply, isCreator, mess, bad }) => {
    if (!isCreator) return reply(mess.owner);

    if (bad.length === 0) return reply('No bad words have been added yet.');

    let text = '*Bad Words List:*\n\n';
    bad.forEach((word, index) => {
      text += `${index + 1}. ${word}\n`;
    });

    text += `\nTotal bad words: ${bad.length}`;
    reply(text);
  }
},
{
  command: ['listblocked', 'blocked'],
  operate: async ({ m, Cypher, reply, mess, isCreator }) => {
    if (!isCreator) return reply(mess.owner);

    try {
      const blockedList = await Cypher.fetchBlocklist();

      if (!blockedList.length) {
        return reply('✅ No contacts are currently blocked.');
      }

      let blockedUsers = blockedList.map((user, index) => `🔹 *${index + 1}.* @${user.split('@')[0]}`).join('\n');

      await Cypher.sendMessage(m.chat, {
        text: `🚫 *Blocked Contacts:*\n\n${blockedUsers}`,
        mentions: blockedList
      }, { quoted: m });

    } catch (error) {
      reply('⚠️ Unable to fetch blocked contacts.');
    }
  }
},
{
  command: ['listignorelist'],
  operate: async ({ reply, loadBlacklist, mess, isCreator }) => {
    if (!isCreator) return reply(mess.owner);
    let blacklist = loadBlacklist();
    if (blacklist.blacklisted_numbers.length === 0) {
        reply('The ignore list is empty.');
    } else {
        reply(`Ignored users/chats:\n${blacklist.blacklisted_numbers.join('\n')}`);
    }
  }
},
{
  command: ['listsudo'],
  operate: async ({ reply, mess, isCreator }) => {
    if (!isCreator) return reply(mess.owner);
    const sudoList = global.db.sudo;

    if (sudoList.length === 0) {
      reply('The sudo list is empty.');
    } else {
      reply(`Sudo users:\n${sudoList.join('\n')}`);
    }
  }
},
 {
  command: ['modestatus', 'botmode'],
  operate: async ({ Botify, m, reply, isCreator, mess, modeStatus }) => {
    if (!isCreator) return reply(mess.owner);
    reply(`Current mode: ${modeStatus}`);
  }
},
  {
  command: ['online'],
  operate: async ({ Cypher, m, reply, isCreator, mess, prefix, command, text, args }) => {
    if (!isCreator) return reply(mess.owner);
    if (!text) return reply(`Options: all/match_last_seen\nExample: ${prefix + command} all`);

    const validOptions = ["all", "match_last_seen"];
    if (!validOptions.includes(args[0])) return reply("Invalid option");

    await Cypher.updateOnlinePrivacy(text);
    await reply(mess.done);
  }
},
 {
  command: ['owner'],
  operate: async ({ m, Cypher, sender }) => {
    try {
      const ownerList = [];
      const ownerNumbers = [global.ownernumber.includes('@') ? global.ownernumber : `${global.ownernumber}@s.whatsapp.net`];

      for (const number of ownerNumbers) {
        const displayName = await Cypher.getName(number);
        ownerList.push({
          displayName: displayName || global.ownername,
          vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${global.ownername}\nFN:${global.ownername}\nitem1.TEL;waid=${number.split('@')[0]}:${number.split('@')[0]}\nitem1.X-ABLabel:Mobile\nEND:VCARD`,
        });
      }

      await Cypher.sendMessage(
        m.chat,
        { contacts: { displayName: `${ownerList.length} Contact`, contacts: ownerList }, mentions: [sender] },
        { quoted: m }
      );
    } catch (error) {
      console.error('Error sending owner contact:', error.message);
      await Cypher.sendMessage(
        m.chat,
        { text: `*Error:* ${error.message}` },
        { quoted: m }
      );
    }
  },
},
  {
  command: ['ppprivacy'],
  operate: async ({ Cypher, m, reply, isCreator, mess, prefix, command, text, args }) => {
    if (!isCreator) return reply(mess.owner);
    if (!text) return reply(`Options: all/contacts/contact_blacklist/none\nExample: ${prefix + command} all`);

    const validOptions = ["all", "contacts", "contact_blacklist", "none"];
    if (!validOptions.includes(args[0])) return reply("Invalid option");

    await Cypher.updateProfilePicturePrivacy(text);
    await reply(mess.done);
  }
},
 {
  command: ['react'],
  operate: async ({ Cypher, m, reply, isCreator, mess, args, quoted }) => {
    if (!isCreator) return reply(mess.owner);
    if (!args) return reply(`*Reaction emoji needed*\n Example .react 🤔`);

    const reactionMessage = {
      react: {
        text: args[0],
        key: { remoteJid: m.chat, fromMe: true, id: quoted.id },
      },
    };
    Cypher.sendMessage(m.chat, reactionMessage);
  }
},
  {
  command: ['readreceipts'],
  operate: async ({ Cypher, m, reply, isCreator, mess, prefix, command, text, args }) => {
    if (!isCreator) return reply(mess.owner);
    if (!text) return reply(`Options: all/none\nExample: ${prefix + command} all`);

    const validOptions = ["all", "none"];
    if (!validOptions.includes(args[0])) return reply("Invalid option");

    await Cypher.updateReadReceiptsPrivacy(text);
    await reply(mess.done);
  }
},
  {
  command: ['restart'],
  operate: async ({ Cypher, m, reply, isCreator, mess }) => {
    if (!isCreator) return reply(mess.owner);
    reply(`*Restarting...*`);
    await sleep(3000);
    process.exit(0);
  }
},
 {
  command: ['setbio'],
  operate: async ({ Cypher, m, reply, isCreator, mess, prefix, command, text }) => {
    if (!isCreator) return reply(mess.owner);
    if (!text) return reply(`*Text needed*\nExample: ${prefix + command} ${global.botname}`);

    await Cypher.updateProfileStatus(text);
    reply(`*Successfully updated bio to "${text}"*`);
  }
},
 {
  command: ['setprofilepic', 'setpp', 'setfullpp'],
  operate: async ({ Cypher, m, reply, isCreator, mess, prefix, command, quoted, mime, args, botNumber }) => {
    if (!isCreator) return reply(mess.owner);
    if (!quoted) return reply(`*Send or reply to an image With captions ${prefix + command}*`);
    if (!/image/.test(mime)) return reply(`*Send or reply to an image With captions ${prefix + command}*`);
    if (/webp/.test(mime)) return reply(`*Send or reply to an image With captions ${prefix + command}*`);

    const medis = await Cypher.downloadAndSaveMediaMessage(quoted, "ppbot.jpeg");

    if (args[0] === "full") {
      const { img } = await generateFullProfilePic(medis);
      await Cypher.query({
        tag: "iq",
        attrs: {
          to: botNumber,
          type: "set",
          xmlns: "w:profile:picture",
        },
        content: [
          {
            tag: "picture",
            attrs: {
              type: "image",
            },
            content: img,
          },
        ],
      });
      fs.unlinkSync(medis);
      reply(mess.done);
    } else {
      await Cypher.updateProfilePicture(botNumber, {
        url: medis,
      });
      fs.unlinkSync(medis);
      reply(mess.done);
    }
  }
},
{
    command: ['setstickercmd', 'stickercmd'],
    operate: async ({ m, args, Cypher, db, reply, isCreator, mess }) => {
    if (!isCreator) return reply(mess.owner);
    if (args.length < 1) return reply("❌ Provide a command name, e.g., *.setstickercmd ping*");

      const quoted = m.quoted;
      const commands = args[0];
console.log(`${commands}`)

      if (!quoted || quoted.mtype !== 'stickerMessage')
        return reply("❌ *Reply to a sticker* to set an alias.");

      const hash = [...quoted.fileSha256].toString();

      if (!db.settings.stickerAliases)
        db.settings.stickerAliases = {};

      db.settings.stickerAliases[hash] = commands;
      return reply(`✅ The sticker is now an alias for *${commands}*.`);
    }
  },
  {
    command: ['delstickercmd', 'removestickercmd'],
    operate: async ({ m, args, Cypher, db, reply }) => {
      const cmd = args[0];
      if (!cmd)
        return reply("❌ Provide the command name to remove the sticker alias for.\n\nExample: *.delstickercmd ping*");

      if (!db.settings.stickerAliases)
        db.settings.stickerAliases = {};

      const foundEntry = Object.entries(db.settings.stickerAliases).find(([, v]) => v === cmd.toLowerCase());

      if (!foundEntry)
        return reply(`❌ No sticker alias found for *${cmd}*.`);

      delete db.settings.stickerAliases[foundEntry[0]];
      return reply(`✅ Removed sticker alias for *${cmd}*.`);
    }
},
{
  command: ['tostatus'],
  operate: async ({ Cypher, m, reply, mess, isCreator, q }) => {
    if (!isCreator) return reply(mess.owner);
   const quoted = m.quoted ? m.quoted : null;
   const mime = quoted?.mimetype || ""; 
    
    try {
      if (!q && !quoted) {
        return reply(`*Usage:*\n- Reply to an image, video, or audio\n- Send a text to post it as a status`);
      }

      let statusOptions = { statusJidList: global.db.users };

      if (quoted) {
        if (/image/.test(mime)) {
          let image = await Cypher.downloadAndSaveMediaMessage(quoted);
          await Cypher.sendMessage("status@broadcast", { image: { url: image }, caption: q || "" }, statusOptions);
          return reply("✅ Image posted to status.");
        }

        if (/video/.test(mime)) {
          let video = await Cypher.downloadAndSaveMediaMessage(quoted);
          await Cypher.sendMessage("status@broadcast", { video: { url: video }, caption: q || "" }, statusOptions);
          return reply("✅ Video posted to status.");
        }

        if (/audio/.test(mime)) {
          let audio = await Cypher.downloadAndSaveMediaMessage(quoted);
          await Cypher.sendMessage("status@broadcast", { audio: { url: audio }, mimetype: "audio/mp4", ptt: true }, statusOptions);
          return reply("✅ Audio posted to status.");
        }

        return reply("⚠️ Unsupported media type. Reply to an image, video, or audio.");
      }

      await Cypher.sendMessage("status@broadcast", { text: q }, statusOptions);
      reply("✅ Text status posted.");
      
    } catch (error) {
      reply("⚠️ Failed to post status.");
      console.error(error);
    }
  }
},
 {
  command: ['toviewonce', 'tovo', 'tovv'],
  operate: async ({ Cypher, m, reply, isCreator, mess, quoted, mime }) => {
    if (!isCreator) return reply(mess.owner);
    if (!quoted) return reply(`*Reply to an Image or Video*`);

    if (/image/.test(mime)) {
      const anuan = await Cypher.downloadAndSaveMediaMessage(quoted);
      Cypher.sendMessage(
        m.chat,
        {
          image: { url: anuan },
          caption: mess.done,
          fileLength: "999",
          viewOnce: true
        },
        { quoted: m }
      );
    } else if (/video/.test(mime)) {
      const anuanuan = await Cypher.downloadAndSaveMediaMessage(quoted);
      Cypher.sendMessage(
        m.chat,
        {
          video: { url: anuanuan },
          caption: mess.done,
          fileLength: "99999999",
          viewOnce: true
        },
        { quoted: m }
      );
    } else if (/audio/.test(mime)) {
      const bebasap = await Cypher.downloadAndSaveMediaMessage(quoted);
      Cypher.sendMessage(m.chat, {
        audio: { url: bebasap },
        mimetype: "audio/mpeg",
        ptt: true,
        viewOnce: true
      });
    }
  }
},
  {
  command: ['unblock'],
  operate: async ({ Cypher, m, reply, isCreator, mess, text }) => {
    if (!isCreator) return reply(mess.owner);
    if (!m.quoted && !m.mentionedJid[0] && !text) return reply("Reply to a message or mention/user ID to unblock");

    const userId = m.mentionedJid[0] || m.quoted?.sender || text.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    await Cypher.updateBlockStatus(userId, "unblock");
    reply(mess.done);
  }
},
{
  command: ['unblockall'],
  operate: async ({ Cypher, m, reply, mess, isCreator }) => {
    if (!isCreator) return reply(mess.owner);

    try {
      const blockedList = await Cypher.fetchBlocklist();
      if (!blockedList.length) return reply("✅ No blocked contacts to unblock.");

      for (const user of blockedList) {
        await Cypher.updateBlockStatus(user, "unblock");
      }

      reply(`✅ Successfully unblocked *${blockedList.length}* contacts.`);
    } catch (error) {
      reply("⚠️ Failed to unblock all contacts.");
    }
  }
},
{
    command: ['warn'],
    operate: async ({ m, warnHandler }) => {
        let user = m.mentionedJid && m.mentionedJid[0] || (m.quoted ? m.quoted.sender : null);
        await warnHandler(user);
    }
},

{
    command: ['conntest'],
    operate: async ({ Cypher, m, reply, isCreator, db }) => {
        if (!isCreator) return;

        let botVersion = 'unknown';
        try { botVersion = require('../../package.json').version || 'unknown'; } catch (_) {}

        const rawId   = global.Cypher?.user?.id || '';
        const bareJid = rawId.split(':')[0] + '@s.whatsapp.net';

        const statusMsg =
            `——『 BOTIFY-X 』——
` +
            `» Username: ${global.Cypher?.user?.name || global.ownernumber}
` +
            `» Platform: ${process.platform}
` +
            `» Prefix: [ ${db.settings.prefix ?? '.'} ]
` +
            `» Mode: ${db.settings.mode || 'private'}
` +
            `» Version: [ ${botVersion} ]
` +
            `» https://t.me/+yxIy3nwj6Ig4YjM0
` +
            `» https://t.me/botifyxspace`;

        await reply(\`Testing connection message...\nTarget: \${bareJid}\`);

        try {
            await global.Cypher.presenceSubscribe(bareJid).catch(() => {});
            const result = await global.Cypher.sendMessage(bareJid, { text: statusMsg });
            await reply(\`Result key: \${JSON.stringify(result?.key)}\`);
        } catch (err) {
            await reply(\`Failed: \${err.message}\`);
        }
    }
},
];
