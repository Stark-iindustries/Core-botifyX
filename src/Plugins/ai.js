const fetch = require('node-fetch');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { fromBuffer } = require('file-type');
const path = require('path');
const GeminiAI = require('../Functions/gemini');

const { handleMediaUpload } = require('../../lib/catbox');

module.exports = [
{
  command: ['analyze', 'imagetotext', 'analyse', 'vision'],
  react: "🔍",
  operate: async ({ m, Cypher, reply }) => {
    const quotedMessage = m.quoted || m.msg?.quoted;
    const mediaType = quotedMessage?.mimetype || quotedMessage?.msg?.mimetype;

    if (!quotedMessage || !mediaType || !mediaType.startsWith("image/")) {
      return reply('*Please reply to an image message!*');
    }

    try {
      const mediaBuffer = await quotedMessage.download();
      const aiProcessor = new GeminiAI();
      
      const analysisResult = await aiProcessor.processQuery(
        "Describe this image in detail", 
        { 
          file_data: mediaBuffer,
          model_choice: 'gemini-1.5-pro'
        }
      );

      const analysisText = analysisResult?.[0]?.content?.parts?.[0]?.text;
      
      if (!analysisText) return reply("Could not analyze this image");
      
      reply(`*Image Analysis Result:*\n\n${analysisText}`);
    } catch (error) {
      console.error('Analysis error:', error);
      reply(global.mess.error);
    }
  }
},
 {
  command: ['blackbox'],
  react: "📦",
  operate: async ({ m, reply, text }) => {
    if (!text) return reply(global.mess.notext);

    try {
      let response = await fetch(`${global.siputzx}/api/ai/blackboxai?content=${encodeURIComponent(text)}`);
      let data = await response.json();

      if (response.status !== 200 || !data.status || !data.data) {
      reply(global.mess.error);
      } else {
        reply(data.data);
      }
    } catch (error) {
      console.error('Error fetching response from BlackboxAI API:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['dalle'],
  react: "🎨",
  operate: async ({ Cypher, m, reply, text }) => {
    if (!text) return reply(global.mess.notext);

    const apiUrl = `${global.siputzx}/api/ai/stable-diffusion?prompt=${encodeURIComponent(text)}`;
    try {
      await Cypher.sendMessage(m.chat, { image: { url: apiUrl } }, { quoted: m });
    } catch (error) {
      console.error('Error generating image:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['gemini', 'ask', 'ai'],
  react: "♊",
  operate: async ({ m, text, reply }) => {
    if (!text) return reply(global.mess.notext);

    try {
      const aiProcessor = new GeminiAI();
      
      const response = await aiProcessor.processQuery(text, {
        model_choice: 'gemini-1.5-flash'
      });

      const aiResponse = response?.[0]?.content?.parts?.[0]?.text;
      
      if (!aiResponse) return reply("No response from AI");
      
      reply(aiResponse);
    } catch (error) {
      console.error('AI error:', error);
      reply(global.mess.error);
    }
  }
},
 {
  command: ['generate'],
  react: "🖼️",
  operate: async ({ Cypher, m, reply, text, prefix, command }) => {
if (!text) return reply(global.mess.notext);

    const api3Url = `https://api.gurusensei.workers.dev/dream?prompt=${encodeURIComponent(text)}`;
    try {
      await Cypher.sendMessage(m.chat, { image: { url: api3Url } }, { quoted: m });
    } catch (error) {
      console.error('Error generating image:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['deepseek'],
  react: "🔎",
  operate: async ({ m, reply, text }) => {
    if (!text) return reply(global.mess.notext);

    try {
      const apiUrl = `${global.api}/deepseek?prompt=${encodeURIComponent(text)}&userId=${m.sender}`;
      const response = await fetch(apiUrl);
      const result = await response.json();

      if (!result.status || !result.result) {
      reply(global.mess.error);
      } else {
        reply(result.result);
      }
    } catch (error) {
      console.error('Error fetching response from DeepSeek-R1 API:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['deepseekr1'],
  react: "🧠",
  operate: async ({ m, reply, text }) => {
    if (!text) return reply(global.mess.notext);

    try {
      const apiUrl = `${global.api}/deepseek-r1?prompt=${encodeURIComponent(text)}&userId=${m.sender}`;
      const response = await fetch(apiUrl);
      const result = await response.json();

      if (!result.status || !result.result) {
      reply(global.mess.error);
      } else {
        reply(result.result);
      }
    } catch (error) {
      console.error('Error fetching response from DeepSeek-LLM API:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['doppleai'],
  react: "👥",
  operate: async ({ reply, m, text }) => {
    async function fetchDoppleAIResponse(query) {
      const response = await axios.get(`${global.api}/doppleai?prompt=${encodeURIComponent(query)}`);
      return response.data;
    }

    try {
if (!text) return reply(global.mess.notext);
      const result = await fetchDoppleAIResponse(text);
      reply(result.response);
    } catch (error) {
      console.error('Error in DoppleAI plugin:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['gpt'],
  react: "🌐",
  operate: async ({ m, text, reply }) => {
    if (!text) return reply(global.mess.notext);

    try {
      const aiProcessor = new GeminiAI();
      
      const response = await aiProcessor.processQuery(text, {
        model_choice: 'gemini-2.0-flash',
        web_search: true
      });

      const searchResults = response?.[0]?.content?.parts?.[0]?.text;
      
      if (!searchResults) return reply("No answer found");
      
      reply(`${searchResults}`);
    } catch (error) {
      console.error('Search error:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['gpt2'],
  react: "🤖",
  operate: async ({ m, reply, text }) => {
    if (!text) return reply(global.mess.notext);

    try {
      const apiUrl = `${global.siputzx}/api/ai/gpt3?prompt=you%20are%20an%20helpful%20assistant%20providing%20detailed%20and%20friendly%20responses&content=${encodeURIComponent(text)}`;
      const response = await fetch(apiUrl);
      const result = await response.json();

      if (!result.status || !result.data) {
      reply(global.mess.error);
      } else {
        reply(result.data);
      }
    } catch (error) {
      console.error('Error fetching response from GPT API:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['imagen'],
  react: "🎨",
  operate: async ({ m, text, reply }) => {
    if (!text) return reply('*Please provide an image description!*');

    try {
      const aiProcessor = new GeminiAI();
      
      const imageResults = await aiProcessor.createImage(text, {
        model_choice: 'imagen-3.0-generate-002',
        dimensions: '1:1'
      });

      if (!imageResults || !imageResults[0]?.bytes) {
        return reply("Failed to generate image");
      }
     
      const imageBuffer = Buffer.from(imageResults[0].bytes, 'base64');
      
      await Cypher.sendMessage(
        m.chat, 
        { 
          image: imageBuffer,
          caption: `Generated image for: ${text}`
        },
        { quoted: m }
      );
    } catch (error) {
      console.error('Image generation error:', error);
      reply(global.mess.error);
    }
  }
},
  {
  command: ['imagine'],
  react: "🧠",
  operate: async ({ Cypher, m, reply, text, prefix, command }) => {
if (!text) return reply(global.mess.notext);

    const apiUrl = `${global.siputzx}/api/ai/flux?prompt=${encodeURIComponent(text)}`;
    try {
      await Cypher.sendMessage(m.chat, { image: { url: apiUrl } }, { quoted: m });
    } catch (error) {
      console.error('Error generating image:', error);
      reply(global.mess.error);
    }
  }
},
  {
  command: ['llama'],
  react: "🦙",
  operate: async ({ m, reply, text }) => {
    if (!text) return reply(global.mess.notext);

    try {
      let response = await fetch(`https://api.bk9.dev/ai/llama?q=${encodeURIComponent(text)}`);
      let data = await response.json();

      if (!data.BK9) {
      reply(global.mess.error);
      } else {
        reply(data.BK9);
      }
    } catch (error) {
      console.error('Error fetching response from Llama API:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['metaai'],
  react: "🅰️",
  operate: async ({ m, reply, text }) => {
    if (!text) return reply(global.mess.notext);

    try {
      const apiUrl = `${global.api}/llama?prompt=${encodeURIComponent(text)}&userId=${m.sender}`;
      const response = await fetch(apiUrl);
      const result = await response.json();

      if (!result.status || !result.result) {
      reply(global.mess.error);
      } else {
        reply(result.result);
      }
    } catch (error) {
      console.error('Error fetching response from MetaAI API:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['mistral'],
  react: "🌬️",
  operate: async ({ m, reply, text }) => {
    if (!text) return reply(global.mess.notext);

    try {
      const apiUrl = `${global.api}/mistral?prompt=${encodeURIComponent(text)}&userId=${m.sender}`;
      const response = await fetch(apiUrl);
      const result = await response.json();

      if (!result.status || !result.result) {
      reply(global.mess.error);
      } else {
        reply(result.result);
      }
    } catch (error) {
      console.error('Error fetching response from Mistral API:', error);
       reply(global.mess.error);
    }
  }
},
  {
  command: ['photoai'],
  react: "🖼️",
  operate: async ({ Cypher, m, reply, text, prefix, command }) => {
if (!text) return reply(global.mess.notext);

    const apiUrl = `${global.siputzx}/api/ai/dreamshaper?prompt=${encodeURIComponent(text)}`;
    try {
      await Cypher.sendMessage(m.chat, { image: { url: apiUrl } }, { quoted: m });
    } catch (error) {
      console.error('Error generating image:', error);
       reply(global.mess.error);
    }
  }
},
{
  command: ['programming', 'explaincode', 'code'],
  react: "💻",
  operate: async ({ m, text, reply }) => {
    const quotedMessage = m.quoted || m.msg?.quoted;
    
    if (!quotedMessage && !text) {
      return reply('*Please provide code or reply to a code message!*');
    }

    try {
      const aiProcessor = new GeminiAI();
      let codeText = text;
     
      if (quotedMessage && quotedMessage.text) {
        codeText = quotedMessage.text;
      }
      
      if (!codeText) return reply('*No code found to analyze*');
           
      const response = await aiProcessor.processQuery(
        `Explain this code: ${codeText}`,
        {
          model_choice: 'gemini-1.5-pro',
          system_prompt: "You are a helpful programming assistant. Explain code and code related stuffs clearly and concisely."
        }
      );

      const explanation = response?.[0]?.content?.parts?.[0]?.text;
      
      if (!explanation) return reply("Could not analyze this code");
      
      reply(`*Result:*\n\n${explanation}`);
    } catch (error) {
      console.error('Code analysis error:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['translate2', 'trt2'],
  react: "🌎",
  operate: async ({ m, text, reply }) => {
    if (!text) return reply('*Format: .translate [language] [text]*\n*Example: .translate French Hello world*');

    try {
      const [targetLanguage, ...textToTranslate] = text.split(' ');
      const translationText = textToTranslate.join(' ');
      
      if (!targetLanguage || !translationText) {
        return reply('*Format: .translate [language] [text]*\n*Example: .translate French Hello world*');
      }

      const aiProcessor = new GeminiAI();
      
      const response = await aiProcessor.processQuery(
        `Translate this to ${targetLanguage}: ${translationText}`,
        {
          model_choice: 'gemini-1.5-flash',
          system_prompt: "You are a translation expert. Provide accurate translations without additional commentary. If language is wrongly provided, translate to English"
        }
      );

      const translation = response?.[0]?.content?.parts?.[0]?.text;
      
      if (!translation) return reply("Translation failed");
      
      reply(`*Translation (${targetLanguage}):*\n${translation}`);
    } catch (error) {
      console.error('Translation error:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['summarize', 'summary', 'summarise'],
  react: "📝",
  operate: async ({ m, text, reply }) => {
    const quotedMessage = m.quoted || m.msg?.quoted;
    
    if (!quotedMessage && !text) {
      return reply('*Please provide text or reply to a message to summarize!*');
    }

    try {
      const aiProcessor = new GeminiAI();
      let contentToSummarize = text;
     
      if (quotedMessage && quotedMessage.text) {
        contentToSummarize = quotedMessage.text;
      }
      
      if (!contentToSummarize) return reply('*No content found to summarize*');
      
      const response = await aiProcessor.processQuery(
        `Summarize this content concisely: ${contentToSummarize}`,
        {
          model_choice: 'gemini-1.5-flash',
          system_prompt: "You are a summarization expert. Provide clear, concise summaries focusing on key points."
        }
      );

      const summary = response?.[0]?.content?.parts?.[0]?.text;
      
      if (!summary) return reply("Could not create summary");
      
      reply(`*Summary:*\n\n${summary}`);
    } catch (error) {
      console.error('Summarization error:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['story', 'write', 'createstory'],
  react: "📖",
  operate: async ({ m, text, reply }) => {
    if (!text) return reply('*Please provide a story prompt!*\n*Example: .write a short story about a robot who falls in love*');

    try {
      const aiProcessor = new GeminiAI();
      
      const response = await aiProcessor.processQuery(
        `Write a creative story about: ${text}`,
        {
          model_choice: 'gemini-1.5-pro',
          system_prompt: "You are a creative writer. Craft engaging, imaginative stories with good narrative structure."
        }
      );

      const story = response?.[0]?.content?.parts?.[0]?.text;
      
      if (!story) return reply("Could not generate story");
      
      if (story.length > 2000) {
        const parts = story.match(/[\s\S]{1,2000}/g) || [];
        for (let i = 0; i < parts.length; i++) {
          await reply(`*Story (Part ${i + 1}/${parts.length}):*\n\n${parts[i]}`);
        }
      } else {
        reply(`*Story:*\n\n${story}`);
      }
    } catch (error) {
      console.error('Story generation error:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['recipe', 'food', 'cook'],
  react: "🍳",
  operate: async ({ m, text, reply }) => {
    if (!text) return reply('*Please specify what recipe you want!*\n*Example: .recipe chocolate cake*');

    try {
      const aiProcessor = new GeminiAI();
         
      const response = await aiProcessor.processQuery(
        `Provide a detailed recipe for: ${text}. Include ingredients and step-by-step instructions.`,
        {
          model_choice: 'gemini-1.5-pro',
          system_prompt: "You are a chef. Provide clear, accurate recipes with precise measurements and instructions."
        }
      );

      const recipe = response?.[0]?.content?.parts?.[0]?.text;
      
      if (!recipe) return reply("Could not find a recipe");
      
      reply(`*Recipe for ${text}:*\n\n${recipe}`);
    } catch (error) {
      console.error('Recipe error:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['teach', 'explain', 'learn'],
  react: "🎓",
  operate: async ({ m, text, reply }) => {
    if (!text) return reply('*What would you like to learn about?*\n*Example: .teach photosynthesis*');

    try {
      const aiProcessor = new GeminiAI();
    
      const response = await aiProcessor.processQuery(
        `Explain this topic in detail for educational purposes: ${text}`,
        {
          model_choice: 'gemini-1.5-pro',
          system_prompt: "You are an educational tutor. Explain concepts clearly, step by step, with examples when helpful."
        }
      );

      const explanation = response?.[0]?.content?.parts?.[0]?.text;
      
      if (!explanation) return reply("Could not generate explanation");
      
      reply(`*Lesson: ${text}*\n\n${explanation}`);
    } catch (error) {
      console.error('Teaching error:', error);
      reply(global.mess.error);
    }
  }
},
];