import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// Prompt especializado de Tekton (Análisis, protocolos y falsación)
const SYSTEM_PROMPT = `Eres Tekton, una IA especializada en análisis de protocolos, arquitectura de sistemas y falsación lógica. Tu objetivo es examinar supuestos, validar consistencia estructural y detectar fallas antes de la ejecución. Responde de forma clara, directa y con rigor técnico.`;

// Función para fragmentar mensajes si superan los 2000 caracteres de Discord
async function sendSafeReply(message, text) {
    const CHUNK_SIZE = 1900;
    if (text.length <= CHUNK_SIZE) {
        return await message.reply(text);
    }

    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        chunks.push(text.substring(i, i + CHUNK_SIZE));
    }

    for (const chunk of chunks) {
        await message.channel.send(chunk);
    }
}

client.once('ready', () => {
    console.log(`Tekton conectado exitosamente como ${client.user.tag}`);
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
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": "google/gemini-2.5-flash", 
                    "messages": [
                        { "role": "system", "content": SYSTEM_PROMPT },
                        { "role": "user", "content": cleanContent }
                    ]
                })
            });

            const data = await response.json();
            
            if (data.choices && data.choices[0]) {
                const replyText = data.choices[0].message.content;
                await sendSafeReply(message, replyText);
            } else {
                await message.reply("⚠️ No pude obtener una respuesta válida de la API.");
            }

        } catch (error) {
            console.error("Error en Tekton:", error);
            await message.reply("❌ Ocurrió un error al procesar tu solicitud.");
        }
    }
});

client.login(process.env.DISCORD_TOKEN_TEKTON || process.env.DISCORD_TOKEN).catch(err => {
    console.error("Error al iniciar sesión en Tekton:", err);
});
