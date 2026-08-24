const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

client.on('ready', () => {
  console.log(`Aletheia activada como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith('!aletheia ')) {
    const prompt = message.content.slice(10);
    try {
      await message.channel.sendTyping();
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      message.reply(text);
    } catch (error) {
      console.error(error);
      message.reply('Ocurrió un error al procesar tu solicitud.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
