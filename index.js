const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Nombre del modelo actualizado
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

client.once('clientReady', (c) => {
    console.log(`Aletheia activada como ${c.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!aletheia')) {
        const prompt = message.content.replace('!aletheia', '').trim();

        if (!prompt) {
            return message.reply('Por favor, ingresa una pregunta o consulta después del comando.');
        }

        try {
            await message.channel.sendTyping();
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            if (text.length > 2000) {
                const chunks = text.match(/[\s\S]{1,1900}/g);
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                await message.reply(text);
            }
        } catch (error) {
            console.error('Error al generar respuesta:', error);
            await message.reply('Ocurrió un error al procesar tu solicitud.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
