const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('clientReady', (c) => {
    console.log(`Aletheia (Gemini) activa como ${c.user.tag}`);
    // Diagnóstico de clave
    if (process.env.OPENROUTER_API_KEY) {
        console.log("Estado de API Key: DETECTADA (Primeros caracteres:", process.env.OPENROUTER_API_KEY.substring(0, 7) + "...)");
    } else {
        console.error("Estado de API Key: NO ENCONTRADA EN RENDER");
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

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": "google/gemini-2.0-flash-001",
                    "messages": [{ "role": "user", "content": prompt }]
                })
            });

            const data = await response.json();
            
            if (data.error) {
                console.error('Error detallado de OpenRouter:', data.error);
                return message.reply(`Error de la API: ${data.error.message || 'Desconocido'}`);
            }

            const text = data.choices?.[0]?.message?.content || "No pude generar una respuesta.";

            if (text.length > 2000) {
                const chunks = text.match(/[\s\S]{1,1900}/g);
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                await message.reply(text);
            }
        } catch (error) {
            console.error('Error al conectar con OpenRouter:', error);
            await message.reply('Ocurrió un error crítico al procesar tu solicitud.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
