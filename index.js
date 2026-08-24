const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Inicializar el SDK oficial de Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
            
            // Llamada directa al modelo flash usando la nueva sintaxis
            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: prompt,
            });

            const text = response.text;

            if (text.length > 2000) {
                const chunks = text.match(/[\s\S]{1,1900}/g);
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                await message.reply(text);
            }
        } catch (error) {
            console.error('Error detallado de Gemini:', error);
            await message.reply('Ocurrió un error al procesar tu solicitud.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
