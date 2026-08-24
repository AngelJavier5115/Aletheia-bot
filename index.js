const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Inicializar cliente de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Inicializar Google Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Confirmación de inicio de sesión
client.once('clientReady', (c) => {
    console.log(`Aletheia activada como ${c.user.tag}`);
});

// Escuchar mensajes en los canales
client.on('messageCreate', async (message) => {
    // Ignorar mensajes enviados por el propio bot
    if (message.author.bot) return;

    // Procesar mensajes que inicien con !aletheia
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

            // Discord permite un máximo de 2000 caracteres por mensaje
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

// Iniciar sesión con el token
client.login(process.env.DISCORD_TOKEN);
