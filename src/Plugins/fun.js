const { getBuffer } = require('../../lib/myfunc');
const axios = require('axios'); 
const fetch = require('node-fetch');


module.exports = [
 {
  command: ['fact'],
  react: "ℹ️",
  operate: async ({ m, reply }) => {
    try {
      const { data } = await axios.get(`https://nekos.life/api/v2/fact`);
      return reply(`*FACT:* ${data.fact}\n`);
    } catch (err) {
      console.error(err);
      return reply('*An error occurred while fetching the fact.*');
    }
  }
},
 {
  command: ['jokes', 'joke'],
  react: "😂",
  operate: async ({ Cypher, m, reply }) => {
    try {
      let res = await fetch("https://api.chucknorris.io/jokes/random");
      let json = await res.json();
      await Cypher.sendMessage(m.chat, { text: json.value }, { quoted: m });
    } catch (error) {
      console.error('Error fetching joke:', error);
      reply('An error occurred while fetching a joke.');
    }
  }
},
 {
  command: ['memes', 'meme'],
  react: "🤣",
  operate: async ({ Cypher, m, reply }) => {
    try {
      let res = await fetch("https://api.imgflip.com/get_memes");
      let json = await res.json();

      for (let i = 0; i < 5; i++) {
        let meme = json.data.memes[i];
        await Cypher.sendMessage(m.chat, { image: { url: meme.url } }, { quoted: m });
      }
    } catch (error) {
      console.error('Error fetching memes:', error);
      reply('An error occurred while fetching memes.');
    }
  }
},
 {
  command: ['quotes'],
  react: "💬",
  operate: async ({ m, reply }) => {
    try {
      const { data } = await axios.get(`https://favqs.com/api/qotd`);
      const textquotes = `*QUOTE:* ${data.quote.body}\n\n*AUTHOR:* ${data.quote.author}`;
      return reply(textquotes);
    } catch (err) {
      console.error(err);
      return reply('*An error occurred while fetching the quote.*');
    }
  }
},
 {
  command: ['trivia'],
  react: "❓",
  operate: async ({ Cypher, m, reply }) => {
    try {
      let res = await fetch("https://opentdb.com/api.php?amount=1");
      let json = await res.json();

      let question = json.results[0].question;
      let answer = json.results[0].correct_answer;

      await Cypher.sendMessage(m.chat, { text: `Question: ${question}\n\nThink you know the answer? Sending the correct answer after 20 seconds` }, { quoted: m });
      
      setTimeout(async () => {
        await Cypher.sendMessage(m.chat, { text: `Answer: ${answer}` });
      }, 20000); // 20 seconds
    } catch (error) {
      console.error('Error fetching trivia question:', error);
      reply('An error occurred while fetching the trivia question.');
    }
  }
},
 {
  command: ['truthdetector', 'liedetector'],
  react: "🕵️",
  operate: async ({ m, reply }) => {
    if (!m.quoted) return reply(`Please reply to the message you want to detect!`);

    let responses = [
      "That's a blatant lie!",
      "Truth revealed!",
      "Lie alert!",
      "Hard to believe, but true!",
      "Professional liar detected!",
      "Fact-check: TRUE",
      "Busted! That's a lie!",
      "Unbelievable, but FALSE!",
      "Detecting... TRUTH!",
      "Lie detector activated: FALSE!",
      "Surprisingly, TRUE!",
      "My instincts say... LIE!",
      "That's partially true!",
      "Can't verify, try again!",
      "Most likely, TRUE!",
      "Don't believe you!",
      "Surprisingly, FALSE!",
      "Truth!",
      "Honest as a saint!",
      "Deceptive much?",
      "Absolutely true!",
      "Completely false!",
      "Seems truthful.",
      "Not buying it!",
      "You're lying through your teeth!",
      "Hard to believe, but it's true!",
      "I sense honesty.",
      "Falsehood detected!",
      "Totally legit!",
      "Lies, lies, lies!",
      "You can't fool me!",
      "Screams truth!",
      "Fabrication alert!",
      "Spot on!",
      "Fishy story, isn't it?",
      "Unquestionably true!",
      "Pure fiction!"
    ];

    let result = responses[Math.floor(Math.random() * responses.length)];
    let replyText = `*RESULT*: ${result}`;

    await reply(replyText);
  }
},
 {
  command: ['xxqc'],
  react: "🖋️",
  operate: async ({ Cypher, m, reply, prefix, command, text }) => {
    if (!text) {
      return reply(`Example: ${prefix + command} pink hello\n\nColour list\npink\nblue\nred\ngreen\nyellow\npurple\ndarkblue\nlightblue\nash\norange\nblack\nwhite\nteal\nlightpink\nchocolate\nsalmon\nmagenta\ntan\nwheat\ndeeppink\nfire\nskyblue\nbrightskyblue\nhotpink\nlightskyblue\nseagreen\ndarkred\norangered\ncyan\nviolet\nmossgreen\ndarkgreen\nnavyblue\ndarkorange\ndarkpurple\nfuchsia\ndarkmagenta\ndarkgray\npeachpuff\nblackishgreen\ndarkishred\ngoldenrod\ndarkishgray\ndarkishpurple\ngold\nsilver`);
    }
    
    if (text.length > 100) return reply(`Max 100 characters.`);

    let [color, ...message] = text.split(" ");
    message = message.join(" ");
    
    const colorMap = {
      "pink": "#f68ac9",
      "blue": "#6cace4",
      "red": "#f44336",
      "green": "#4caf50",
      "yellow": "#ffeb3b",
      "purple": "#9c27b0",
      "darkblue": "#0d47a1",
      "lightblue": "#03a9f4",
      "ash": "#9e9e9e",
      "orange": "#ff9800",
      "black": "#000000",
      "white": "#ffffff",
      "teal": "#008080",
      "lightpink": "#FFC0CB",
      "chocolate": "#A52A2A",
      "salmon": "#FFA07A",
      "magenta": "#FF00FF",
      "tan": "#D2B48C",
      "wheat": "#F5DEB3",
      "deeppink": "#FF1493",
      "fire": "#B22222",
      "skyblue": "#00BFFF",
      "brightskyblue": "#1E90FF",
      "hotpink": "#FF69B4",
      "lightskyblue": "#87CEEB",
      "seagreen": "#20B2AA",
      "darkred": "#8B0000",
      "orangered": "#FF4500",
      "cyan": "#48D1CC",
      "violet": "#BA55D3",
      "mossgreen": "#00FF7F",
      "darkgreen": "#008000",
      "navyblue": "#191970",
      "darkorange": "#FF8C00",
      "darkpurple": "#9400D3",
      "fuchsia": "#FF00FF",
      "darkmagenta": "#8B008B",
      "darkgray": "#2F4F4F",
      "peachpuff": "#FFDAB9",
      "darkishgreen": "#BDB76B",
      "darkishred": "#DC143C",
      "goldenrod": "#DAA520",
      "darkishgray": "#696969",
      "darkishpurple": "#483D8B",
      "gold": "#FFD700",
      "silver": "#C0C0C0"
    };

    const backgroundColor = colorMap[color.toLowerCase()];

    if (!backgroundColor) return reply("The selected color is not available.");

    const pushname = await Cypher.getName(m.sender);
    const profilePic = await Cypher.profilePictureUrl(m.sender, "image").catch(() => "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60");

    let obj = {
      type: "quote",
      format: "png",
      backgroundColor,
      width: 512,
      height: 768,
      scale: 2,
      messages: [
        {
          entities: [],
          avatar: true,
          from: {
            id: 1,
            name: pushname,
            photo: { url: profilePic }
          },
          text: message,
          replyMessage: {}
        }
      ]
    };
    
    try {
      let response = await axios.post("https://bot.lyo.su/quote/generate", obj, { headers: { "Content-Type": "application/json" } });
      let buffer = Buffer.from(response.data.result.image, "base64");
      
      Cypher.sendImageAsSticker(m.chat, buffer, m, {
        packname: `${global.packname}`,
        author: `${global.author}`,
      });
    } catch (error) {
      console.error('Error generating quote:', error);
      reply("An error occurred while generating the quote.");
    }
  }
},
];