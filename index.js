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

    // 1. Comando principal de IA (!aletheia)
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

    // 2. Sistema de Bitácora (!bitacora o !bit)
    if (message.content.startsWith('!bitacora') || message.content.startsWith('!bit')) {
        const prefix = message.content.startsWith('!bitacora') ? '!bitacora' : '!bit';
        const bitacoraText = message.content.replace(prefix, '').trim();

        if (!bitacoraText) {
            return message.reply('Escribe la nota o el registro que deseas guardar en tu bitácora después del comando.');
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
                    "messages": [
                        { 
                            "role": "system", 
                            "content": "Eres Aletheia, un asistente metodológico. El usuario te proporcionará una nota rápida de su bitácora personal. Tu tarea es formatearla de manera limpia, ordenada, resaltando los conceptos clave o puntos de acción bajo una estructura rigurosa." 
                        },
                        { 
                            "role": "user", 
                            "content": bitacoraText 
                        }
                    ]
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error('Error en Bitácora OpenRouter:', data.error);
                return message.reply(`Error al registrar la bitácora: ${data.error.message || 'Desconocido'}`);
            }

            const formattedNote = data.choices?.[0]?.message?.content || bitacoraText;
            const replyMessage = `📌 **[BITÁCORA REGISTRADA]**\n> *Autor: ${message.author.username}*\n\n${formattedNote}`;

            if (replyMessage.length > 2000) {
                const chunks = replyMessage.match(/[\s\S]{1,1900}/g);
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                await message.reply(replyMessage);
            }

        } catch (error) {
            console.error('Error al procesar la bitácora:', error);
            await message.reply('Ocurrió un error al intentar estructurar tu bitácora.');
        }
    }

    // 3. Nuevo: Protocolo Tekton (!protocolo o !proto) -> Análisis Riguroso / Falsación
    if (message.content.startsWith('!protocolo') || message.content.startsWith('!proto')) {
        const prefix = message.content.startsWith('!protocolo') ? '!protocolo' : '!proto';
        const protoText = message.content.replace(prefix, '').trim();

        if (!protoText) {
            return message.reply('Ingresa la premisa o teoría que deseas someter a protocolo analítico.');
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
                    "messages": [
                        { 
                            "role": "system", 
                            "content": "Eres Aletheia operando bajo el Protocolo Tekton. Analiza la entrada del usuario aplicando rigor científico y filosófico. Divide tu respuesta estrictamente en: 1. Premisa Central, 2. Análisis Crítico / Contradicciones, 3. Criterio de Falsación, y 4. Conclusión Metodológica." 
                        },
                        { 
                            "role": "user", 
                            "content": protoText 
                        }
                    ]
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error('Error en Protocolo OpenRouter:', data.error);
                return message.reply(`Error en protocolo: ${data.error.message || 'Desconocido'}`);
            }

            const protoResult = data.choices?.[0]?.message?.content || "No se pudo procesar el protocolo.";
            const replyMessage = `⚙️ **[PROTOCOLO TEKTON - EJECUTADO]**\n\n${protoResult}`;

            if (replyMessage.length > 2000) {
                const chunks = replyMessage.match(/[\s\S]{1,1900}/g);
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                await message.reply(replyMessage);
            }

        } catch (error) {
            console.error('Error al ejecutar el protocolo:', error);
            await message.reply('Ocurrió un error al procesar el protocolo tekton.');
        }
    }

    // 4. Nuevo: Modelo Atlas (!modelo o !atlas) -> Mapeo Conceptual de Sistemas
    if (message.content.startsWith('!modelo') || message.content.startsWith('!atlas')) {
        const prefix = message.content.startsWith('!modelo') ? '!modelo' : '!atlas';
        const modelText = message.content.replace(prefix, '').trim();

        if (!modelText) {
            return message.reply('Ingresa el concepto o sistema que deseas mapear en el Atlas.');
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
                    "messages": [
                        { 
                            "role": "system", 
                            "content": "Eres Aletheia operando bajo Modelos Atlas. Construye un modelo conceptual o sistémico del tema que provea el usuario. Estructura la respuesta en: 1. Núcleo Conceptual, 2. Variables del Sistema, 3. Interacciones / Flujos, y 4. Puntos Críticos de Falla." 
                        },
                        { 
                            "role": "user", 
                            "content": modelText 
                        }
                    ]
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error('Error en Atlas OpenRouter:', data.error);
                return message.reply(`Error en modelo: ${data.error.message || 'Desconocido'}`);
            }

            const atlasResult = data.choices?.[0]?.message?.content || "No se pudo generar el modelo.";
            const replyMessage = `🗺️ **[MODELO ATLAS - MAPEO SISTÉMICO]**\n\n${atlasResult}`;

            if (replyMessage.length > 2000) {
                const chunks = replyMessage.match(/[\s\S]{1,1900}/g);
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                await message.reply(replyMessage);
            }

        } catch (error) {
            console.error('Error al generar el modelo atlas:', error);
            await message.reply('Ocurrió un error al procesar el modelo.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
