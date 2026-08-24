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

            // Llamada directa a Gemini a través del puente OpenRouter
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": "google/gemini-2.0-flash-001", // Tu voz de Gemini
                    "messages": [{ "role": "user", "content": prompt }]
                })
            });

            const data = await response.json();
            const text = data.choices[0]?.message?.content || "No pude generar una respuesta.";

            if (text.length > 2000) {
                const chunks = text.match(/[\s\S]{1,1900}/g);
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                await message.reply(text);
            }
        } catch (error) {
            console.error('Error al conectar con Gemini:', error);
            await message.reply('Ocurrió un error al procesar tu solicitud.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
