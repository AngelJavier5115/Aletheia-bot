import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('clientReady', (c) => {
    console.log(`Aletheia activa como ${c.user.tag}`);
    if (process.env.OPENROUTER_API_KEY) {
        console.log("Estado de API Key: DETECTADA");
    } else {
        console.error("Estado de API Key: NO ENCONTRADA");
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!aletheia')) {
        const promptText = message.content.replace('!aletheia', '').trim();

        if (!promptText) {
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
                    "model": "google/gemini-3.7-flash",
                    "max_tokens": 1000,
                    "messages": [{ "role": "user", "content": promptText }]
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
