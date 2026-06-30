const GeminiAI = require('../Functions/gemini');

module.exports = [
{
  command: ['truth', 't'],
  react: "🤔",
  category: "Fun",
  desc: "Get a random truth question",
  operate: async ({ m, reply }) => {
    try {
      const aiProcessor = new GeminiAI();
      
      const response = await aiProcessor.processQuery(
        "Generate a fun, appropriate truth question for a WhatsApp game. " +
        "Make it interesting but not too personal or offensive. " +
        "Return ONLY the question, no additional text.",
        {
          model_choice: 'gemini-1.5-flash',
          system_prompt: "You are a game master. Create engaging, fun truth questions for social games."
        }
      );

      const truthQuestion = response?.[0]?.content?.parts?.[0]?.text;
      
      if (!truthQuestion) return reply("Failed to generate a truth question");
      
      const formattedQuestion = truthQuestion.replace(/^["']|["']$/g, '').trim();
      
      reply(`🤔 *Truth Question:*\n\n"${formattedQuestion}"\n\n*You must answer honestly!*`);
      
    } catch (error) {
      console.error('Truth command error:', error);
      reply(global.mess.error);
    }
  }
},

{
  command: ['dare', 'd'],
  react: "😈",
  category: "Fun",
  desc: "Get a random dare challenge",
  operate: async ({ m, reply }) => {
    try {
      const aiProcessor = new GeminiAI();
      
      const response = await aiProcessor.processQuery(
        "Generate a fun, safe dare challenge for a WhatsApp game. " +
        "Make it creative but appropriate for all ages. " +
        "Return ONLY the dare, no additional text.",
        {
          model_choice: 'gemini-1.5-flash',
          system_prompt: "You are a game master. Create fun, safe dare challenges for social games."
        }
      );

      const dareChallenge = response?.[0]?.content?.parts?.[0]?.text;
      
      if (!dareChallenge) return reply("Failed to generate a dare challenge");
      
      const formattedDare = dareChallenge.replace(/^["']|["']$/g, '').trim();
      
      reply(`😈 *Dare Challenge:*\n\n"${formattedDare}"\n\n*You must complete this challenge!*`);
      
    } catch (error) {
      console.error('Dare command error:', error);
      reply(global.mess.error);
    }
  }
},
{
  command: ['truthordare', 'tod'],
  react: "🎮",
  category: "Fun",
  desc: "Play a full Truth or Dare game",
  operate: async ({ m, reply }) => {
    try {
      const aiProcessor = new GeminiAI();
      
      const isTruth = Math.random() > 0.5;
      
      if (isTruth) {
        const response = await aiProcessor.processQuery(
          "Generate a fun, appropriate truth question for a WhatsApp game. " +
          "Return ONLY the question, no additional text.",
          {
            model_choice: 'gemini-1.5-flash',
            system_prompt: "You are a game master. Create engaging, fun truth questions for social games."
          }
        );

        const truthQuestion = response?.[0]?.content?.parts?.[0]?.text;
        
        if (!truthQuestion) return reply("Failed to generate a truth question");
        
        const formattedQuestion = truthQuestion.replace(/^["']|["']$/g, '').trim();
        reply(`🎮 *Truth or Dare:*\n🤔 *TRUTH*\n\n"${formattedQuestion}"\n\n*You must answer honestly!*`);
        
      } else {
        const response = await aiProcessor.processQuery(
          "Generate a fun, safe dare challenge for a WhatsApp game. " +
          "Return ONLY the dare, no additional text.",
          {
            model_choice: 'gemini-1.5-flash',
            system_prompt: "You are a game master. Create fun, safe dare challenges for social games."
          }
        );

        const dareChallenge = response?.[0]?.content?.parts?.[0]?.text;
        
        if (!dareChallenge) return reply("Failed to generate a dare challenge");
        
        const formattedDare = dareChallenge.replace(/^["']|["']$/g, '').trim();
        reply(`🎮 *Truth or Dare:*\n😈 *DARE*\n\n"${formattedDare}"\n\n*You must complete this challenge!*`);
      }
      
    } catch (error) {
      console.error('Truth or Dare command error:', error);
      reply(global.mess.error);
    }
  }
}
]