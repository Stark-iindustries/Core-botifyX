const axios = require("axios");
const { handleMediaUpload } = require('../../lib/catbox');

module.exports = [
{
  command: ['remini', 'enhance', 'hd'],
  react: "✨",
  operate: async ({ m, prefix, command, Cypher, mess, reply }) => {
    const quoted = m.quoted ? m.quoted : m.msg;
    const mime = quoted?.mimetype || "";

    if (!quoted) return reply("*Send or reply to an image.*");
    if (!/image/.test(mime)) return reply(`*Send or reply to an image with caption:* ${prefix + command}`);

    try {
      const media = await quoted.download();
      if (!media) return reply("❌ *Failed to download media. Try again.*");
      
      const mediaUrl = await handleMediaUpload(quoted, Cypher, mime);
      if (!mediaUrl) return reply("❌ *Failed to upload image for processing.*");

      const encodedUrl = encodeURIComponent(mediaUrl);
      const apiUrl = `https://api.siputzx.my.id/api/iloveimg/upscale?image=${encodedUrl}`;

      const resultsz = await axios.get(apiUrl);

      await Cypher.sendMessage(
        m.chat, 
        { 
          image: resultsz, 
          caption: "*🪄 Image enhanced successfully*" 
        }, 
        { quoted: m }
      );

    } catch (error) {
      console.error(error);
      reply("❌ *An error occurred while enhancing the image.*");
    }
  }
},
{
  command: ['wallpaper'],
  react: "🖼️",
  operate: async ({ m, text, Cypher, reply }) => {
    if (!text) return reply("📌 *Enter a search query.*");

    try {
      const apiUrl = `${global.api}/wallpaper?title=${encodeURIComponent(text)}&page=1`;
      const response = await axios.get(apiUrl);

      const results = response.data;
      if (!results.length) return reply("❌ *No wallpapers found.*");

      const randomWallpaper = results[Math.floor(Math.random() * results.length)];

      await Cypher.sendMessage(
        m.chat,
        {
          caption: `📌 *Title:* ${randomWallpaper.title || "Untitled"}\n📁 *Category:* ${randomWallpaper.type}\n🔗 *Source:* ${randomWallpaper.source || "N/A"}\n🖼️ *Media URL:* ${randomWallpaper.image[2] || randomWallpaper.image[1] || randomWallpaper.image[0]}`,
          image: { url: randomWallpaper.image[0] } 
        },
        { quoted: m }
      );
    } catch (error) {
      console.error(error);
      reply("❌ *An error occurred while fetching the wallpaper.*");
    }
  }
}
];