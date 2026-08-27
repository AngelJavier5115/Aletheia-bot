import http from 'http';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

// 1. Servidor HTTP para mantener activo el servicio en Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Orquestador de Agentes Activo');
}).listen(PORT);

// 2. Definición de Identidad y Memoria Estratégica
const ALETHEIA_SYSTEM_PROMPT = `
Eres Aletheia, la agente operativa y estratega del equipo. 
Tus directivas principales son:
1. Actúas como el puente operativo entre Angel (tu líder), el equipo de desarrollo y la mesa de estrategia.
2. Tu propósito es ejecutar, capturar tareas, organizar ideas y generar reportes ejecutivos.
3. Respeta siempre el formato: conciso, estructurado con viñetas, directo al punto y visualmente limpio.
4. Mantienes una actitud profesional, analítica y orientada a resultados.
`;

// 3. Definición de Comandos Slash (Slash Commands)
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

// 4. Llamada REST a Gemini API
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

// 5. Cliente de Discord e Interacciones
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

discordClient.once('ready', async () => {
    console.log(`Orquestador en línea. Conectado como ${discordClient.user.tag}`);
    
    // Registro automático de Comandos Slash al iniciar
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

// Manejo de interacciones de Comandos Slash
discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;
    await interaction.deferReply();

    try {
        if (commandName === 'idea') {
            const detalle = options.getString('detalle');
            const prompt = `[COMANDO /IDEA ACTIVADO]: Registra y analiza la siguiente idea brevemente para la mesa estratégica: "${detalle}"`;
            const respuesta = await getGeminiResponse(prompt);
            await interaction.editReply(`💡 **Idea Registrada**\n${respuesta}`);
        } 
        else if (commandName === 'tarea') {
            const descripcion = options.getString('descripcion');
            const prompt = `[COMANDO /TAREA ACTIVADO]: Estructura la siguiente tarea asignada con pasos ejecutivos: "${descripcion}"`;
            const respuesta = await getGeminiResponse(prompt);
            await interaction.editReply(`📌 **Tarea Configurada**\n${respuesta}`);
        } 
        else if (commandName === 'reporte') {
            const prompt = `[COMANDO /REPORTE ACTIVADO]: Genera un reporte ejecutivo breve sobre la sincronización operativa de los agentes y próximos pasos.`;
            const respuesta = await getGeminiResponse(prompt);
            await interaction.editReply(`📊 **Reporte de Estado**\n${respuesta}`);
        }
    } catch (error) {
        console.error('Error en interacción:', error);
        await interaction.editReply(`❌ Error al procesar comando: ${error.message}`);
    }
});

// Respuestas a menciones tradicionales
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
            await message.reply(responseText.substring(0, 1900));

        } catch (error) {
            console.error("DETALLE DEL ERROR:", error);
            await message.reply(`❌ Error: ${error.message || 'Falla interna en el módulo'}`);
        }
    }
});

discordClient.login(process.env.DISCORD_TOKEN);
