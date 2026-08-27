import http from 'http';
import { Client, GatewayIntentBits } from 'discord.js';

// 1. Servidor HTTP básico para Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Orquestador de Agentes Activo');
}).listen(PORT);

// 2. Función directa a la API usando endpoint v1 estable
async function getGeminiResponse(promptText) {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: promptText }]
            }]
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || `Error HTTP ${response.status}`);
    }

    return data.candidates[0].content.parts[0].text;
}

// 3. Inicialización del Cliente de Discord
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

discordClient.once('ready', () => {
    console.log(`Orquestador en línea. Conectado como ${discordClient.user.tag}`);
});

discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.mentions.has(discordClient.user)) {
        try {
            await message.channel.sendTyping();
            const cleanContent = message.content.replace(/<@!?\d+>/g, '').trim();

            if (!cleanContent) {
                await message.reply("¿En qué puedo ayudarte?");
                return;
            }

            const prompt = `[Rol: Eres Aletheia, estratega y orientadora concisa y ejecutiva]. ${cleanContent}`;
            const responseText = await getGeminiResponse(prompt);

            await message.reply(responseText.substring(0, 1900));

        } catch (error) {
            console.error("DETALLE DEL ERROR:", error);
            await message.reply(`❌ Error: ${error.message || 'Falla interna en el módulo'}`);
        }
    }
});

discordClient.login(process.env.DISCORD_TOKEN);
