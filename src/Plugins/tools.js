const fetch = require('node-fetch'); 
const googleTTS = require("google-tts-api"); 
const fs = require("fs");
const axios = require('axios');
const { exec } = require('child_process');
const { getRandom } = require('../../lib/myfunc');
const path = require('path');
const moment = require('moment-timezone');
const { addExif } = require('../../lib/exif');
const { handleMediaUpload } = require('../../lib/catbox');
const { getDevice } = require('@whiskeysockets/baileys');
const { obfuscateJS } = require("../Core/encapsulation.js");

module.exports = [
 {
  command: ['browse'],
  operate: async ({ m, text, Cypher, reply }) => {
    if (!text) return reply("Enter URL");

    try {
      let res = await fetch(text);

      if (res.headers.get('Content-Type').includes('application/json')) {
        let json = await res.json();
        await Cypher.sendMessage(m.chat, { text: JSON.stringify(json, null, 2) }, { quoted: m });
      } else {
        let resText = await res.text();
        await Cypher.sendMessage(m.chat, { text: resText }, { quoted: m });
      }

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    } catch (error) {
      reply(`Error fetching URL: ${error.message}`);
    }
  }
},
{
  command: ['calculate', 'solve', 'math', 'calc', 'equation'],
  operate: async ({ m, text, prefix, math, command, reply }) => {
    try {
      if (!text) return reply(`📝 *Examples:*\n${prefix}solve x^2 - 4 = 0\n${prefix}solve 2x + y = 5, x - y = 1\n${prefix}calculate 1mile to km`);

      const expr = text
        .replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/\^/g, '^')
        .replace(/deg/g, 'deg').replace(/,/g, ';');
    
      if (expr.includes('=')) {
        const [left, right] = expr.split('=').map(side => side.trim());
        const equation = `${left} - (${right})`;
        const variable = expr.match(/[a-zA-Z]+/)?.[0] || 'x';

        try {
          const func = math.compile(equation);
          const derivative = math.derivative(equation, variable);
          
          const solve = (x0, maxIter = 50) => {
            let x = x0;
            for (let i = 0; i < maxIter; i++) {
              const fx = func.evaluate({ [variable]: x });
              const dfx = derivative.evaluate({ [variable]: x });
              x = x - fx / dfx;
              if (Math.abs(fx) < 1e-10) break;
            }
            return x;
          };
          
       const guesses = [-10, -1, 0, 1, 10];
          const solutions = guesses
            .map(guess => solve(guess))
            .filter(x => !isNaN(x))
            .filter((x, i, arr) => arr.findIndex(y => math.abs(y - x) < 1e-6) === i);

          if (!solutions.length) reply("*No real solutions found.*");
          else reply(`*Solutions for ${variable}:*\n${solutions.map((sol, i) => `${variable}${i+1} = ${sol.toFixed(6)}`).join('\n')}`);
        } catch (error) {
          reply("*Could not solve symbolically. Try numeric methods.*");
        }
      }
 
      else if (text.includes('to')) {
        const [value, _, unit] = text.split(' ');
        const result = math.evaluate(`${value} ${unit}`);
        reply(`*Conversion:* ${value} = ${result}`);
      }
      
      else {
        const result = math.evaluate(expr);
        reply(`*Result:* ${result}`);
      }
    } catch (error) {
      reply(`❌ *Error:* ${error.message}\n💡 *Tip:* Use format: ${prefix}solve x^2 - 4 = 0`);
    }
  }
},
{
  command: ['getpp', 'getprofilepic'],
  operate: async ({ m, Cypher, reply, mess, isCreator }) => {
  if (!isCreator) return reply(mess.owner);
    if (!m.quoted) {
      return reply('Reply to a user to get their profile picture.');
    }

    const userId = m.quoted.sender;

    try {
      const ppUrl = await Cypher.profilePictureUrl(userId, 'image');

   await Cypher.sendMessage(m.chat, 
            { 
                image: { url: ppUrl }, 
                caption: `🔹 *Profile Picture of:* @${userId.split('@')[0]}`,
                mentions: [ userId ]
            }, { quoted: m }); 
    } catch {
      await Cypher.sendMessage(m.chat, { image: { url: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60' }, caption: '⚠️ No profile picture found.' }, { quoted: m });
    }
  }
},
{
  command: ['getabout'],
  operate: async ({ m, Cypher, reply, mess, isCreator }) => {
    if (!isCreator) return reply(mess.owner);
    if (!m.quoted) {
      return reply('Reply to a user to get their about/bio.');
    }

    const userId = m.quoted.sender;

    try {
      const { status, setAt } = await Cypher.fetchStatus(userId);
      const formattedDate = moment(setAt).format("MMMM Do YYYY, h:mm:ss A");

      await Cypher.sendMessage(m.chat, { 
        text: `🔹 *About of:* @${userId.split('@')[0]}\n\n"${status}"\n\n🕒 *Set at:* ${formattedDate}`,
        mentions: [userId] 
      }, { quoted: m });

    } catch {
      reply('⚠️ Unable to fetch the user’s about info. This may be due to their privacy settings.');
    }
  }
},
 {
  command: ['emojimix', 'emix'],
  operate: async ({ m, text, prefix, command, Cypher, fetchJson, reply }) => {
    let [emoji1, emoji2] = text.split`+`;
    
    if (!emoji1)
      return reply(`*Example : ${prefix + command} 😅+🤔*`);
    
    if (!emoji2)
      return reply(`*Example : ${prefix + command} 😅+🤔*`);
    
    try {
      let anu = await fetchJson(
        `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(
          emoji1
        )}_${encodeURIComponent(emoji2)}`
      );
      
      for (let res of anu.results) {
        await Cypher.sendImageAsSticker(
          m.chat,
          res.url,
          m,
          {
            packname: global.packname,
            author: global.author,
            categories: res.tags,
          }
        );
      }
    } catch (error) {
      console.error(error);
      reply('*An error occurred while fetching emoji mix.*');
    }
  }
},
 {
  command: ['fliptext'],
  operate: async ({ m, args, prefix, command, reply }) => {
    if (args.length < 1) return reply(`*Example:\n${prefix}fliptext Tylor*`);
    
    let flips = args.join(" ");
    let flipx = flips.split("").reverse().join("");
    
    reply(`Normal:\n${flips}\n\nFlip:\n${flipx}`);
  }
},
{
  command: ['gsmarena'],
  operate: async ({ m, reply, text }) => {
    if (!text) return reply("*Please provide a query to search for smartphones.*");

    try {
      const apiUrl = `${global.siputzx}/api/s/gsmarena?query=${encodeURIComponent(text)}`;
      const response = await fetch(apiUrl);
      const result = await response.json();

      if (!result.status || !result.data || result.data.length === 0) {
        return reply("*No results found. Please try another query.*");
      }

      const limitedResults = result.data.slice(0, 10);
      let responseMessage = `*Top 10 Results for "${text}":*\n\n`;

      for (let item of limitedResults) {
        responseMessage += `📱 *Name:* ${item.name}\n`;
        responseMessage += `📝 *Description:* ${item.description}\n`;
        responseMessage += `🌐 [View Image](${item.thumbnail})\n\n`;
      }

      reply(responseMessage);
    } catch (error) {
      console.error('Error fetching results from GSMArena API:', error);
      reply("❌ An error occurred while fetching results from GSMArena.");
    }
  }
},
 {
  command: ['genpass', 'genpassword'],
  operate: async ({ Cypher, m, reply, text }) => {
    let length = text ? parseInt(text) : 12;
    let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let pass = "";
    for (let i = 0; i < length; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    try {
      Cypher.sendMessage(m.chat, { text: pass }, { quoted: m });
    } catch (error) {
      console.error('Error generating password:', error);
      reply('An error occurred while generating the password.');
    }
  }
},
 {
  command: ['device', 'getdevice'],
  operate: async ({ Cypher, m, reply }) => {
    if (!m.quoted) {
      return reply('*Please quote a message to use this command!*');
    }
    
    console.log('Quoted Message:', m.quoted);
console.log('Quoted Key:', m.quoted?.key);

    try {
      const quotedMsg = await m.getQuotedMessage();

      if (!quotedMsg) {
        return reply('*Could not detect, please try with newly sent message!*');
      }

      const messageId = quotedMsg.key.id;

      const device = getDevice(messageId) || 'Unknown';

      reply(`The message is sent from *${device}* device.`);
    } catch (err) {
      console.error('Error determining device:', err);
      reply('Error determining device: ' + err.message);
    }
  }
},
  {
    command: ['obfuscate'],
    operate: async ({ m, reply, Cypher, from }) => {
  const quoted = m.quoted ? m.quoted : null;
  const mime = quoted?.mimetype || "";

  if (!quoted || mime !== "application/javascript") {
  return Cypher.sendMessage(m.chat, { text: "❌ *Error:* Reply to a `.js` file with `.obfuscate`!" }, { quoted: m });
          }
  try {
  const media = await quoted.download();
  const tempFile = `./tmp/original-${Date.now()}.js`;
  await fs.promises.writeFile(tempFile, media);

  Cypher.sendMessage(m.chat, { text: "🔒 Obfuscation started..." }, { quoted: m });

  const obfuscatedFile = await obfuscateJS(tempFile);

  await Cypher.sendMessage(m.chat, { text: "✅ Obfuscation complete! Sending file..." }, { quoted: m }); 
 
  await Cypher.sendMessage(m.chat, { document: fs.readFileSync(obfuscatedFile), mimetype: "text/javascript", fileName: "obfuscated.js" });

  await fs.promises.unlink(tempFile);
  await fs.promises.unlink(obfuscatedFile);
   } catch (error) {
  Cypher.sendMessage(from, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
        } 

  }
},
{
  command: ['filtervcf', 'cleanvcf'],
  operate: async ({ m, reply, Cypher, from }) => {
    const quoted = m.quoted ? m.quoted : null;
    const mime = quoted?.mimetype || "";
    const normalizePhoneNumber = (phone) => {
      if (!phone || typeof phone !== 'string') return null;
      return phone.replace(/\D/g, '');
    };

    if (!quoted || !(mime === "text/vcard" || mime === "text/x-vcard")) {
      return Cypher.sendMessage(m.chat, { 
        text: "❌ *Error:* Reply to a `.vcf` file with `.filtervcf` or `.cleanvcf`!" 
      }, { quoted: m });
    }

    try {
      const media = await quoted.download();
      const vcfContent = media.toString('utf8');
      
      await Cypher.sendMessage(m.chat, { 
        text: "🔍 Filtering VCF - checking WhatsApp numbers, this may take a while..." 
      }, { quoted: m });

      const vCards = vcfContent.split('END:VCARD')
        .map(card => card.trim())
        .filter(card => card.length > 0);

      const validContacts = [];
      const invalidContacts = [];
      let processed = 0;

      for (const card of vCards) {
        try {
          const telMatch = card.match(/TEL[^:]*:([^\n]+)/);
          if (!telMatch) continue;
          
          const phoneRaw = telMatch[1].trim();
          const phoneNumber = normalizePhoneNumber(phoneRaw);
          if (!phoneNumber) continue;

          const jid = `${phoneNumber}@s.whatsapp.net`;
          const result = await Cypher.onWhatsApp(jid);
          
          if (result.length > 0 && result[0].exists) {
            validContacts.push(card);
          } else {
            invalidContacts.push(phoneNumber);
          }
        } catch (error) {
          console.error('Error processing contact:', error);
        }
      }

      const filteredVcf = validContacts.join('\nEND:VCARD\n') + (validContacts.length > 0 ? '\nEND:VCARD' : '');
      
      const resultMessage = `✅ *VCF Filtering Complete*\n\n` +
        `• Total contacts: ${vCards.length}\n` +
        `• Valid WhatsApp contacts: ${validContacts.length}\n` +
        `• Non-WhatsApp numbers removed: ${invalidContacts.length}\n\n` +
        `Sending filtered VCF file...`;

      await Cypher.sendMessage(m.chat, { text: resultMessage }, { quoted: m });

      await Cypher.sendMessage(m.chat, { 
        document: Buffer.from(filteredVcf), 
        mimetype: "text/x-vcard", 
        fileName: "filtered_contacts.vcf" 
      });

    } catch (error) {
      await Cypher.sendMessage(from, { 
        text: `❌ *Error:* ${error.message}` 
      }, { quoted: m });
    }
  }
},
 {
  command: ['qrcode'],
  operate: async ({ Cypher, m, reply, text }) => {
    if (!text) return reply("Enter text or URL");

    try {
      let res = await fetch(`https://api.qrserver.com/v1/create-qr-code/?data=${text}&size=200x200`);
      let qrCodeUrl = res.url;

      await Cypher.sendMessage(m.chat, { image: { url: qrCodeUrl } }, { quoted: m });
    } catch (error) {
      console.error('Error generating QR code:', error);
      reply('An error occurred while generating the QR code.');
    }
  }
},
 {
  command: ['say', 'tts'],
  operate: async ({ m, args, reply, Cypher }) => {
    let text = args.join(" ");
    if (!text) return reply("*Text needed!*");

    try {
      const ttsData = await googleTTS.getAllAudioBase64(text, {
        lang: "en",
        slow: false,
        host: "https://translate.google.com",
        timeout: 10000,
      });

      if (!ttsData.length) return reply("*Failed to generate TTS audio.*");

      const tempFiles = [];
      for (let i = 0; i < ttsData.length; i++) {
        let filePath = `/tmp/tts_part${i}.mp3`;
        fs.writeFileSync(filePath, Buffer.from(ttsData[i].base64, "base64"));
        tempFiles.push(filePath);
      }

      
      let mergedFile = "/tmp/tts_merged.mp3";
      let ffmpegCommand = `ffmpeg -i "concat:${tempFiles.join('|')}" -acodec copy ${mergedFile}`;
      exec(ffmpegCommand, async (err) => {
        if (err) {
          console.error("FFmpeg error:", err);
          return reply("*Error merging audio files.*");
        }

        await Cypher.sendMessage(
          m.chat,
          {
            audio: fs.readFileSync(mergedFile),
            mimetype: "audio/mp4",
            ptt: true,
            fileName: "tts_audio.mp3",
          },
          { quoted: m }
        );

        tempFiles.forEach(file => fs.unlinkSync(file));
        fs.unlinkSync(mergedFile);
      });
    } catch (error) {
      console.error("Error in TTS Command:", error);
      reply("*An error occurred while processing the TTS request.*");
    }
  }
},
 {
  command: ['ssweb', 'screenshot', 'ss'],
  operate: async ({ Cypher, m, reply, args }) => {
    const q = args.join(" ");
    if (!q) return reply(`Please provide a URL to screenshot!`);
    
    const apiURL = `${global.siputzx}/api/tools/ssweb?url=${q}&theme=light&device=mobile`;
    
    try {
      await Cypher.sendMessage(m.chat, { image: { url: apiURL } }, { quoted: m });
    } catch (error) {
      console.error('Error generating screenshot:', error);
      reply("An error occurred while generating the image.");
    }
  }
},
 {
  command: ['sswebpc'],
  operate: async ({ Cypher, m, reply, args }) => {
    const q = args.join(" ");
    if (!q) return reply(`Please provide a URL to screenshot!`);
    
    const apiURL = `${global.siputzx}/api/tools/ssweb?url=${q}&theme=light&device=desktop`;
    
    try {
      await Cypher.sendMessage(m.chat, { image: { url: apiURL } }, { quoted: m });
    } catch (error) {
      console.error('Error generating screenshot:', error);
      reply("An error occurred.");
    }
  }
},
 {
  command: ['sswebtab'],
  operate: async ({ Cypher, m, reply, args }) => {
    const q = args.join(" ");
    if (!q) return reply(`Please provide a URL to screenshot!`);
    
    const apiURL = `${global.siputzx}/api/tools/ssweb?url=${q}&theme=light&device=tablet`;
    
    try {
      await Cypher.sendMessage(m.chat, { image: { url: apiURL } }, { quoted: m });
    } catch (error) {
      console.error('Error generating screenshot:', error);
      reply("An error occurred.");
    }
  }
},
 {
  command: ['sticker', 's'],
  operate: async ({ Cypher, m, reply, args, prefix, command }) => {
 
    const quoted = m.quoted || m.msg?.quoted;
    if (!quoted) {
      return reply(`Send or reply to images, videos, or gifs with captions ${prefix + command}`);
    }

    const mime = quoted.mimetype || quoted.msg?.mimetype;
    if (!mime) {
      return reply(`The quoted message does not contain media. Please send or reply to an image, video, or gif.`);
    }

    const swns = args.join(" ");
    const pcknms = swns.split("|")[0];
    const atnms = swns.split("|")[1];

    try {
      if (/image/.test(mime)) {
        const media = await quoted.download();
        await Cypher.sendImageAsSticker(m.chat, media, m, {
          packname: pcknms ? pcknms : global.packname,
          author: atnms ? atnms : global.author,
        });
      }
      else if (/video/.test(mime)) {
        if ((quoted.msg || quoted).seconds > 10) {
          return reply("The video length must be 10 seconds or less. Please try again.");
        }
        const media = await quoted.download();
        await Cypher.sendVideoAsSticker(m.chat, media, m, {
          packname: pcknms ? pcknms : global.packname,
          author: atnms ? atnms : global.author,
        });
      }
    
      else {
        return reply(`Send or reply to images, videos, or gifs with captions ${prefix + command}`);
      }
    } catch (error) {
      console.error('Error processing sticker:', error);
      reply('An error occurred while processing the sticker.');
    }
  }
},
{
  command: ['fancy', 'styletext'],
  operate: async ({ m, text, Cypher, reply }) => {
    if (!text) return reply('*Enter a text!*');

    try {
      const apiUrl = `${global.api}/styletext?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl);

      if (response.status !== 200 || !Array.isArray(response.data)) {
        throw new Error('Invalid response from StyleText API');
      }

      let teks = `*Styles for:* _${text}_\n\n`;
      response.data.forEach(({ name, result }) => {
        teks += `□ *${name}* : ${result || 'N/A'}\n\n`;
      });

      reply(teks);
    } catch (error) {
      console.error('Error fetching fancy text styles:', error);
      reply('*An error occurred while fetching fancy text styles.*');
    }
  }
},
 {
  command: ['take', 'wm', 'steal'],
  operate: async ({ Cypher, m, reply, args, pushname }) => {
    if (!m.quoted) return reply('Please reply to a sticker to add watermark or metadata.');

    try {
      let stick = args.join(" ").split("|");
      let packName = stick[0] && stick[0].trim() !== "" ? stick[0] : pushname || global.packname;
      let authorName = stick[1] ? stick[1].trim() : "";
      let mime = m.quoted.mimetype || '';
      if (!/webp/.test(mime)) return reply('Please reply to a sticker.');

      let stickerBuffer = await m.quoted.download();
      if (!stickerBuffer) return reply('Failed to download the sticker. Please try again.');

      let stickerWithExif = await addExif(stickerBuffer, packName, authorName);

      if (stickerWithExif) {
        await Cypher.sendFile(
          m.chat,
          stickerWithExif,
          'sticker.webp',
          '',
          m,
          null,
          { mentions: [m.sender] }
        );
      } else {
        throw new Error('Failed to process the sticker with metadata.');
      }
    } catch (error) {
      console.error('Error in watermark/sticker metadata plugin:', error);
      reply('An error occurred while processing the sticker.');
    }
  }
},
 {
  command: ['tinyurl', 'shortlink'],
  operate: async ({ m, text, prefix, command, reply }) => {
    if (!text) return reply(`*Example: ${prefix + command} https://instagram.com/heyits_tylor*`);
    
    try {
      const response = await axios.get(`https://tinyurl.com/api-create.php?url=${text}`);
      reply(response.data);
    } catch (error) {
      console.error(error);
      reply('*An error occurred while shortening the URL.*');
    }
  }
},
 {
  command: ['toimage', 'toimg'],
  operate: async ({ Cypher, m, reply, args, prefix, command }) => {
    const quoted = m.quoted || m.msg?.quoted;
    const mime = quoted?.mimetype || quoted?.msg?.mimetype;
    if (!quoted || !/webp/.test(mime)) {
      return reply(`*Send or reply to a sticker with the caption ${prefix + command}*`);
    }

    try {
      const media = await quoted.download();
      const inputPath = path.join(__dirname, getRandom('.webp'));
      fs.writeFileSync(inputPath, media);
      const outputPath = path.join(__dirname, getRandom('.png'));
      exec(`ffmpeg -i ${inputPath} ${outputPath}`, (err) => {
        fs.unlinkSync(inputPath); 

        if (err) {
          console.error('Error converting to image:', err);
          return reply('An error occurred while converting the sticker to an image.');
        }
        const buffer = fs.readFileSync(outputPath);
        Cypher.sendMessage(m.chat, { image: buffer }, { quoted: m });    
        fs.unlinkSync(outputPath);
      });
    } catch (error) {
      console.error('Error converting to image:', error);
      reply('An error occurred while converting the sticker to an image.');
    }
  }
},
 {
  command: ['tourl', 'url', 'upload'],
  operate: async ({ m, Cypher, reply }) => {
    const quoted = m.quoted || m.msg?.quoted;
    const mime = quoted?.mimetype || quoted?.msg?.mimetype;

    if (!quoted || !mime) {
      return reply('*Please reply to a media message!*');
    }

    try {
      const mediaUrl = await handleMediaUpload(quoted, Cypher, mime);
      reply(`*Uploaded successfully:*\n${mediaUrl}`);
    } catch (error) {
      console.error(error);
      reply('*An error occurred while uploading the media.*');
    }
  }
},
{
  command: ['translate', 'trt'],
  operate: async ({ m, args, prefix, command, reply }) => {
    const defaultLang = 'en'; // Default language for translation

    const supportedLangs = [
      'af', 'ar', 'az', 'be', 'bg', 'bn', 'bs', 'ca', 'ceb', 'co', 'cs', 'cy', 'da', 'de',
      'el', 'en', 'eo', 'es', 'et', 'eu', 'fa', 'fi', 'fr', 'fy', 'ga', 'gd', 'gl', 'gu',
      'ha', 'haw', 'hi', 'hmn', 'hr', 'ht', 'hu', 'hy', 'id', 'ig', 'is', 'it', 'ja', 'jv',
      'ka', 'kk', 'km', 'kn', 'ko', 'ku', 'ky', 'la', 'lb', 'lo', 'lt', 'lv', 'mg', 'mi',
      'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my', 'ne', 'nl', 'no', 'ny', 'or', 'pa', 'pl',
      'ps', 'pt', 'ro', 'ru', 'sd', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'st',
      'su', 'sv', 'sw', 'ta', 'te', 'tg', 'th', 'tr', 'uk', 'ur', 'uz', 'vi', 'xh', 'yi',
      'yo', 'zh', 'zu'
    ];

    const usageGuide = `
🚀 *How to Use the Translate Command:*

📌 *Example 1:* Translate text from any language to English
   - Command: ${prefix}${command} en [Your Text Here]
   - Usage: ${prefix}${command} en Hello World

📌 *Example 2:* Translate text to a specific language
   - Command: ${prefix}${command} <language_code> [Your Text Here]
   - Usage: ${prefix}${command} fr Bonjour tout le monde

🌐 *Supported Languages:*
${supportedLangs.join(', ')}

🛠 *Note:*
Ensure you use the correct language code for accurate translation.
`.trim();

    let lang = args[0]; 
    let text = args.slice(1).join(' ');

    if (!supportedLangs.includes(lang)) {
      lang = defaultLang;
      text = args.join(' ');
    }
    if (!text && m.quoted && m.quoted.text) text = m.quoted.text;
    if (!text) return reply(usageGuide);

    try {
      const apiUrl = `${global.api}/translate?text=${encodeURIComponent(text)}&lang=${lang}`;

      const response = await fetch(apiUrl);
      const result = await response.json();

      if (!result.translated) throw new Error('Translation failed.');

      reply(result.translated);

    } catch (error) {
      console.error('Translation Error:', error);
      reply('An error occurred while translating the text.');
    }
  }
},
{
  command: ['texttopdf', 'makepdf', 'pdf'],
  operate: async ({ m, reply, text, Cypher, generatePDF }) => {
    if (!text) return reply('Please provide text to convert to PDF. Example: .pdf Hello, world!');

    try {
      const pdfBuffer = await generatePDF(text);
      
      await Cypher.sendMessage(
        m.chat, 
        { 
          document: pdfBuffer, 
          fileName: 'converted_text.pdf', 
          mimetype: 'application/pdf' 
        }, 
        { quoted: m }
      );
      
    } catch (error) {
      console.error('PDF generation error:', error);
      reply('❌ Failed to generate PDF. Please try again.');
    }
  }
},
{
  command: ['vcc'],
  operate: async ({ m, reply, args }) => {

    const apiUrl = `${global.siputzx}/api/tools/vcc-generator?type=MasterCard&count=5`;

    try {
      const response = await fetch(apiUrl);
      const result = await response.json();

      if (!result.status || !result.data || result.data.length === 0) {
        return reply("❌ Unable to generate VCCs. Please try again later.");
      }

      let responseMessage = `🎴 *Generated VCCs* (Type: Mastercard and Count: 5):\n\n`;

      result.data.forEach((card, index) => {
        responseMessage += `#️⃣ *Card ${index + 1}:*\n`;
        responseMessage += `🔢 *Card Number:* ${card.cardNumber}\n`;
        responseMessage += `📅 *Expiration Date:* ${card.expirationDate}\n`;
        responseMessage += `🧾 *Cardholder Name:* ${card.cardholderName}\n`;
        responseMessage += `🔒 *CVV:* ${card.cvv}\n\n`;
      });

      reply(responseMessage);
    } catch (error) {
      console.error("Error fetching VCC data:", error);
      reply("An error occurred while generating VCCs. Please try again later.");
    }
  }
}
];