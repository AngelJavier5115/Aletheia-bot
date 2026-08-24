const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const historyByChannel = new Map();

client.on('ready', () => {
  console.log(`Aletheia activada como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const channelId = message.channel.id;
  if (!historyByChannel.has(channelId)) {
    historyByChannel.set(channelId, []);
  }

  const history = historyByChannel.get(channelId);
  history.push({ role: 'user', parts: [{ text: message.content }] });

  try {
    await message.channel.sendTyping();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: history,
      config: {
        systemInstruction: "Eres Aletheia, un par intelectual riguroso y analítico. Responde con claridad, profundidad y pensamiento crítico."
      }
    });

    const replyText = response.text;
    history.push({ role: 'model', parts: [{ text: replyText }] });

    if (replyText.length > 2000) {
      const chunks = replyText.match(/[\s\S]{1,1900}/g);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(replyText);
    }
  } catch (error) {
    console.error('Error con Aletheia:', error);
    message.reply('Ocurrió un error al procesar el análisis.');
  }
});

client.login(process.env.DISCORD_TOKEN);
