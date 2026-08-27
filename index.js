import http from 'http';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

// 1. Servidor HTTP básico para Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Orquestador de Agentes Activo');
}).listen(PORT);

// ==========================================
// PROVEEDORES DE IA (INDEPENDENCIA DE MODELOS)
// ==========================================

// Motor exclusivo para Aletheia: Gemini 3.6 Flash
async function callGeminiEngine(systemPrompt, userPrompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: systemPrompt },
                    { text: userPrompt }
                ]
            }]
        })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `Error HTTP ${response.status}`);
    return data.candidates[0].content.parts[0].text;
}

// Motor exclusivo para Atlas: ChatGPT (OpenAI)
async function callOpenAIEngine(systemPrompt, userPrompt) {
    const apiKey = process.env.OPENAI_API_KEY; // Requiere esta variable en Render si usas Atlas
    const url = `https://api.openai.com/v1/chat/completions`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini", // O gpt-4o
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `Error HTTP ${response.status}`);
    return data.choices[0].message.content;
}

// ==========================================
// DEFINICIÓN DE IDENTIDADES Y PROMPTS
// ==========================================

const ALETHEIA_PROMPT = `
Eres Aletheia, la agente operativa y estratega del equipo de Angel.
Tu backend corre de forma independiente sobre el motor Gemini.
Procesa ideas, tareas y reportes de forma rápida, concisa y ejecutiva.
`;

const ATLAS_PROMPT = `
Eres Atlas, el arquitecto de datos y estructuras del equipo de Angel.
Tu backend corre de forma independiente sobre el motor ChatGPT (OpenAI).
Proporcionas análisis estructurales, diagramas y diseño de sistemas.
`;

// ==========================================
// REGISTRO DE COMANDOS SEPARADOS
// ==========================================

const commands = [
    // Comandos de Aletheia (Usan Gemini)
    new SlashCommandBuilder().setName('aletheia-idea').setDescription('[Aletheia/Gemini] Registra una idea').addStringOption(opt => opt.setName('detalle').setDescription('Detalle').setRequired(true)),
    new SlashCommandBuilder().setName('aletheia-tarea').setDescription('[Aletheia/Gemini] Estructura una tarea').addStringOption(opt => opt.setName('descripcion').setDescription('Descripción').setRequired(true)),
    
    // Comandos de Atlas (Usan ChatGPT)
    new SlashCommandBuilder().setName('atlas-arquitectura').setDescription('[Atlas/ChatGPT] Diseña una estructura o arquitectura').addStringOption(opt => opt.setName('consulta').setDescription('Detalle').setRequired(true))
].map(cmd => cmd.toJSON());

// ==========================================
// MANEJO DE CLIENTE DISCORD E INTERACCIONES
// ==========================================

const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

discordClient.once('ready', async () => {
    console.log(`Orquestador en línea. Conectado como ${discordClient.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(discordClient.user.id), { body: commands });
        console.log('Comandos de agentes independientes registrados.');
    } catch (err) {
        console.error('Error al registrar comandos:', err);
    }
});

discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options } = interaction;
    await interaction.deferReply();

    try {
        let respuesta = '';

        // RUTEO DE AGENTES: Cada comando llama a su propio motor de IA
        if (commandName.startsWith('aletheia-')) {
            const input = options.getString('detalle') || options.getString('descripcion');
            // Aletheia invoca a Gemini
            respuesta = await callGeminiEngine(ALETHEIA_PROMPT, `[${commandName}]: ${input}`);
            await respondInChunks(interaction, '💡 **Aletheia (Gemini)**\n', respuesta);
        } 
        else if (commandName.startsWith('atlas-')) {
            const input = options.getString('consulta');
            // Atlas invoca a ChatGPT
            respuesta = await callOpenAIEngine(ATLAS_PROMPT, `[${commandName}]: ${input}`);
            await respondInChunks(interaction, '🏛️ **Atlas (ChatGPT)**\n', respuesta);
        }
    } catch (error) {
        console.error('Error procesando interacción:', error);
        await interaction.editReply(`❌ Error de agente: ${error.message}`);
    }
});

// Función auxiliar de fragmentación segura
async function respondInChunks(interaction, title, text) {
    const fullText = `${title}${text}`;
    if (fullText.length <= 1900) {
        await interaction.editReply(fullText);
        return;
    }
    const chunks = fullText.match(/[\s\S]{1,1900}/g) || [];
    for (let i = 0; i < chunks.length; i++) {
        if (i === 0) await interaction.editReply(chunks[i]);
        else await interaction.followUp(chunks[i]);
    }
}

// Mención directa responde con Aletheia por defecto
discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.mentions.has(discordClient.user)) {
        try {
            await message.channel.sendTyping();
            const cleanContent = message.content.replace(/<@!?\d+>/g, '').trim();
            if (!cleanContent) return message.reply("¿En qué puedo ayudarte?");

            const responseText = await callGeminiEngine(ALETHEIA_PROMPT, cleanContent);
            await message.reply(responseText.substring(0, 1900));
        } catch (error) {
            await message.reply(`❌ Error: ${error.message}`);
        }
    }
});

discordClient.login(process.env.DISCORD_TOKEN);
