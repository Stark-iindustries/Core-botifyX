const { fetchJson } = require('../../lib/myfunc');
const fetch = require('node-fetch'); 
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const yts = require('yt-search');

module.exports = [
 {
  command: ['apk', 'apkdl'],
  operate: async ({ m, text, Cypher, botname, reply }) => {
    if (!text) return reply("*Which apk do you want to download?*");
    
    try {
      let apiUrl = await fetchJson(`https://api.bk9.dev/search/apk?q=${text}`);
      let tylor = await fetchJson(`https://api.bk9.dev/download/apk?id=${apiUrl.BK9[0].id}`);

      await Cypher.sendMessage(
        m.chat,
        {
          document: { url: tylor.BK9.dllink },
          fileName: tylor.BK9.name,
          mimetype: "application/vnd.android.package-archive",
          contextInfo: {
            externalAdReply: {
              title: botname,
              body: `${tylor.BK9.name}`,
              thumbnailUrl: `${tylor.BK9.icon}`,
              sourceUrl: `${tylor.BK9.dllink}`,
              mediaType: 2,
              showAdAttribution: true,
              renderLargerThumbnail: false
            }
          }
        },
        { quoted: m }
      );
    } catch (error) {
      reply(global.mess.error);
    }
  }
 },
  {
  command: ['download'],
  operate: async ({ m, text, Cypher, reply }) => {
    if (!text) return reply('Enter download URL');
    
    try {
      let res = await fetch(text, { method: 'GET', redirect: 'follow' });
      let contentType = res.headers.get('content-type');
      let buffer = await res.buffer();
      let extension = contentType.split('/')[1]; 
      let filename = res.headers.get('content-disposition')?.match(/filename="(.*)"/)?.[1] || `download-${Math.random().toString(36).slice(2, 10)}.${extension}`;

      let mimeType;
      switch (contentType) {
        case 'audio/mpeg':
          mimeType = 'audio/mpeg';
          break;
        case 'image/png':
          mimeType = 'image/png';
          break;
        case 'image/jpeg':
          mimeType = 'image/jpeg';
          break;
        case 'application/pdf':
          mimeType = 'application/pdf';
          break;
        case 'application/zip':
          mimeType = 'application/zip';
          break;
        case 'video/mp4':
          mimeType = 'video/mp4';
          break;
        case 'video/webm':
          mimeType = 'video/webm';
          break;
        case 'application/vnd.android.package-archive':
          mimeType = 'application/vnd.android.package-archive';
          break;
        default:
          mimeType = 'application/octet-stream';
      }

      Cypher.sendMessage(m.chat, { document: buffer, mimetype: mimeType, fileName: filename }, { quoted: m });
    } catch (error) {
      reply(`Error downloading file: ${error.message}`);
    }
  }
},
  {
  command: ['facebook', 'fbdl'],
  operate: async ({ m, text, Cypher, reply }) => {
    if (!text) return reply(`*Please provide a Facebook video url!*`);
    
    try {
      var dlink = await fetchJson(`https://api-aswin-sparky.koyeb.app/api/downloader/fbdl?url=${text}`);
      var dlurl = dlink.data.high;
      
      await Cypher.sendMessage(m.chat, {
        video: {
          url: dlurl,
          caption: global.botname
        }
      }, {
        quoted: m
      });
    } catch (error) {
      reply(global.mess.error);
    }
  }
},
  {
  command: ['gdrive'],
  operate: async ({ Cypher, m, reply, text }) => {
    if (!text) return reply("*Please provide a Google Drive file URL*");

    try {
      let response = await fetch(`${global.siputzx}/api/d/gdrive?url=${encodeURIComponent(text)}`);
      let data = await response.json();

      if (response.status !== 200 || !data.status || !data.data) {
        return reply("*Please try again later or try another command!*");
      } else {
        const downloadUrl = data.data.download;
        const filePath = path.join(__dirname, `${data.data.name}`);

        const writer = fs.createWriteStream(filePath);
        const fileResponse = await axios({
          url: downloadUrl,
          method: 'GET',
          responseType: 'stream'
        });

        fileResponse.data.pipe(writer);

        writer.on('finish', async () => {
          await Cypher.sendMessage(m.chat, {
            document: { url: filePath },
            fileName: data.data.name,
            mimetype: fileResponse.headers['content-type']
          });

          fs.unlinkSync(filePath);
        });

        writer.on('error', (err) => {
          console.error('Error downloading the file:', err);
          reply("An error occurred while downloading the file.");
        });
      }
    } catch (error) {
      console.error('Error fetching Google Drive file details:', error);
      reply(global.mess.error);
    }
  }
},
  {
  command: ['gitclone'],
  operate: async ({ m, args, prefix, command, Cypher, reply, mess, isUrl }) => {
    if (!args[0])
      return reply(`*GitHub link to clone?*\nExample :\n${prefix}${command} https://github.com/Dark-Xploit/CypherX`);
    
    if (!isUrl(args[0]))
      return reply("*Link invalid! Please provide a valid URL.*");

    const regex1 = /(?:https|git)(?::\/\/|@)(www\.)?github\.com[\/:]([^\/:]+)\/(.+)/i;
    const [, , user, repo] = args[0].match(regex1) || [];
    
    if (!repo) {
      return reply("*Invalid GitHub link format. Please double-check the provided link.*");
    }
    
    const repoName = repo.replace(/.git$/, "");
    const url = `https://api.github.com/repos/${user}/${repoName}/zipball`;
    
    try {
      const response = await fetch(url, { method: "HEAD" });
      const filename = response.headers
        .get("content-disposition")
        .match(/attachment; filename=(.*)/)[1];
      
      await Cypher.sendMessage(
        m.chat,
        {
          document: { url: url },
          fileName: filename + ".zip",
          mimetype: "application/zip",
        },
        { quoted: m }
      );
    } catch (err) {
      console.error(err);
      reply(mess.error);
    }
  }
},
{
  command: ['image', 'img', 'pinterest'],
  operate: async ({ Cypher, m, reply, text }) => {
    if (!text) return reply("*Please provide a search query*");

    try {
      let response = await fetch(`https://api.vreden.my.id/api/pinterest?query=${encodeURIComponent(text)}`);
      let data = await response.json();

      if (response.status !== 200 || !data.result || data.result.length === 0) {
        return reply("*No images found or API error. Please try again later or try another query!*");
      } else {
        const images = data.result.slice(0, 5);

        for (const imageUrl of images) {
          await Cypher.sendMessage(m.chat, {
            image: { url: imageUrl },
            caption: `Search: ${text}`,
          });
          await new Promise(resolve => setTimeout(resolve, 500)); 
        }
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      reply(global.mess.error);
    }
  }
},
 {
  command: ['instagram', 'igdl'],
  operate: async ({ Cypher, m, reply, text }) => {
    if (!text) return reply('*Please provide an Instagram URL!*');

    const apiUrl = `${global.api}/igdl?url=${encodeURIComponent(text)}`;
    
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      if (!data || data.url.length === 0) return reply('*Failed to retrieve the video!*');

      const videoUrl = data.url;
      const title = `Instagram Video`;

      await Cypher.sendMessage(m.chat, {
        video: { url: videoUrl },
        mimetype: 'video/mp4',
        fileName: `${title}.mp4`
      }, { quoted: m });
    } catch (error) {
      console.error('Download command failed:', error);
      reply(global.mess.error);
    }
  }
},
  {
  command: ['itunes'],
  operate: async ({ m, text, Cypher, reply }) => {
    if (!text) return reply("*Please provide a song name*");
    
    try {
      let res = await fetch(`https://api.popcat.xyz/itunes?q=${encodeURIComponent(text)}`);
      if (!res.ok) {
        throw new Error(`*API request failed with status ${res.status}*`);
      }
      let json = await res.json();
      let songInfo = `*Song Information:*\n
 • *Name:* ${json.name}\n
 • *Artist:* ${json.artist}\n
 • *Album:* ${json.album}\n
 • *Release Date:* ${json.release_date}\n
 • *Price:* ${json.price}\n
 • *Length:* ${json.length}\n
 • *Genre:* ${json.genre}\n
 • *URL:* ${json.url}`;
     
      if (json.thumbnail) {
        await Cypher.sendMessage(
          m.chat,
          { image: { url: json.thumbnail }, caption: songInfo },
          { quoted: m }
        );
      } else {
        reply(songInfo);
      }
    } catch (error) {
      console.error(error);
      reply(global.mess.error);
    }
  }
},
  {
  command: ['mediafire'],
  operate: async ({ Cypher, m, reply, text }) => {
    if (!text) return reply("*Please provide a MediaFire file URL*");

    try {
      let response = await fetch(`${global.siputzx}/api/d/mediafire?url=${encodeURIComponent(text)}`);
      let data = await response.json();

      if (response.status !== 200 || !data.status || !data.data) {
        return reply("*Please try again later or try another command!*");
      } else {
        const downloadUrl = data.data.downloadLink;
        const filePath = path.join(__dirname, `${data.data.fileName}.zip`);

        const writer = fs.createWriteStream(filePath);
        const fileResponse = await axios({
          url: downloadUrl,
          method: 'GET',
          responseType: 'stream'
        });

        fileResponse.data.pipe(writer);

        writer.on('finish', async () => {
          
          await Cypher.sendMessage(m.chat, {
            document: { url: filePath },
            fileName: data.data.fileName,
            mimetype: 'application/zip'
          });

          fs.unlinkSync(filePath);
        });

        writer.on('error', (err) => {
          console.error('Error downloading the file:', err);
          reply("An error occurred while downloading the file.");
        });
      }
    } catch (error) {
      console.error('Error fetching MediaFire file details:', error);
      reply(global.mess.error);
    }
  }
},
 {
  command: ['song'],
  operate: async ({ Cypher, m, reply, text, fetchMp3DownloadUrl }) => {
    if (!text) return reply('*Please provide a song name!*');

    try {
      const search = await yts(text);
      if (!search || search.all.length === 0) return reply('*The song you are looking for was not found.*');

      const video = search.all[0];
      const downloadUrl = await fetchMp3DownloadUrl(video.url);

      await Cypher.sendMessage(m.chat, {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${video.title}.mp3`
      }, { quoted: m });

    } catch (error) {
      console.error('play command failed:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['song2'],
  operate: async ({ Cypher, m, reply, text, fetchMp3DownloadUrl }) => {
    if (!text) return reply('*Please provide a song name!*');

    try {
      const search = await yts(text);
      if (!search || search.all.length === 0) return reply('*The song you are looking for was not found.*');

      const video = search.all[0];
      
      const apiUrl = `${global.api}/ytmp3buffer?url=${encodeURIComponent(video.url)}`;
      
      const response = await axios.get(apiUrl);
      
      const downloadBuffer = response.data.downloadBuffer;
      
      const audioBuffer = Buffer.from(downloadBuffer, 'base64');
      
      await Cypher.sendMessage(m.chat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${video.title}.mp3`
      }, { quoted: m });

    } catch (error) {
      console.error('song command failed:', error);
      reply(global.mess.error);
    }
  }
},
  {
  command: ['play'],
  operate: async ({ Cypher, m, reply, text, fetchMp3DownloadUrl }) => {
    if (!text) return reply('*Please provide a song name!*');

    try {
      const search = await yts(text);
      if (!search || search.all.length === 0) return reply('*The song you are looking for was not found.*');

      const video = search.all[0];
      const downloadUrl = await fetchMp3DownloadUrl(video.url);

      await Cypher.sendMessage(m.chat, {
        document: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${video.title}.mp3`
      }, { quoted: m });

    } catch (error) {
      console.error('playdoc command failed:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['play2'],
  operate: async ({ Cypher, m, reply, text, fetchMp3DownloadUrl }) => {
    if (!text) return reply('*Please provide a song name!*');

    try {
      const search = await yts(text);
      if (!search || search.all.length === 0) return reply('*The song you are looking for was not found.*');

      const video = search.all[0];
      
      const apiUrl = `${global.api}/ytmp3buffer?url=${encodeURIComponent(video.url)}`;
      
      const response = await axios.get(apiUrl);
      
      const downloadBuffer = response.data.downloadBuffer;
      
      const audioBuffer = Buffer.from(downloadBuffer, 'base64');
      
      await Cypher.sendMessage(m.chat, {
        document: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${video.title}.mp3`
      }, { quoted: m });

    } catch (error) {
      console.error('playdoc command failed:', error);
      reply(global.mess.error);
    }
  }
},
  {
  command: ['savestatus', 'save'],
  operate: async ({ m, saveStatusMessage }) => {
    await saveStatusMessage(m);
  }
},
{
    command: ['telesticker', 'telegramsticker', 'tsticker'],
    operate: async (context) => {
        const { m, args, Cypher, prefix, command, reply, Telesticker } = context;

        if (!args[0] || !args[0].match(/(https:\/\/t.me\/addstickers\/)/gi)) {
            return reply(`*Telegram sticker link required*\nExample: ${prefix + command} https://t.me/addstickers/CypherX`);
        }

        try {
            await reply('*Fetching sticker pack...*');
            const startTime = Date.now();
            const stickers = await Telesticker(args[0]);
            
            if (!stickers || stickers.length === 0) {
                return reply('*No stickers found in this pack!*');
            }

            const isGroup = m.isGroup;
            const isLargePack = stickers.length > 30;
            const targetChat = isGroup && isLargePack ? m.sender : m.chat;
            
            if (isGroup && isLargePack) {
                await reply(`*Pack contains ${stickers.length} stickers. Sending to your DM...*`);
            } else {
                await reply(`*Sending ${stickers.length} stickers...*`);
            }

            for (let i = 0; i < stickers.length; i++) {
                try {
                    await Cypher.sendMessage(targetChat, {
                        sticker: { url: stickers[i].url }
                    });
                    
                    if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Error sending sticker ${i+1}:`, error.message);
                }
            }

            const duration = (Date.now() - startTime) / 1000;
            await reply(`✅ *Done!* Sent ${stickers.length} stickers in ${duration.toFixed(1)} seconds`);
            
        } catch (error) {
            console.error('Sticker command error:', error);
            reply(`*Error:* ${error.message || 'Failed to process sticker pack'}`);
        }
    }
},
 {
  command: ['tiktok', 'tikdl', 'tiktokvideo'],
  operate: async ({ m, args, fetchJson, Cypher, reply }) => {
    if (!args[0]) return reply('*Please provide a TikTok video url!*');
    
    try {
      let apiUrl = await fetchJson(`https://api-aswin-sparky.koyeb.app/api/downloader/tiktok?url=${args[0]}`);
      
      await Cypher.sendMessage(
        m.chat,
        {
          caption: global.wm,
          video: { url: apiUrl.data.video },
          fileName: "video.mp4",
          mimetype: "video/mp4",
        },
        { quoted: m }
      );
    } catch (error) {
      reply(global.mess.error);
    }
  }
},
 {
  command: ['tiktokaudio'],
  operate: async ({ m, args, fetchJson, Cypher, reply }) => {
    if (!args[0]) return reply('*Please provide a TikTok audio url!*');
    
    try {
      let apiUrl = await fetchJson(`https://api-aswin-sparky.koyeb.app/api/downloader/tiktok?url=${args[0]}`);
      
      await Cypher.sendMessage(
        m.chat,
        {
          audio: { url: apiUrl.data.audio },
          fileName: "tiktok.mp3",
          mimetype: "audio/mpeg",
        },
        { quoted: m }
      );
    } catch (error) {
      reply(global.mess.error);
    }
  }
},
{
  command: ['twitter', 'x', 'twdl', 'xvid'],
  desc: 'Download videos from Twitter/X',
  usage: '<Twitter URL>',
  operate: async ({ Cypher, m, reply, text }) => {
    if (!text) return reply("*Please provide a Twitter/X URL*\nExample: *!x https://twitter.com/9GAG/status/1661175429859012608*");

    try {
      if (!text.match(/https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i)) {
        return reply("*Invalid Twitter/X URL!* Please provide a valid status URL.");
      }

    //  const loadingMsg = await reply("*⏳ Downloading video... Please wait...*");

      // API request
      const encodedUrl = encodeURIComponent(text);
      const apiUrl = `https://api.siputzx.my.id/api/d/twitter?url=${encodedUrl}`;
      const response = await fetch(apiUrl);
      const data = await response.json();

     // await Cypher.sendMessage(m.chat, { delete: loadingMsg.key });

      if (!data.status || !data.data?.downloadLink) {
        return reply("*Failed to download video!* The API returned no valid download link.");
      }

      await Cypher.sendMessage(m.chat, {
        video: { url: data.data.downloadLink },
        caption: `*${data.data.videoTitle || 'Twitter Video'}*\n\n` +
                 `${data.data.videoDescription || ''}\n\n` +
                 `🔗 *Source:* ${text}`
      }, { quoted: m });

    } catch (error) {
      console.error('Twitter download error:', error);
      reply("*Error downloading video!* Please try again later.");
    }
  }
},
{
  command: ['video', 'ytmp4'],
  category: "Downloader",
  desc: "Download YouTube videos with quality selection",
  operate: async ({ Cypher, m, reply, text, fetchVideoDownloadUrl }) => {
    if (!text) return reply('*Please provide a YouTube URL or video name!*\n*Add quality like: .video url --quality 720p*');

    try {
      let videoUrl = text;
      let requestedQuality = null;
      
      if (text.includes('--quality')) {
        const parts = text.split('--quality');
        videoUrl = parts[0].trim();
        requestedQuality = parts[1] ? parts[1].trim().toLowerCase() : null;
      }
      
      if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
        const search = await yts(videoUrl);
        if (!search || search.videos.length === 0) return reply('*Video not found!*');
        
        const video = search.videos[0];
        videoUrl = video.url;
      }
      
      const videoData = await fetchVideoDownloadUrl(videoUrl);
      
      if (!videoData.BK9 || !videoData.BK9.formats || videoData.BK9.formats.length === 0) {
        return reply('*No downloadable formats found for this video!*');
      }

      const formats = videoData.BK9.formats;
      let selectedFormat = null;
      
      if (requestedQuality) {
        selectedFormat = formats.find(f => 
          f.quality.toLowerCase().includes(requestedQuality) && 
          f.has_video && 
          (f.has_audio || !requestedQuality.includes('p')) 
        );
      }

      if (!selectedFormat) {
        selectedFormat = formats.find(f => 
          f.extension === 'mp4' && f.has_audio && f.has_video
        ) || formats.find(f => f.has_video);
      }

      if (!selectedFormat || !selectedFormat.url) {
        return reply('*No downloadable video format available!*');
      }
      const videoInfo = `*${videoData.BK9.title || 'Unknown Title'}*\n\n` +
                       `*Duration:* ${videoData.BK9.duration || 'Unknown'}\n` +
                       `*Quality:* ${selectedFormat.quality}\n` +
                       `*Size:* ${selectedFormat.size || 'Unknown'}\n` +
                       `*Format:* ${selectedFormat.extension.toUpperCase()}`;

      await reply(videoInfo);
      
      await Cypher.sendMessage(m.chat, {
        video: { url: selectedFormat.url },
        mimetype: 'video/mp4',
        fileName: `${(videoData.BK9.title || 'video').replace(/[^\w\s]/gi, '')}.${selectedFormat.extension || 'mp4'}`,
        caption: `📥 *Downloaded successfully!*`
      }, { quoted: m });

    } catch (error) {
      console.error('Video command failed:', error);
      reply('❌ *Failed to download video. Please try again later.*');
    }
  }
},
{
  command: ['videodoc', 'ymp4doc'],
  category: "Downloader",
  desc: "Download YouTube videos with quality selection",
  operate: async ({ Cypher, m, reply, text, fetchVideoDownloadUrl }) => {
    if (!text) return reply('*Please provide a YouTube URL or video name!*\n*Add quality like: .video url --quality 720p*');

    try {
      let videoUrl = text;
      let requestedQuality = null;
      
      if (text.includes('--quality')) {
        const parts = text.split('--quality');
        videoUrl = parts[0].trim();
        requestedQuality = parts[1] ? parts[1].trim().toLowerCase() : null;
      }
      
      if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
        const search = await yts(videoUrl);
        if (!search || search.videos.length === 0) return reply('*Video not found!*');
        
        const video = search.videos[0];
        videoUrl = video.url;
      }
      
      const videoData = await fetchVideoDownloadUrl(videoUrl);
      
      if (!videoData.BK9 || !videoData.BK9.formats || videoData.BK9.formats.length === 0) {
        return reply('*No downloadable formats found for this video!*');
      }

      const formats = videoData.BK9.formats;
      let selectedFormat = null;
      
      if (requestedQuality) {
        selectedFormat = formats.find(f => 
          f.quality.toLowerCase().includes(requestedQuality) && 
          f.has_video && 
          (f.has_audio || !requestedQuality.includes('p')) 
        );
      }

      if (!selectedFormat) {
        selectedFormat = formats.find(f => 
          f.extension === 'mp4' && f.has_audio && f.has_video
        ) || formats.find(f => f.has_video);
      }

      if (!selectedFormat || !selectedFormat.url) {
        return reply('*No downloadable video format available!*');
      }
      const videoInfo = `*${videoData.BK9.title || 'Unknown Title'}*\n\n` +
                       `*Duration:* ${videoData.BK9.duration || 'Unknown'}\n` +
                       `*Quality:* ${selectedFormat.quality}\n` +
                       `*Size:* ${selectedFormat.size || 'Unknown'}\n` +
                       `*Format:* ${selectedFormat.extension.toUpperCase()}`;

      await reply(videoInfo);
      
      await Cypher.sendMessage(m.chat, {
        document: { url: selectedFormat.url },
        mimetype: 'video/mp4',
        fileName: `${(videoData.BK9.title || 'video').replace(/[^\w\s]/gi, '')}.${selectedFormat.extension || 'mp4'}`,
        caption: `📥 *Downloaded successfully!*`
      }, { quoted: m });

    } catch (error) {
      console.error('Video command failed:', error);
      reply('❌ *Failed to download video. Please try again later.*');
    }
  }
},
 {
  command: ['xvideos', 'porn', 'xdl'],
  operate: async ({ m, text, isCreator, reply, mess, Cypher, fetchJson, quoted }) => {
  if (!isCreator) return reply(mess.owner);
	if (!text) return reply('*Please provide a porn video search query!*');
    let kutu = await fetchJson(`https://api-aswin-sparky.koyeb.app/api/search/xnxx?search=${text}`)
	let apiUrl = await fetchJson(`https://api-aswin-sparky.koyeb.app/api/downloader/xnxx?url=${kutu.result.result[0].link}`)
await Cypher.sendMessage(m.chat, {
 video: {url: apiUrl.data.files.high}, 
 caption: global.wm,
 contextInfo: {
        externalAdReply: {
          title: global.botname,
          body: `${kutu.result.result[0].title}`,
          sourceUrl: `${kutu.result.result[0].link}`,
          mediaType: 2,
          mediaUrl: `${kutu.result.result[0].link}`,
        }
      }
    }, { quoted: m });
    
	let kyut = await fetchJson(`https://api-aswin-sparky.koyeb.app/api/downloader/xnxx?url=${kutu.result.result[1].link}`)
await Cypher.sendMessage(m.chat, {
 video: {url: kyut.data.files.high}, 
 caption: global.wm,
 contextInfo: {
        externalAdReply: {
          title: global.botname,
          body: `${kutu.result.result[1].title}`,
          sourceUrl: `${kutu.result.result[1].link}`,
          mediaType: 2,
          mediaUrl: `${kutu.result.result[1].link}`,
        }
      }
    }, { quoted: m });
  }
},
  {
  command: ['ytmp3'],
  operate: async ({ Cypher, m, reply, text, fetchMp3DownloadUrl }) => {
    if (!text) return reply('*Please provide a valid YouTube link!*');

    try {
      const urlMatch = text.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/gi);
      if (!urlMatch) return reply('*Seems like your message does not contain a valid YouTube link*');

      const link = urlMatch[0];
      const downloadUrl = await fetchMp3DownloadUrl(link);

      await Cypher.sendMessage(m.chat, {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg'
      }, { quoted: m });

    } catch (error) {
      console.error('ytmp3 command failed:', error);
      reply(global.mess.error);
    }
  }
},
 {
  command: ['ytmp3doc'],
  operate: async ({ Cypher, m, reply, text, fetchMp3DownloadUrl }) => {
    if (!text) return reply('*Please provide a valid YouTube link!*');

    try {
      const urlMatch = text.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/gi);
      if (!urlMatch) return reply('*Seems like your message does not contain a valid YouTube link*');

      const link = urlMatch[0];
      const downloadUrl = await fetchMp3DownloadUrl(link);
     const search = await yts(link);
     const name = search.all[0]; 

      await Cypher.sendMessage(m.chat, {
        document: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${name.title}.mp3`,
        caption: `${name.title}.mp3`
      }, { quoted: m });

    } catch (error) {
      console.error('ytmp3doc command failed:', error);
      reply(global.mess.error);
    }
  }
},
/*  {
  command: ['ytmp4'],
  operate: async ({ Cypher, m, reply, text, fetchVideoDownloadUrl }) => {
    if (!text) return reply('*Please provide a valid YouTube link!*');

    try {
      const urlMatch = text.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/gi);
      if (!urlMatch) return reply('*Seems like your message does not contain a valid YouTube link*');

      const link = urlMatch[0];
      const videoData = await fetchVideoDownloadUrl(link);

      await Cypher.sendMessage(m.chat, {
        video: { url: videoData.data.url },
        mimetype: 'video/mp4',
        fileName: `${videoData.data.title}.mp4`,
        caption: videoData.data.title
      }, { quoted: m });

    } catch (error) {
      console.error('ytmp4 command failed:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['ytmp4doc'],
  operate: async ({ Cypher, m, reply, text, fetchVideoDownloadUrl }) => {
    if (!text) return reply('*Please provide a valid YouTube link!*');

    try {
      const urlMatch = text.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/gi);
      if (!urlMatch) return reply('*Seems like your message does not contain a valid YouTube link*');

      const link = urlMatch[0];
      const videoData = await fetchVideoDownloadUrl(link);

      await Cypher.sendMessage(m.chat, {
        document: { url: videoData.data.url },
        mimetype: 'video/mp4',
        fileName: `${videoData.data.title}.mp4`,
        caption: videoData.data.title
      }, { quoted: m });

    } catch (error) {
      console.error('ytmp4doc command failed:', error);
      reply(global.mess.error);
    }
  }
}, */
];