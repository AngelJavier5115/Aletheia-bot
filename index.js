import { Client, GatewayIntentBits } from 'discord.js';
import http from 'http';

// Servidor HTTP para Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Aletheia Bot is active and running!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor HTTP interno escuchando en el puerto ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Función de envío seguro dividiendo por líneas de forma limpia
async function sendSafeReply(message, text) {
    if (text.length > 2000) {
        const lines = text.split('\n');
        let chunk = '';
        for (const line of lines) {
            if ((chunk + line + '\n').length > 1900) {
                await message.reply(chunk);
                chunk = line + '\n';
            } else {
                chunk += line + '\n';
            }
        }
        if (chunk.trim().length > 0) {
            await message.reply(chunk);
        }
    } else {
        await message.reply(text);
    }
}

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

    // 1. Comando general !aletheia
    if (message.content.startsWith('!aletheia')) {
        const promptText = message.content.replace('!aletheia', '').trim();
        if (!promptText) return message.reply('Por favor, ingresa una consulta después del comando.');

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
                    "max_tokens": 800,
                    "messages": [
                        { "role": "system", "content": "Eres Aletheia. Responde de forma concisa y directa. NO uses fórmulas LaTeX ni símbolos matemáticos complejos ($...$), usa texto plano y Markdown estándar." },
                        { "role": "user", "content": promptText }
                    ]
                })
            });

            const data = await response.json();
            if (data.error) return message.reply(`Error de la API: ${data.error.message || 'Desconocido'}`);
            const text = data.choices?.[0]?.message?.content || "No pude generar una respuesta.";
            await sendSafeReply(message, text);
        } catch (error) {
            console.error('Error al conectar con OpenRouter:', error);
            await message.reply('Ocurrió un error crítico al procesar tu solicitud.');
        }
    }

    // 2. Comando Bitácora (!bitacora o !bit)
    if (message.content.startsWith('!bitacora') || message.content.startsWith('!bit')) {
        const prefix = message.content.startsWith('!bitacora') ? '!bitacora' : '!bit';
        const bitacoraText = message.content.replace(prefix, '').trim();
        if (!bitacoraText) return message.reply('Escribe la nota o el registro que deseas guardar en tu bitácora.');

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
                    "max_tokens": 800,
                    "messages": [
                        { "role": "system", "content": "Eres Aletheia, asistente metodológico. Formatea la nota de bitácora de manera limpia, ordenada y concisa. NO uses LaTeX ni fórmulas matemáticas ($...$)." },
                        { "role": "user", "content": bitacoraText }
                    ]
                })
            });

            const data = await response.json();
            if (data.error) return message.reply(`Error al registrar bitácora: ${data.error.message}`);
            const formattedNote = data.choices?.[0]?.message?.content || bitacoraText;
            const replyMessage = `📌 **[BITÁCORA REGISTRADA]**\n> *Autor: ${message.author.username}*\n\n${formattedNote}`;
            await sendSafeReply(message, replyMessage);
        } catch (error) {
            console.error('Error al procesar la bitácora:', error);
            await message.reply('Ocurrió un error al intentar estructurar tu bitácora.');
        }
    }

    // 3. Comando Protocolo Tekton (!protocolo o !proto)
    if (message.content.startsWith('!protocolo') || message.content.startsWith('!proto')) {
        const prefix = message.content.startsWith('!protocolo') ? '!protocolo' : '!proto';
        const protoText = message.content.replace(prefix, '').trim();
        if (!protoText) return message.reply('Ingresa la premisa o teoría que deseas someter a protocolo analítico.');

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
                    "max_tokens": 800,
                    "messages": [
                        { "role": "system", "content": "Eres Aletheia bajo el Protocolo Tekton. Analiza con rigor científico, sé conciso y estructurado en: 1. Premisa Central, 2. Análisis Crítico, 3. Criterio de Falsación, 4. Conclusión. PROHIBIDO usar LaTeX o símbolos como $...$." },
                        { "role": "user", "content": protoText }
                    ]
                })
            });

            const data = await response.json();
            if (data.error) return message.reply(`Error en protocolo: ${data.error.message}`);
            const protoResult = data.choices?.[0]?.message?.content || "No se pudo procesar.";
            const replyMessage = `⚙️ **[PROTOCOLO TEKTON - EJECUTADO]**\n\n${protoResult}`;
            await sendSafeReply(message, replyMessage);
        } catch (error) {
            console.error('Error al ejecutar el protocolo:', error);
            await message.reply('Ocurrió un error al procesar el protocolo tekton.');
        }
    }

    // 4. Comando Modelo Atlas (!modelo o !atlas)
    if (message.content.startsWith('!modelo') || message.content.startsWith('!atlas')) {
        const prefix = message.content.startsWith('!modelo') ? '!modelo' : '!atlas';
        const modelText = message.content.replace(prefix, '').trim();
        if (!modelText) return message.reply('Ingresa el concepto o sistema que deseas mapear en el Atlas.');

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
                    "max_tokens": 800,
                    "messages": [
                        { "role": "system", "content": "Eres Aletheia bajo Modelos Atlas. Mapea de forma directa, limpia y estructurada en: 1. Núcleo, 2. Variables, 3. Flujos sistémicos. PROHIBIDO usar LaTeX ($...$); usa texto plano y variables legibles." },
                        { "role": "user", "content": modelText }
                    ]
                })
            });

            const data = await response.json();
            if (data.error) return message.reply(`Error en modelo: ${data.error.message}`);
            const atlasResult = data.choices?.[0]?.message?.content || "No se pudo generar el modelo.";
            const replyMessage = `🗺️ **[MODELO ATLAS - MAPEO SISTÉMICO]**\n\n${atlasResult}`;
            await sendSafeReply(message, replyMessage);
        } catch (error) {
            console.error('Error al generar el modelo atlas:', error);
            await message.reply('Ocurrió un error al procesar el modelo.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("Error crítico al iniciar sesión en Discord:", err);
});
