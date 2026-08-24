import { Client, GatewayIntentBits } from 'discord.js';
import http from 'http';

// Servidor HTTP interno para mantener vivo el servicio en Render
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

// Función de envío seguro mejorada: Divide textos largos en múltiples burbujas consecutivas
// respetando los saltos de línea para que NADA se quede a medias o corte palabras.
async function sendSafeReply(message, text) {
    const MAX_LENGTH = 1900; // Margen de seguridad previo al límite de 2000 de Discord
    
    if (text.length <= MAX_LENGTH) {
        await message.reply(text);
        return;
    }

    const lines = text.split('\n');
    let chunks = [];
    let currentChunk = '';

    for (const line of lines) {
        if ((currentChunk + line + '\n').length > MAX_LENGTH) {
            chunks.push(currentChunk);
            currentChunk = line + '\n';
        } else {
            currentChunk += line + '\n';
        }
    }
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk);
    }

    // Envía el primer bloque respondiendo directamente al mensaje original
    await message.reply(chunks[0]);

    // Envía los fragmentos restantes de manera consecutiva en el canal
    for (let i = 1; i < chunks.length; i++) {
        await message.channel.send(chunks[i]);
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
    const content = message.content.trim();

    // 1. Comando Protocolo Tekton (!protocolo o !proto)
    if (content.startsWith('!protocolo') || content.startsWith('!proto')) {
        const prefix = content.startsWith('!protocolo') ? '!protocolo' : '!proto';
        const protoText = content.replace(prefix, '').trim();
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
                    "max_tokens": 2500,
                    "messages": [
                        { "role": "system", "content": "Eres Aletheia bajo el Protocolo Tekton. Analiza con rigor científico, sé estructurado y conciso en: 1. Premisa Central, 2. Análisis Crítico, 3. Criterio de Falsación, 4. Conclusión. PROHIBIDO usar LaTeX o símbolos como $...$." },
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

    // 2. Comando Modelo Atlas (!modelo o !atlas)
    else if (content.startsWith('!modelo') || content.startsWith('!atlas')) {
        const prefix = content.startsWith('!modelo') ? '!modelo' : '!atlas';
        const modelText = content.replace(prefix, '').trim();
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
                    "max_tokens": 2500,
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

    // 3. Comando Bitácora (!bitacora o !bit)
    else if (content.startsWith('!bitacora') || content.startsWith('!bit')) {
        const prefix = content.startsWith('!bitacora') ? '!bitacora' : '!bit';
        const bitacoraText = content.replace(prefix, '').trim();
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
                    "max_tokens": 2500,
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

    // 4. Comando general !aletheia
    else if (content.startsWith('!aletheia')) {
        const promptText = content.replace('!aletheia', '').trim();
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
                    "max_tokens": 2500,
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
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("Error crítico al iniciar sesión en Discord:", err);
});
