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
            
            // Intentar primero con gemini-1.5-flash
            let modelName = 'gemini-1.5-flash';
            let model = genAI.getGenerativeModel({ model: modelName });
            
            let text = '';
            try {
                const result = await model.generateContent(prompt);
                const response = await result.response;
                text = response.text();
            } catch (err) {
                // Si da 404, intentar con gemini-1.5-pro
                console.log(`Fallo con ${modelName}, intentando gemini-1.5-pro...`, err.message);
                model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                text = response.text();
            }

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
