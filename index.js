import http from 'http';
import { Client, GatewayIntentBits } from 'discord.js';
import { GoogleGenAI } from '@google/genai';

// 1. Servidor de mantenimiento para Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Orquestador de Agentes Activo');
}).listen(PORT);

// 2. Inicialización de cliente Discord
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// 3. Inicialización de API Gemini (Aletheia)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// System Prompt de Aletheia
const ALETHEIA_PROMPT = `Eres Aletheia, la IA orientadora y estratega del sistema.
Tu función principal es brindar síntesis clara, visión general y análisis estratégico.
Respuestas concisas, ejecutivas, directas y sin rodeos. Evita texto innecesario.`;

discordClient.once('ready', () => {
    console.log(`Orquestador en línea. Conectado como ${discordClient.user.tag}`);
});

discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Detectar si mencionan al bot en Discord
    if (message.mentions.has(discordClient.user)) {
        try {
            await message.channel.sendTyping();

            // Limpiar la mención del mensaje
            const cleanContent = message.content.replace(/<@!?\d+>/g, '').trim();

            if (!cleanContent) {
                await message.reply("¿En qué puedo ayudarte?");
                return;
            }

            // Llamada directa a Gemini 2.5 Flash
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: cleanContent,
                config: {
                    systemInstruction: ALETHEIA_PROMPT,
                    temperature: 0.7,
                }
            });

            const replyText = response.text || "No pude generar una respuesta.";
            
            // Enviar respuesta a Discord
            await message.reply(replyText.substring(0, 1900));

        } catch (error) {
            console.error("Error en Orquestador (Aletheia):", error);
            await message.reply("❌ Ocurrió un error interno al consultar el módulo de Aletheia.");
        }
    }
});

discordClient.login(process.env.DISCORD_TOKEN);
