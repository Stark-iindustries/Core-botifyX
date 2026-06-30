
const fs = require('fs');
const { exec } = require('child_process');
const { getRandom } = require('../../lib/myfunc');
const { toAudio } = require('../../lib/converter');

async function webp2mp4(source) {
  const fetch = require('node-fetch');
  const FormData = require('form-data');
  const cheerio = require('cheerio');

  let form = new FormData();
  let isUrl = typeof source === 'string' && /https?:\/\//.test(source);
  
  form.append('new-image-url', isUrl ? source : '');
  form.append('new-image', isUrl ? '' : source, 'image.webp');
  
  let res = await fetch('https://ezgif.com/webp-to-mp4', {
    method: 'POST',
    body: form
  });
  
  let html = await res.text();
  let $ = cheerio.load(html);
  let form2 = new FormData();
  let obj = {};
  
  $('form input[name]').each((_, el) => {
    obj[$(el).attr('name')] = $(el).val();
    form2.append($(el).attr('name'), $(el).val());
  });
  
  let res2 = await fetch('https://ezgif.com/webp-to-mp4/' + obj.file, {
    method: 'POST',
    body: form2
  });
  
  let html2 = await res2.text();
  let $2 = cheerio.load(html2);
  return new URL($2('div#output > p.outfile > video > source').attr('src'), res2.url).toString();
}

module.exports = [
 {
  command: ['volvideo'],
  operate: async ({ Cypher, m, reply, args, prefix, command }) => {
  
  const quoted = m.quoted ? m.quoted : null;
  const mime = quoted?.mimetype || "";
      
    if (!args.join(" ")) return reply(`*Example: ${prefix + command} 10*`);
   if (!quoted || !/video/.test(mime)) return reply(`Reply to an *video file* with *${prefix + command}* to adjust volume.`);

    try {
      const media = await Cypher.downloadAndSaveMediaMessage(quoted, "volume");
      const volvid = getRandom(".mp4");

      exec(`ffmpeg -i ${media} -filter:a volume=${args[0]} ${volvid}`, (err, stderr, stdout) => {
        fs.unlinkSync(media);
        if (err) return reply("*Error!*");

        const files = fs.readFileSync(volvid);
        Cypher.sendMessage(
          m.chat,
          { video: files, mimetype: "video/mp4" },
          { quoted: m }
        );
        fs.unlinkSync(volvid);
      });
    } catch (error) {
      console.error('Error processing video:', error);
      reply('An error occurred while processing the video.');
    }
  }
},
{
  command: ['toaudio'],
  operate: async ({ Cypher, m, reply }) => {
  const quoted = m.quoted ? m.quoted : null;
  const mime = quoted?.mimetype || "";
    if (!quoted) return reply('*Reply to a video to convert it to audio!*');
    if (!/video/.test(mime)) return reply('*Only videos can be converted to audio!*');

    try {
      let buffer = await quoted.download();
      let converted = await toAudio(buffer, 'mp4');

      await Cypher.sendMessage(m.chat, { audio: converted.data, mimetype: 'audio/mpeg' }, { quoted: m });
      await converted.delete();
    } catch (e) {
      console.error(e);
      reply('*Failed to convert video to audio!*');
    }
  }
},
{
  command: ['tovideo', 'tovid', 'tomp4'],
  operate: async ({ m, Cypher, reply, mess, prefix, command }) => {
    if (!m.quoted) return reply(`Reply to a sticker with caption *${prefix + command}*`);
    if (!m.quoted.mimetype.includes('webp')) return reply(`Please reply to a webp sticker`);
    
    try {
      const media = await m.quoted.download();
      const videoUrl = await webp2mp4(media);
      
      if (!videoUrl) throw new Error('Conversion failed');
      
      await Cypher.sendFile(m.chat, videoUrl, 'converted.mp4', '', m);
      
    } catch (error) {
      console.error(error);
      reply('❌ Failed to convert sticker to video. Please try again later.');
    }
  }
} 
];