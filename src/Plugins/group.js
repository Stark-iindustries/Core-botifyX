const fs = require('fs'); 
const { sleep } = require('../../lib/myfunc');
const { generateProfilePicture } = require('@whiskeysockets/baileys');

const processCountryCode = (code) => {
  const cleanedCode = code.replace(/\D/g, '');
  if (cleanedCode.length < 1 || cleanedCode.length > 3) {
    return null; 
  }

  return cleanedCode;
};

module.exports = [
 {
    command: ['add'],
    operate: async (context) => {
        const { m, mess, text, isCreator, reply,Cypher } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isCreator) return reply(mess.owner);
        
        let bws = m.quoted
            ? m.quoted.sender
            : text.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        await Cypher.groupParticipantsUpdate(m.chat, [bws], "add");
        reply(mess.done);
    }
 },
{
    command: ['antibadword', 'antitoxic'],
    operate: async (context) => {
        const { m, db, from, isBotAdmins, isAdmins, isCreator, args, mess, command, reply } = context;

        if (!m.isGroup) return reply(mess.group);
        if (!isBotAdmins) return reply(mess.admin); 
        if (!isAdmins && !isCreator) return reply(mess.notadmin); 
        if (args.length < 2) return reply("*Usage: .antibadword <delete/kick> <on/off>*");

        const mode = args[0].toLowerCase();
        const state = args[1].toLowerCase();

        if (!["delete", "kick"].includes(mode)) {
            return reply("*Invalid mode! Use either 'delete' or 'kick'.*");
        }

        if (!["on", "off"].includes(state)) {
            return reply("*Invalid state! Use either 'on' or 'off'.*");
        }

        if (state === "on") {
            if (mode === "delete") {
                db.chats[from].badword = true;
                db.chats[from].badwordkick = false;
            } else if (mode === "kick") {
                db.chats[from].badwordkick = true;
                db.chats[from].badword = false;
            }
            reply(`*Successfully enabled antibadword ${mode} mode!*`);
        } else if (state === "off") {
            if (mode === "delete") {
                db.chats[from].badword = false;
            } else if (mode === "kick") {
                db.chats[from].badwordkick = false;
            }
            reply(`*Successfully disabled antibadword ${mode} mode!*`);
        }
    },
},
 {
    command: ['antibot'],
    operate: async (context) => {
        const { m, db, from, isBotAdmins, isAdmins, isCreator, args, mess, command, reply } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isBotAdmins) return reply(mess.admin);
        if (!isAdmins && !isCreator) return reply(mess.notadmin);
        if (args.length < 1) return reply("*on or off?*");
        if (args[0] === "on") {
            db.chats[from].antibot = true;
            reply(`*Successfully enabled ${command}*`);
        } else if (args[0] === "off") {
            db.chats[from].antibot = false;
            reply(`*Successfully disabled ${command}*`);
        }
    }
},
{
    command: ['antitag', 'antimention'],
    operate: async (context) => {
        const { m, db, from, isBotAdmins, isAdmins, isCreator, args, mess, command, reply } = context;

        if (!m.isGroup) return reply(mess.group);
        if (!isBotAdmins) return reply(mess.admin); 
        if (!isAdmins && !isCreator) return reply(mess.notadmin); 
        if (args.length < 2) return reply("*Usage: .antitag <delete/warn> <on/off>*");

        const mode = args[0].toLowerCase();
        const state = args[1].toLowerCase();

        if (!["delete", "warn"].includes(mode)) {
            return reply("*Invalid mode! Use either 'delete' or 'warn'.*");
        }

        if (!["on", "off"].includes(state)) {
            return reply("*Invalid state! Use either 'on' or 'off'.*");
        }

        if (state === "on") {
            if (mode === "delete") {
                db.chats[from].antitag = true;
                db.chats[from].antitagwarn = false;
            } else if (mode === "warn") {
                db.chats[from].antitagwarn = true;
                db.chats[from].antitag = false;
            }
            reply(`*Successfully enabled antitag ${mode} mode!*`);
        } else if (state === "off") {
            if (mode === "delete") {
                db.chats[from].antitag = false;
            } else if (mode === "warn") {
                db.chats[from].antitagwarn = false;
            }
            reply(`*Successfully disabled antitag ${mode} mode!*`);
        }
    },
},
{
    command: ['antitagadmin', 'antimentionadmin'],
    operate: async (context) => {
        const { m, db, from, isBotAdmins, isAdmins, isCreator, args, mess, command, reply } = context;

        if (!m.isGroup) return reply(mess.group);
        if (!isBotAdmins) return reply(mess.admin); 
        if (!isAdmins && !isCreator) return reply(mess.notadmin); 
        if (args.length < 2) return reply("*Usage: .antitagadmin <delete/warn> <on/off>*");

        const mode = args[0].toLowerCase();
        const state = args[1].toLowerCase();

        if (!["delete", "warn"].includes(mode)) {
            return reply("*Invalid mode! Use either 'delete' or 'warn'.*");
        }

        if (!["on", "off"].includes(state)) {
            return reply("*Invalid state! Use either 'on' or 'off'.*");
        }

        if (state === "on") {
            if (mode === "delete") {
                db.chats[from].antitagadmin = true;
                db.chats[from].antitagadminwarn = false;
            } else if (mode === "warn") {
                db.chats[from].antitagadminwarn = true;
                db.chats[from].antitagadmin = false;
            }
            reply(`*Successfully enabled anti-tagadmin ${mode} mode!*`);
        } else if (state === "off") {
            if (mode === "delete") {
                db.chats[from].antitagadmin = false;
            } else if (mode === "warn") {
                db.chats[from].antitagadminwarn = false;
            }
            reply(`*Successfully disabled anti-tagadmin ${mode} mode!*`);
        }
    },
},
{
    command: ['antigroupmention'],
    operate: async (context) => {
        const { m, db, from, isBotAdmins, isAdmins, isCreator, args, mess, reply } = context;

        if (!m.isGroup) return reply(mess.group); 
        if (!isBotAdmins) return reply(mess.admin); 
        if (!isAdmins && !isCreator) return reply(mess.notadmin); 
        if (args.length < 2) return reply("*Usage: .antigroupmention <delete/kick/warn> <on/off>*");

        const mode = args[0].toLowerCase();
        const state = args[1].toLowerCase();

        if (!["delete", "kick", "warn"].includes(mode)) {
            return reply("*Invalid mode! Use either 'delete', 'kick', or 'warn'.*");
        }

        if (!["on", "off"].includes(state)) {
            return reply("*Invalid state! Use either 'on' or 'off'.*");
        }

        if (state === "on") {
            db.chats[from].antigroupmention = false;
            db.chats[from].antigroupmentionkick = false;
            db.chats[from].antigroupmentionwarn = false;

            if (mode === "delete") db.chats[from].antigroupmention = true;
            else if (mode === "kick") db.chats[from].antigroupmentionkick = true;
            else if (mode === "warn") db.chats[from].antigroupmentionwarn = true;

            reply(`*Successfully enabled antigroupmention ${mode} mode!*`);
        } else if (state === "off") {
            if (mode === "delete" && db.chats[from].antigroupmention) db.chats[from].antigroupmention = false;
            else if (mode === "kick" && db.chats[from].antigroupmentionkick) db.chats[from].antigroupmentionkick = false;
            else if (mode === "warn" && db.chats[from].antigroupmentionwarn) db.chats[from].antigroupmentionwarn = false;
            
            reply(`*Successfully disabled antigroupmention ${mode} mode!*`);
        }
    }
},
{
    command: ['antilink'],
    operate: async (context) => {
        const { m, db, from, isBotAdmins, isAdmins, isCreator, args, mess, reply } = context;

        if (!m.isGroup) return reply(mess.group); 
        if (!isBotAdmins) return reply(mess.admin); 
        if (!isAdmins && !isCreator) return reply(mess.notadmin); 
        if (args.length < 2) return reply("*Usage: .antilink <delete/kick/warn> <on/off>*");

        const mode = args[0].toLowerCase();
        const state = args[1].toLowerCase();

        if (!["delete", "kick", "warn"].includes(mode)) {
            return reply("*Invalid mode! Use either 'delete', 'kick', or 'warn'.*");
        }

        if (!["on", "off"].includes(state)) {
            return reply("*Invalid state! Use either 'on' or 'off'.*");
        }

        if (state === "on") {
            db.chats[from].antilink = false;
            db.chats[from].antilinkkick = false;
            db.chats[from].antilinkwarn = false;

            if (mode === "delete") db.chats[from].antilink = true;
            else if (mode === "kick") db.chats[from].antilinkkick = true;
            else if (mode === "warn") db.chats[from].antilinkwarn = true;

            reply(`*Successfully enabled antilink ${mode} mode!*`);
        } else if (state === "off") {
            if (mode === "delete" && db.chats[from].antilink) db.chats[from].antilink = false;
            else if (mode === "kick" && db.chats[from].antilinkkick) db.chats[from].antilinkkick = false;
            else if (mode === "warn" && db.chats[from].antilinkwarn) db.chats[from].antilinkwarn = false;
            
            reply(`*Successfully disabled antilink ${mode} mode!*`);
        }
    }
},
  {
    command: ['antilinkgc'],
    operate: async (context) => {
        const { m, db, from, isBotAdmins, isAdmins, isCreator, args, mess, command, reply } = context;

        if (!m.isGroup) return reply(mess.group); 
        if (!isBotAdmins) return reply(mess.admin); 
        if (!isAdmins && !isCreator) return reply(mess.notadmin); 
        if (args.length < 2) return reply("*Usage: .antilinkgc <delete/kick> <on/off>*");

        const mode = args[0].toLowerCase();
        const state = args[1].toLowerCase();

        if (!["delete", "kick"].includes(mode)) {
            return reply("*Invalid mode! Use either 'delete' or 'kick'.*");
        }

        if (!["on", "off"].includes(state)) {
            return reply("*Invalid state! Use either 'on' or 'off'.*");
        }

        if (state === "on") {
            if (mode === "delete") {
                db.chats[from].antilinkgc = true;
                db.chats[from].antilinkgckick = false;
            } else if (mode === "kick") {
                db.chats[from].antilinkgckick = true;
                db.chats[from].antilinkgc = false;
            }
            reply(`*Successfully enabled antilinkgc ${mode} mode!*`);
        } else if (state === "off") {
            if (mode === "delete") {
                db.chats[from].antilinkgc = false;
            } else if (mode === "kick") {
                db.chats[from].antilinkgckick = false;
            }
            reply(`*Successfully disabled antilinkgc ${mode} mode!*`);
        }
    },
},
{
    command: ['allow'],
    operate: async (context) => {
        const { m, db, from, isAdmins, isCreator, args, reply, isBotAdmins, Cypher } = context;

        if (!m.isGroup) return reply(mess.group);
        if (!isBotAdmins) return reply(mess.admin);
        if (!isAdmins && !isCreator) return reply(mess.notadmin);

        let user = m.mentionedJid && m.mentionedJid[0] || (m.quoted ? m.quoted.sender : null);
        if (!user) return reply("*Mention or reply to a user to allow to send a link!*");

        if (!db.chats[from].allowedUsers) db.chats[from].allowedUsers = {};
        if (!db.chats[from].allowedUsers[user]) db.chats[from].allowedUsers[user] = 0;

        db.chats[from].allowedUsers[user]++;

  await Cypher.sendMessage(from,
       { text: `*@${user.split("@")[0]} has been allowed to send a link (${db.chats[from].allowedUsers[user]} chance(s)).*`,
    contextInfo: { mentionedJid: [user] },
                }, { quoted: m });
    }
},
{
    command: ['delallowed'],
    operate: async (context) => {
        const { m, db, from, isAdmins, isCreator, args, reply, isBotAdmins, Cypher } = context;

        if (!m.isGroup) return reply(mess.group);
        if (!isBotAdmins) return reply(mess.admin);
        if (!isAdmins && !isCreator) return reply(mess.notadmin);

        let user = m.mentionedJid && m.mentionedJid[0] || (m.quoted ? m.quoted.sender : null);
        if (!user) return reply("*Mention or reply to a user to remove from allowed link sender's list!*");

        if (!db.chats[from].allowedUsers || !db.chats[from].allowedUsers[user]) {
            return Cypher.sendMessage(from,
       { text: `*@${user.split("@")[0]} is not in the allowed list.*`,
    contextInfo: { mentionedJid: [user] },
                }, { quoted: m });
        }

        delete db.chats[from].allowedUsers[user];
        await Cypher.sendMessage(from,
       { text: `*@${user.split("@")[0]} is no longer allowed to send a link here.*`,
    contextInfo: { mentionedJid: [user] },
                }, { quoted: m });
    }
},
{
    command: ['listallowed'],
    operate: async (context) => {
        const { db, from, reply, m, Cypher } = context;

        if (!m.isGroup) return reply(mess.group);

        if (!db.chats[from] || !db.chats[from].allowedUsers || Object.keys(db.chats[from].allowedUsers).length === 0) {
            return reply("*No users are currently allowed to send links.*");
        }

        let allowedUsers = Object.entries(db.chats[from].allowedUsers)
            .map(([user, count]) => `@${user.split("@")[0]} (${count} chance(s))`)
            .join("\n");

   await Cypher.sendMessage(from, {
            text: `*Allowed Users List:*\n\n${allowedUsers}`,
            contextInfo: { mentionedJid: Object.keys(db.chats[from].allowedUsers) },
        }, { quoted: m });
    }
},
 {
  command: ['announcements'],
  operate: async ({ Cypher, m, reply, args, prefix, command, isCreator, mess, db, botNumber, saveDatabase }) => {
    if (!m.isGroup) return reply(mess.group); 
    if (!isCreator) return reply(mess.owner);
    if (args.length < 1) return reply(`Example: ${prefix + command} on/off`);

    const validOptions = ["on", "off"];
    const option = args[0].toLowerCase();

    if (!validOptions.includes(option)) return reply("Invalid option");

    db.chats[m.chat].announcements = option === "on";

    await saveDatabase();

    reply(`Settings announcement for this group ${option === "on" ? "enabled" : "disabled"} successfully`);
  }
},
  {
  command: ['antidemote'],
  operate: async ({ Cypher, m, reply, args, prefix, command, isCreator, mess, db, botNumber, saveDatabase, isAdmins, isBotAdmins }) => {
    if (!m.isGroup) return reply(mess.group); 
    if (!isBotAdmins) return reply(mess.admin); 
    if (!isAdmins && !isCreator) return reply(mess.notadmin); 
    if (args.length < 1) return reply(`Example: ${prefix + command} on/off`);

    const validOptions = ["on", "off"];
    const option = args[0].toLowerCase();

    if (!validOptions.includes(option)) return reply("Invalid option");

    db.chats[m.chat].antidemote = option === "on";

    await saveDatabase();

    reply(`Anti-demote has been ${option === "on" ? "enabled" : "disabled"} successfully in this group`);
  }
},
{
  command: ['antiforeign'],
  operate: async ({ Cypher, m, reply, args, prefix, command, isCreator, mess, db, botNumber, saveDatabase, isAdmins, isBotAdmins }) => {
    if (!m.isGroup) return reply(mess.group);
    if (!isBotAdmins) return reply(mess.admin);
    if (!isAdmins && !isCreator) return reply(mess.notadmin);
    if (args.length < 1) return reply(`Example: ${prefix + command} on/off`);

    const validOptions = ["on", "off"];
    const option = args[0].toLowerCase();

    if (!validOptions.includes(option)) return reply("Invalid option");

    db.chats[m.chat].antiforeign = option === "on";

    await saveDatabase();

    reply(`
      Anti-foreign has been ${option === "on" ? "enabled" : "disabled"} successfully in this group.
      New members whose country code isn't ${db.chats[m.chat].allowedCodes.length > 0 ? db.chats[m.chat].allowedCodes.join(", ") : "any specified country code"} will be automatically removed.
      
      To manage allowed country codes, use the following commands:
      - \`${prefix}addcode <countryCode>\` to add a country code.
      - \`${prefix}delcode <countryCode>\` to delete a country code.
      - \`${prefix}listcode\` to list all allowed country codes.
    `);
  }
},
{
  command: ['addcode'],
  operate: async ({ Cypher, m, reply, args, prefix, command, isCreator, mess, db, botNumber, saveDatabase, isAdmins, isBotAdmins }) => {
    if (!m.isGroup) return reply(mess.group);
    if (!isBotAdmins) return reply(mess.admin);
    if (!isAdmins && !isCreator) return reply(mess.notadmin);
    if (args.length < 1) return reply(`Example: ${prefix + command} <countryCode>`);

    const countryCode = processCountryCode(args[0]);

    if (!countryCode) {
      return reply("Invalid country code. Make sure it's 1-3 digits.");
    }

    if (db.chats[m.chat].allowedCodes.includes(countryCode)) {
      return reply(`Country code ${countryCode} is already in the allowed list.`);
    }

    db.chats[m.chat].allowedCodes.push(countryCode);
    await saveDatabase();

    reply(`Country code ${countryCode} has been successfully added to the allowed list.`);
  }
},
{
  command: ['delcode'],
  operate: async ({ Cypher, m, reply, args, prefix, command, isCreator, mess, db, botNumber, saveDatabase, isAdmins, isBotAdmins }) => {
    if (!m.isGroup) return reply(mess.group);
    if (!isBotAdmins) return reply(mess.admin);
    if (!isAdmins && !isCreator) return reply(mess.notadmin);
    if (args.length < 1) return reply(`Example: ${prefix + command} <countryCode>`);

    const countryCode = processCountryCode(args[0]);

    if (!countryCode) {
      return reply("Invalid country code. Make sure it's 1-3 digits.");
    }

    const codeIndex = db.chats[m.chat].allowedCodes.indexOf(countryCode);
    if (codeIndex === -1) {
      return reply(`Country code ${countryCode} is not in the allowed list.`);
    }

    db.chats[m.chat].allowedCodes.splice(codeIndex, 1);
    await saveDatabase();

    reply(`Country code ${countryCode} has been successfully removed from the allowed list.`);
  }
},
{
  command: ['listcode'],
  operate: async ({ Cypher, m, reply, args, prefix, command, isCreator, mess, db, botNumber }) => {
    if (!m.isGroup) return reply(mess.group);
    if (!isCreator) return reply(mess.owner);

    const allowedCodes = db.chats[m.chat].allowedCodes;

    if (allowedCodes.length === 0) {
      return reply("No country codes are currently allowed in this group.");
    }

    reply(`The allowed country codes in this group are: ${allowedCodes.join(", ")}`);
  }
},
{
  command: ['listactive'],
  operate: async ({ Cypher, m, reply, from, GroupDB }) => {
  if (!m.isGroup) return reply(mess.group);

    const activeUsers = await GroupDB.getActiveUsers(from);
    if (!activeUsers.length) return reply('*No active users found in this group.*');

    let message = `📊 *Active Users in Group*\n\n`;
    message += activeUsers.map((user, i) => `🔹 ${i + 1}. @${user.jid.split('@')[0]} - *${user.count} messages*`).join('\n');

    await Cypher.sendMessage(m.chat, { text: message, mentions: activeUsers.map(u => u.jid) }, { quoted: m });
  }
},
{
  command: ['listinactive'],
  operate: async ({ Cypher, m, reply, from, GroupDB }) => {
    if (!m.isGroup) return reply(mess.group);

    const metadata = await Cypher.groupMetadata(from);
    const allParticipants = metadata.participants.map(p => p.id);
    const activeUsers = await GroupDB.getActiveUsers(from);
    const activeJids = activeUsers.map(user => user.jid);

    const inactiveUsers = allParticipants.filter(jid => !activeJids.includes(jid));
    if (!inactiveUsers.length) return reply('*No inactive users found in this group.*');

    let message = `⚠️ *Inactive Users in Group*\n\n`;
    message += inactiveUsers.map((user, i) => `🔹 ${i + 1}. @${user.split('@')[0]}`).join('\n');

    await Cypher.sendMessage(m.chat, { text: message, mentions: inactiveUsers }, { quoted: m });
  }
},
{
    command: ['kickinactive'],
    operate: async ({ m, Cypher, reply, mess, isAdmins, isBotAdmins, GroupDB, prefix, command, kickQueue }) => {
    if (!m.isGroup) return reply(mess.group); 
    if (!isBotAdmins) return reply(mess.admin); 
    if (!isAdmins && !isCreator) return reply(mess.notadmin); 
      const groupMetadata = await Cypher.groupMetadata(m.chat);
      const groupAdmins = groupMetadata.participants.filter((p) => p.admin).map((p) => p.id);
      const groupMembers = groupMetadata.participants.map((user) => user.id);

      const activeUsers = await GroupDB.getActiveUsers(m.chat);
      const activeJids = activeUsers.map((user) => user.jid);

      let inactiveUsers = groupMembers.filter((jid) => !activeJids.includes(jid) && !groupAdmins.includes(jid));

      if (inactiveUsers.length === 0) return reply('✅ No inactive users found.');

      reply(`🚨 *Kicking inactive user's in 25 seconds...*\nUse *${prefix}cancelkick* before 25 seconds to cancel\n👥 Users: ${inactiveUsers.map((jid) => `@${jid.split('@')[0]}`).join(", ")}`, { mentions: inactiveUsers });

      kickQueue.set(m.chat, { type: 'inactive', users: inactiveUsers });

      setTimeout(async () => {
        if (!kickQueue.has(m.chat)) return;
        for (let user of inactiveUsers) {
          await Cypher.groupParticipantsUpdate(m.chat, [user], "remove");
        }
        reply('✅ Inactive users have been kicked.');
        kickQueue.delete(m.chat);
      }, 25000);
    }
},
{
    command: ['kickall'],
    operate: async ({ m, Cypher, reply, mess, isAdmins, isBotAdmins, isCreator, prefix, kickQueue }) => {
        if (!m.isGroup) return reply(mess.group); 
        if (!isBotAdmins) return reply(mess.admin); 
        if (!isAdmins && !isCreator) return reply(mess.notadmin); 

        const groupMetadata = await Cypher.groupMetadata(m.chat);
        const groupAdmins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
        const usersToKick = groupMetadata.participants
            .filter(user => !groupAdmins.includes(user.id) && !user.id.includes(Cypher.user.id))
            .map(user => user.id);

        if (usersToKick.length === 0) return reply('✅ No users to kick.');

        reply(
            `⚠️ *Kicking all members in 05 seconds...*\nUse *${prefix}cancelkick* to cancel\n👥 Affected:  ${usersToKick.map(jid => `@${jid.split('@')[0]}`).join(", ")}`,
            { mentions: usersToKick }
        );

        kickQueue.set(m.chat, { type: 'all', users: usersToKick });

        setTimeout(async () => {
            if (!kickQueue.has(m.chat)) return;
            
            await Cypher.groupParticipantsUpdate(m.chat, usersToKick, "remove");
            
            reply('✅ All members have been kicked.');
            kickQueue.delete(m.chat);
        }, 5000);
    }
},
{
    command: ['cancelkick'],
    operate: async ({ m, reply, isCreator, isBotAdmins, isAdmins, mess, kickQueue }) => {
        if (!m.isGroup) return reply(mess.group);
        if (!isBotAdmins) return reply(mess.admin);
        if (!isAdmins && !isCreator) return reply(mess.notadmin);

        console.log(`Checking kickQueue before cancel:`, kickQueue);
        console.log(`Checking m.chat:`, m.chat);

        if (!kickQueue.has(m.chat)) return reply('⚠️ No kick operation is pending.');

        kickQueue.delete(m.chat);
        reply('✅ Kick operation has been canceled.');
    }
},
{
  command: ['antipromote'],
  operate: async ({ Cypher, m, reply, args, prefix, command, isCreator, mess, db, botNumber, saveDatabase, isBotAdmins, isAdmins }) => {
    if (!m.isGroup) return reply(mess.group); 
    if (!isBotAdmins) return reply(mess.admin); 
    if (!isAdmins && !isCreator) return reply(mess.notadmin); 
    if (args.length < 1) return reply(`Example: ${prefix + command} on/off`);

    const validOptions = ["on", "off"];
    const option = args[0].toLowerCase();

    if (!validOptions.includes(option)) return reply("Invalid option");

    db.chats[m.chat].antipromote = option === "on";

    await saveDatabase();

    reply(`Anti-promote has been ${option === "on" ? "enabled" : "disabled"} successfully in this group`);
  }
},
  {
  command: ['welcome'],
  operate: async ({ Cypher, m, reply, args, prefix, command, isCreator, mess, db, botNumber, saveDatabase }) => {
    if (!m.isGroup) return reply(mess.group); 
    if (!isCreator) return reply(mess.owner);
    if (args.length < 1) return reply(`Example: ${prefix + command} on/off`);

    const validOptions = ["on", "off"];
    const option = args[0].toLowerCase();

    if (!validOptions.includes(option)) return reply("Invalid option");

    db.chats[m.chat].welcome = option === "on";

    await saveDatabase();

    reply(`Welcome and left messages ${option === "on" ? "enabled" : "disabled"} successfully for this group`);
  }
},
{
    command: ['approveall', 'acceptall'],
    operate: async ({ m, args, isCreator, reply, approveAllRequests, mess, isGroupAdmins, isBotAdmins }) => {
    if (!m.isGroup) return reply(mess.group);
    if (!isGroupAdmins) return reply(mess.admin);
    if (!isBotAdmins) return reply(mess.admin);
        
     const groupId = m.chat;
 
     await approveAllRequests(m, groupId);
    }
},
  {
    command: ['close'],
    operate: async (context) => {
        const { m, mess, isAdmins, isCreator, isBotAdmins, Cypher, reply } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isAdmins && !isCreator) return reply(mess.notadmin);
        if (!isBotAdmins) return reply(mess.admin);

        Cypher.groupSettingUpdate(m.chat, "announcement");
        reply("Group closed by admin. Only admins can send messages.");
    }
},
 {
    command: ['delppgroup'],
    operate: async (context) => {
        const { m, mess, isAdmins, isCreator, isBotAdmins, Cypher, reply, from } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isAdmins && !isCreator) return reply(mess.notadmin);
        if (!isBotAdmins) return reply(mess.admin);
        
        await Cypher.removeProfilePicture(from);
        reply("Group profile picture has been successfully removed.");
    }
}, 
{
  command: ['demote'],
  operate: async (context) => {
    const { m, mess, text, isAdmins, isGroupOwner, isCreator, isBotAdmins, Cypher, reply } = context;
    if (!m.isGroup) return reply(mess.group);
    if (!isAdmins && !isGroupOwner && !isCreator) return reply(mess.admin);
    if (!isBotAdmins) return reply(mess.admin);

    let target = m.mentionedJid[0] 
      ? m.mentionedJid[0] 
      : m.quoted 
      ? m.quoted.sender 
      : text.replace(/\D/g, "") 
      ? text.replace(/\D/g, "") + "@s.whatsapp.net" 
      : null;

    if (!target) return reply("⚠ *Mention or reply to a user to demote!*");

    try {
      await Cypher.groupParticipantsUpdate(m.chat, [target], "demote");
      reply(`✅ *User demoted successfully!*`);
    } catch (error) {
      reply("❌ *Failed to demote user. They might already be a member or the bot lacks permissions.*");
    }
  }
},
{
    command: ['disapproveall', 'rejectall'],
    operate: async ({ m, args, isCreator, reply, disapproveAllRequests, mess, isBotAdmins, isGroupAdmins }) => {
    if (!m.isGroup) return reply(mess.group);
    if (!isGroupAdmins) return reply(mess.admin);
    if (!isBotAdmins) return reply(mess.admin);
        
    const groupId = m.chat;
 
   await disapproveAllRequests(m, groupId);
    }
},
{
  command: ['getgrouppp', 'getgrouprofilepic'],
  operate: async ({ m, Cypher, reply, mess }) => {
    if (!m.isGroup) return reply(mess.group);

    try {
      const ppUrl = await Cypher.profilePictureUrl(m.chat, 'image');

      await Cypher.sendMessage(m.chat, 
        { 
          image: { url: ppUrl }, 
          caption: `🔹 *This Group's Profile Picture*`
        }, 
        { quoted: m }
      );
    } catch {
      await Cypher.sendMessage(m.chat, 
        { 
          image: { url: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60' }, 
          caption: '⚠️ No profile picture found for this group.'
        }, 
        { quoted: m }
      );
    }
  }
},
 {
    command: ['editsettings', 'editinfo'],
    operate: async (context) => {
        const { m, mess, args, isAdmins, isGroupOwner, isCreator, isBotAdmins, Cypher, prefix, command, reply } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isAdmins && !isGroupOwner && !isCreator) return reply(mess.admin);
        if (!isBotAdmins) return reply(mess.admin);

        if (args[0] === "on") {
            await Cypher.groupSettingUpdate(m.chat, "unlocked").then(
                (res) => reply(`*Successful, members can edit group info*`)
            );
        } else if (args[0] === "off") {
            await Cypher.groupSettingUpdate(m.chat, "locked").then((res) =>
                reply(`*Successful, members cannot edit group info*`)
            );
        } else {
            reply(`Example ${prefix + command} on/off`);
        }
    }
}, 
{
  command: ['link', 'linkgc', 'gclink', 'grouplink'],
  operate: async ({ Cypher, m, reply, isAdmins, isGroupOwner, isCreator, mess, isBotAdmins, groupMetadata }) => {
    if (!m.isGroup) return reply(mess.group);
    if (!isAdmins && !isGroupOwner && !isCreator) return reply(mess.admin);
    if (!isBotAdmins) return reply(mess.admin);

    try {
      let groupInvite = await Cypher.groupInviteCode(m.chat);
      let groupOwner = groupMetadata.owner ? `+${groupMetadata.owner.split('@')[0]}` : "Unknown";
      let groupLink = `https://chat.whatsapp.com/${groupInvite}`;
      let memberCount = groupMetadata.participants.length;

      let message = `🔗 *GROUP LINK*\n\n` +
                    `📌 *Name:* ${groupMetadata.subject}\n` +
                    `👑 *Owner:* ${groupOwner}\n` +
                    `🆔 *Group ID:* ${groupMetadata.id}\n` +
                    `👥 *Members:* ${memberCount}\n\n` +
                    `🌍 *Link:* ${groupLink}\n\n> ${global.wm}`;

      Cypher.sendMessage(m.chat, { text: message }, { detectLink: true });
    } catch (error) {
      reply("❌ *Failed to fetch group link. Make sure the bot has admin permissions.*");
    }
  }
},
 {
    command: ['hidetag', 'tag'], 
    operate: async (context) => {
        const { m, isCreator, mess, participants, Cypher, reply } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isCreator) return reply(mess.owner);
        const quotedText = m.quoted ? m.quoted.text : null;
        const providedText = m.text?.split(" ").slice(1).join(" ") || null;
        const textToSend = quotedText || providedText || "No message provided";
        await Cypher.sendMessage(
            m.chat,
            {
                text: textToSend,
                mentions: participants.map((a) => a.id),
            },
            {
                quoted: m,
            }
        );
    }
},
  {
    command: ['invite'],
    operate: async (context) => {
        const { m, mess, text, prefix, Cypher, isBotAdmins, reply } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isBotAdmins) return reply(mess.admin);
        if (!text)
            return reply(
                `*Enter the number you want to invite to this group*\n\nExample :\n${prefix + command} 254796180105`
            );
        if (text.includes("+"))
            return reply(`*Enter the number together without* *+*`);
        if (isNaN(text))
            return reply(
                `*Enter only the numbers with your country code without spaces*`
            );

        let group = m.chat;
        let link = "https://chat.whatsapp.com/" + (await Cypher.groupInviteCode(group));
        await Cypher.sendMessage(text + "@s.whatsapp.net", {
            text: `*GROUP INVITATION*\n\n${m.sender.split('@')[0]} invites you to join this group: \n\n${link}`,
            mentions: [m.sender],
        });
        reply(`*Successfully sent invite link*`);
    }
},
{
  command: ['kick', 'remove'],
  operate: async (context) => {
    const { m, mess, text, isAdmins, isGroupOwner, isCreator, isBotAdmins, Cypher, reply } = context;
    if (!m.isGroup) return reply(mess.group);
    if (!isAdmins && !isGroupOwner && !isCreator) return reply(mess.admin);
    if (!isBotAdmins) return reply(mess.admin);

    let target = m.mentionedJid[0] 
      ? m.mentionedJid[0] 
      : m.quoted 
      ? m.quoted.sender 
      : text.replace(/[^0-9]/g, "") 
      ? text.replace(/[^0-9]/g, "") + "@s.whatsapp.net" 
      : null;

    if (!target) {
      return reply("⚠ *Mention or reply to a user to remove!*");
    }

    try {
      await Cypher.groupParticipantsUpdate(m.chat, [target], "remove");
      reply(`✅ *User removed successfully!*`);
    } catch (error) {
      reply("❌ *Failed to remove user. They might be an admin or the bot lacks permissions.*");
    }
  }
},
{
    command: ['listrequests', 'pendingrequests'],
    operate: async ({ m, args, isCreator, reply, listGroupRequests, mess, isBotAdmins, isGroupAdmins }) => {
    if (!m.isGroup) return reply(mess.group);
    if (!isGroupAdmins) return reply(mess.admin);
    if (!isBotAdmins) return reply(mess.admin);
        
    const groupId = m.chat; 

    await listGroupRequests(m, groupId);
    }
},
  {
    command: ['mediatag'],
    operate: async (context) => {
        const { m, isAdmins, mess, participants, Cypher, isBotAdmins, reply } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isBotAdmins) return reply(mess.admin);
        if (!isAdmins) return reply(mess.admin);
        if (!m.quoted) return reply(`Reply to any media with caption ${prefix + command}`);

        Cypher.sendMessage(m.chat, {
          forward: m.quoted.fakeObj,
          mentions: participants.map((a) => a.id),
        });
    }
},
 {
    command: ['open'],
    operate: async (context) => {
        const { m, mess, isAdmins, isCreator, isBotAdmins, Cypher, reply } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isAdmins && !isCreator) return reply(mess.notadmin);
        if (!isBotAdmins) return reply(mess.admin);

        Cypher.groupSettingUpdate(m.chat, "not_announcement");
        reply("Group opened by admin. Members can now send messages.");
    }
},
{
    command: ['closetime'],
    operate: async (context) => {
        const { m, mess, args, isAdmins, isCreator, isBotAdmins, Cypher, reply } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isAdmins && !isCreator) return reply(mess.notadmin);
        if (!isBotAdmins) return reply(mess.admin);

        if (args.length < 2) {
            return reply("*Usage:*\n.closetime <number> <unit>\n\n*Units:*\nseconds, minutes, hours, days\n\n*Example:*\n.closetime 10 seconds\n.closetime 1 hour");
        }

        const duration = parseInt(args[0]);
        const unit = args[1]?.toLowerCase();

        if (isNaN(duration) || duration <= 0) {
            return reply("❌ *Invalid duration! Enter a valid number.*\n\nExample:\n.closetime 5 minutes");
        }

        let timer;
        switch (unit) {
            case "seconds":
            case "second":
                timer = duration * 1000;
                break;
            case "minutes":
            case "minute":
                timer = duration * 60000;
                break;
            case "hours":
            case "hour":
                timer = duration * 3600000;
                break;
            case "days":
            case "day":
                timer = duration * 86400000;
                break;
            default:
                return reply("*Invalid unit! Choose from:*\nseconds, minutes, hours, days\n\nExample:\n.closetime 5 minutes");
        }

        reply(`⏳ *Closing group in ${duration} ${unit}...*`);
        setTimeout(() => {
            Cypher.groupSettingUpdate(m.chat, "announcement");
            reply("🔒 *Group closed!* Now only admins can send messages.");
        }, timer);
    }
},

{
    command: ['opentime'],
    operate: async (context) => {
        const { m, mess, args, isAdmins, isCreator, isBotAdmins, Cypher, reply } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isAdmins && !isCreator) return reply(mess.notadmin);
        if (!isBotAdmins) return reply(mess.admin);

        if (args.length < 2) {
            return reply("*Usage:*\n.opentime <number> <unit>\n\n*Units:*\nseconds, minutes, hours, days\n\n*Example:*\n.opentime 10 seconds\n.opentime 1 hour");
        }

        const duration = parseInt(args[0]);
        const unit = args[1]?.toLowerCase();

        if (isNaN(duration) || duration <= 0) {
            return reply("❌ *Invalid duration! Enter a valid number.*\n\nExample:\n.opentime 5 minutes");
        }

        let timer;
        switch (unit) {
            case "seconds":
            case "second":
                timer = duration * 1000;
                break;
            case "minutes":
            case "minute":
                timer = duration * 60000;
                break;
            case "hours":
            case "hour":
                timer = duration * 3600000;
                break;
            case "days":
            case "day":
                timer = duration * 86400000;
                break;
            default:
                return reply("*Invalid unit! Choose from:*\nseconds, minutes, hours, days\n\nExample:\n.opentime 5 minutes");
        }

        reply(`⏳ *Opening group in ${duration} ${unit}...*`);
        setTimeout(() => {
            Cypher.groupSettingUpdate(m.chat, "not_announcement");
            reply("🔓 *Group opened!* Members can now send messages.");
        }, timer);
    }
},
 {
    command: ['poll'],
    operate: async (context) => {
        const { m, mess, text, isCreator, prefix, Cypher, isGroup, reply } = context;
        if (!isCreator) return reply(mess.owner);
        if (!m.isGroup) return reply(mess.group);
        let [poll, opt] = text.split("|");
        if (text.split("|") < 2)
            return await reply(
                `Enter a question and at least 2 options\nExample: ${prefix}poll Who is best player?|Messi,Ronaldo,None...`
            );
        let options = [];
        for (let i of opt.split(",")) {
            options.push(i);
        }
        
        await Cypher.sendMessage(m.chat, {
            poll: {
                name: poll,
                values: options,
            },
        });
    }
},
{
  command: ['promote'],
  operate: async (context) => {
    const { m, mess, text, isAdmins, isGroupOwner, isCreator, isBotAdmins, Cypher, reply } = context;
    if (!m.isGroup) return reply(mess.group);
    if (!isAdmins && !isGroupOwner && !isCreator) return reply(mess.admin);
    if (!isBotAdmins) return reply(mess.admin);

    let target = m.mentionedJid[0] 
      ? m.mentionedJid[0] 
      : m.quoted 
      ? m.quoted.sender 
      : text.replace(/\D/g, "") 
      ? text.replace(/\D/g, "") + "@s.whatsapp.net" 
      : null;

    if (!target) return reply("⚠ *Mention or reply to a user to promote!*");

    try {
      await Cypher.groupParticipantsUpdate(m.chat, [target], "promote");
      reply(`✅ *User promoted successfully!*`);
    } catch (error) {
      reply("❌ *Failed to promote user. They might already be an admin or the bot lacks permissions.*");
    }
  }
},
 {
    command: ['resetlink'],
    operate: async (context) => {
        const { m, isAdmins, isGroupOwner, isCreator, mess, Cypher, isBotAdmins, reply } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isAdmins && !isGroupOwner && !isCreator) return reply(mess.admin);
        if (!isBotAdmins) return reply(mess.admin);

        await Cypher.groupRevokeInvite(m.chat).then((res) => {
          reply(mess.done);
        });
    }
},
  {
    command: ['setdesc', 'setdescription'],
    operate: async (context) => {
        const { m, mess, text, isAdmins, isGroupOwner, isCreator, isBotAdmins, Cypher, reply } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isAdmins && !isGroupOwner && !isCreator) return reply(mess.notadmin);
        if (!isBotAdmins) return reply(mess.admin);
        if (!text) return reply("*Please enter a text*");
        
        await Cypher.groupUpdateDescription(m.chat, text);
        reply(mess.done);
    }
},
  {
    command: ['setgroupname', 'setgcname'],
    operate: async (context) => {
        const { m, mess, text, isAdmins, isGroupOwner, isCreator, isBotAdmins, Cypher, reply } = context;
        if (!m.isGroup) return reply(mess.group);
        if (!isAdmins && !isGroupOwner && !isCreator) return reply(mess.admin);
        if (!isBotAdmins) return reply(mess.admin);
        if (!text) return reply("*Desired groupname?*");

        await Cypher.groupUpdateSubject(m.chat, text);
        reply(mess.done);
    }
},
  {
  command: ['setppgroup'],
  operate: async ({ m, reply, mess, isAdmins, isCreator, isBotAdmins, Cypher, quoted, mime, prefix, command, args }) => {
    if (!m.isGroup) return reply(mess.group);
    if (!isAdmins && !isCreator) return reply(mess.notadmin);
    if (!isBotAdmins) return reply(mess.admin);
    if (!quoted) return reply(`*Send or reply to an image with the caption ${prefix + command}*`);
    if (!/image/.test(mime)) return reply(`*Send or reply to an image with the caption ${prefix + command}*`);
    if (/webp/.test(mime)) return reply(`*Send or reply to an image with the caption ${prefix + command}*`);

    const medis = await Cypher.downloadAndSaveMediaMessage(quoted, "ppbot.jpeg");
    if (args[0] === "full") {
      const { img } = await generateProfilePicture(medis);
      await Cypher.query({
        tag: "iq",
        attrs: {
          to: m.chat,
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
      reply("Group profile picture has been successfully set.");
    } else {
      await Cypher.updateProfilePicture(m.chat, { url: medis });
      fs.unlinkSync(medis);
      reply("Group profile picture has been successfully updated.");
    }
  }
},
{
  command: ['tagadmin', 'listadmin', 'admin'],
  operate: async ({ Cypher, m, reply, mess, participants, groupMetadata }) => {
    if (!m.isGroup) return reply(mess.group);

    const groupAdmins = participants.filter((p) => p.admin);
    const listAdmin = groupAdmins
      .map((v, i) => `${i + 1}. @${v.id.split("@")[0]}`)
      .join("\n");
    const owner = groupMetadata.owner || groupAdmins.find((p) => p.admin === "superadmin")?.id || m.chat.split`-`[0] + "@s.whatsapp.net";
    let text = `*Group Admins Here:*\n${listAdmin}`.trim();

    Cypher.sendMessage(
      m.chat,
      { text: text, mentions: [...groupAdmins.map((v) => v.id), owner] },
      { quoted: m }
    );
  }
}, 
 {
    command: ['tagall'],
    operate: async (context) => {
        const { m, isCreator, mess, q, participants, Cypher, reply } = context;
     if (!m.isGroup) return reply(mess.group);
     if (!isCreator) return reply(mess.owner);

        let me = m.sender;
        let teks = `*TAGGED BY:*  @${
          me.split("@")[0]
        }\n\n*MESSAGE:* ${q ? q : "No message"}\n\n`;
        for (let mem of participants) {
          teks += `@${mem.id.split("@")[0]}\n`;
        }
        Cypher.sendMessage(
          m.chat,
          {
            text: teks,
            mentions: participants.map((a) => a.id),
          },
          {
            quoted: m,
          }
        );
    }
},
 {
  command: ['totalmembers'],
  operate: async ({ Cypher, m, reply, mess, participants, isCreator, sleep, groupMetadata }) => {
    if (!m.isGroup) return reply(mess.group);
    if (!isCreator) return reply(mess.owner);

    await Cypher.sendMessage(
      m.chat,
      {
        text: `*GROUP*: ${groupMetadata.subject}\n*MEMBERS*: ${participants.length}`,
      },
      { quoted: m, ephemeralExpiration: 86400 }
    );
  }
},
  {
    command: ['userid', 'userjid'],
    operate: async (context) => {
        const { m, mess, isCreator, Cypher, reply } = context;
        if (!isCreator) return reply(mess.owner);
        if (!m.isGroup) return reply(mess.group);

        const groupMetadata = m.isGroup
            ? await Cypher.groupMetadata(m.chat).catch((e) => {})
            : "";
        const participants = m.isGroup
            ? await groupMetadata.participants
            : "";
        let textt = `Here is jid address of all users of\n *${groupMetadata.subject}*\n\n`;
        for (let mem of participants) {
            textt += `□ ${mem.id}\n`;
        }
        reply(textt);
    }
},
 {
  command: ['vcf'],
  operate: async ({ Cypher, m, reply, mess, participants, isCreator, groupMetadata }) => {
    if (!m.isGroup) return reply(mess.group);
    if (!isCreator) return reply(mess.owner);

    let details = await Cypher.groupMetadata(m.chat);
    let vcard = "";
    let noPort = 0;
    for (let a of details.participants) {
      vcard += `BEGIN:VCARD\nVERSION:3.0\nFN:[${noPort++}] +${a.id.split("@")[0]}\nTEL;type=CELL;type=VOICE;waid=${a.id.split("@")[0]}:+${a.id.split("@")[0]}\nEND:VCARD\n`;
    }
    let nmfilect = "./contacts.vcf";
    reply(`\nPlease wait, saving ${details.participants.length} contacts`);

    fs.writeFileSync(nmfilect, vcard.trim());
    await sleep(2000);
    Cypher.sendMessage(
      m.chat,
      {
        document: fs.readFileSync(nmfilect),
        mimetype: "text/vcard",
        fileName: "Contact.vcf",
        caption: `Group: *${details.subject}*\nContacts: *${details.participants.length}*`,
      },
      { ephemeralExpiration: 86400, quoted: m }
    );
    fs.unlinkSync(nmfilect);
  }
},
];