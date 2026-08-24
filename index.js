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

client.once('clientReady', async (c) => {
    console.log(`Aletheia activada como ${c.user.tag}`);
    
    // Lista e imprime los modelos disponibles para tu API Key en los logs de Render
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        console.log("Modelos disponibles en tu API Key:", data.models ? data.models.map(m => m.name) : data);
    } catch (e) {
        console.log("No se pudo listar los modelos:", e.message);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!aletheia')) {
        const prompt = message.content.replace('!aletheia', '').trim();

        if (!prompt) {
            return message.reply('Por favor, ingresa una consulta después del comando.');
        }

        try {
            await message.channel.sendTyping();
            
            // Usando la versión de modelo v2.0 estándar
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            
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
