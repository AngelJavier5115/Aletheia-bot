import http from 'http';
import { Client, GatewayIntentBits } from 'discord.js';

// Servidor HTTP para mantener Render activo
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Tekton Bot activo');
}).listen(PORT);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

const SYSTEM_PROMPT = `Eres Tekton, una IA especializada en análisis de protocolos, arquitectura de sistemas y falsación lógica. Tu objetivo es examinar supuestos, validar consistencia estructural y detectar fallas antes de la ejecución. Responde de forma clara, directa y con rigor técnico.`;

// API Key de OpenRouter inyectada directamente
const OPENROUTER_KEY = "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";

client.once('ready', () => {
    console.log(`Tekton conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.mentions.has(client.user)) {
        try {
            await message.channel.sendTyping();
            const cleanContent = message.content.replace(/<@!?\d+>/g, '').trim();

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_KEY.trim()}`,
                    "HTTP-Referer": "https://discord.com",
                    "X-Title": "Tekton Bot",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "meta-llama/llama-3.3-70b-instruct:free",
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: cleanContent }
                    ]
                })
            });

            const data = await response.json();

            if (data.choices && data.choices[0]?.message) {
                await message.reply(data.choices[0].message.content.substring(0, 1900));
            } else if (data.error) {
                await message.reply(`⚠️ OpenRouter Error: ${data.error.message || JSON.stringify(data.error)}`);
            } else {
                await message.reply("⚠️ Respuesta no reconocida de la API.");
            }

        } catch (error) {
            console.error("Error en Tekton:", error);
            await message.reply("❌ Error interno al procesar la solicitud.");
        }
    }
});

client.login(process.env.DISCORD_TOKEN_TEKTON || process.env.DISCORD_TOKEN);
