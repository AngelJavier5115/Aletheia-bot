import http from 'http';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

// 1. Servidor HTTP básico para Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Orquestador de Agentes Activo');
}).listen(PORT);

// 2. Definición del Prompt de Sistema (Memoria e Identidad)
const ALETHEIA_SYSTEM_PROMPT = `
Eres Aletheia, la agente operativa y estratega del equipo. 
Tus directivas principales son:
1. Actúas como el puente operativo entre Angel (tu líder), el equipo de desarrollo y la mesa de estrategia.
2. Tu propósito es ejecutar, capturar tareas, organizar ideas y generar reportes ejecutivos.
3. Respeta siempre el formato: conciso, estructurado con viñetas, directo al punto y visualmente limpio.
4. Mantienes una actitud profesional, analítica y orientada a resultados.
`;

// 3. Comandos Slash
const commands = [
    new SlashCommandBuilder()
        .setName('idea')
        .setDescription('Registra una idea o concepto para la mesa de estrategia')
        .addStringOption(option => 
            option.setName('detalle')
                .setDescription('Descripción de la idea')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('tarea')
        .setDescription('Asigna o registra una tarea operativa')
        .addStringOption(option => 
            option.setName('descripcion')
                .setDescription('Detalle de la tarea a realizar')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('reporte')
        .setDescription('Genera un análisis estratégico rápido del estado del proyecto')
].map(command => command.toJSON());

// 4. Llamada REST a la API de Gemini
async function getGeminiResponse(promptContext) {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        { text: ALETHEIA_SYSTEM_PROMPT },
                        { text: promptContext }
                    ]
                }
            ]
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || `Error HTTP ${response.status}`);
    }

    return data.candidates[0].content.parts[0].text;
}

// 5. Función auxiliar para enviar mensajes largos fragmentados sin cortar texto
async function sendLongMessage(target, text) {
    const MAX_LENGTH = 1900;
    if (text.length <= MAX_LENGTH) {
        if (target.reply) {
            await target.reply(text);
        } else if (target.editReply) {
            await target.editReply(text);
        } else {
            await target.send(text);
        }
        return;
    }

    const chunks = [];
    let currentText = text;

    while (currentText.length > 0) {
        if (currentText.length <= MAX_LENGTH) {
            chunks.push(currentText);
            break;
        }

        let cutIndex = currentText.lastIndexOf('\n', MAX_LENGTH);
        if (cutIndex === -1 || cutIndex < 1000) {
            cutIndex = MAX_LENGTH;
        }

        chunks.push(currentText.substring(0, cutIndex));
        currentText = currentText.substring(cutIndex).trim();
    }

    for (let i = 0; i < chunks.length; i++) {
        if (i === 0) {
            if (target.reply) {
                await target.reply(chunks[i]);
            } else if (target.editReply) {
                await target.editReply(chunks[i]);
            }
        } else {
            await target.channel.send(chunks[i]);
        }
    }
}

// 6. Cliente de Discord
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

discordClient.once('ready', async () => {
    console.log(`Orquestador en línea. Conectado como ${discordClient.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Registrando comandos slash...');
        await rest.put(
            Routes.applicationCommands(discordClient.user.id),
            { body: commands }
        );
        console.log('Comandos slash registrados con éxito.');
    } catch (error) {
        console.error('Error al registrar comandos:', error);
    }
});

// Interacciones con Comandos Slash
discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;
    await interaction.deferReply();

    try {
        let prompt = '';
        let title = '';

        if (commandName === 'idea') {
            const detalle = options.getString('detalle');
            prompt = `[COMANDO /IDEA ACTIVADO]: Registra y analiza la siguiente idea brevemente para la mesa estratégica: "${detalle}"`;
            title = '💡 **Idea Registrada**\n';
        } 
        else if (commandName === 'tarea') {
            const descripcion = options.getString('descripcion');
            prompt = `[COMANDO /TAREA ACTIVADO]: Estructura la siguiente tarea asignada con pasos ejecutivos: "${descripcion}"`;
            title = '📌 **Tarea Configurada**\n';
        } 
        else if (commandName === 'reporte') {
            prompt = `[COMANDO /REPORTE ACTIVADO]: Genera un reporte ejecutivo breve sobre la sincronización operativa de los agentes y próximos pasos.`;
            title = '📊 **Reporte de Estado**\n';
        }

        const respuesta = await getGeminiResponse(prompt);
        await sendLongMessage(interaction, `${title}${respuesta}`);

    } catch (error) {
        console.error('Error en interacción:', error);
        await interaction.editReply(`❌ Error al procesar comando: ${error.message}`);
    }
});

// Menciones directas en canal
discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.mentions.has(discordClient.user)) {
        try {
            await message.channel.sendTyping();
            const cleanContent = message.content.replace(/<@!?\d+>/g, '').trim();

            if (!cleanContent) {
                await message.reply("¿En qué puedo ayudarte hoy?");
                return;
            }

            const prompt = `[MENSAJE DIRECTO]: ${cleanContent}`;
            const responseText = await getGeminiResponse(prompt);
            await sendLongMessage(message, responseText);

        } catch (error) {
            console.error("DETALLE DEL ERROR:", error);
            await message.reply(`❌ Error: ${error.message || 'Falla interna en el módulo'}`);
        }
    }
});

discordClient.login(process.env.DISCORD_TOKEN);
