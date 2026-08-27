import http from 'http';
import sqlite3 from 'sqlite3';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

// ==========================================
// 1. SERVIDOR HTTP Y ENDPOINT API PARA LA NUBE
// ==========================================
const PORT = process.env.PORT || 3000;
http.createServer(async (req, res) => {
    if (req.url === '/api/estado' && req.method === 'GET') {
        try {
            const tareas = await dbAll("SELECT * FROM tareas WHERE estado = 'PENDIENTE'");
            const ideas = await dbAll("SELECT * FROM ideas ORDER BY id DESC LIMIT 5");
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ tareas, ideas }, null, 2));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Orquestador de Agentes Activo');
    }
}).listen(PORT);

// ==========================================
// 2. BASE DE DATOS (SQLITE)
// ==========================================
const db = new sqlite3.Database('./aletheia_memory.db', (err) => {
    if (err) console.error('Error al conectar con SQLite:', err.message);
    else console.log('Conectado a la base de datos SQLite.');
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS tareas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descripcion TEXT NOT NULL,
            estado TEXT DEFAULT 'PENDIENTE',
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS ideas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            detalle TEXT NOT NULL,
            analisis TEXT,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// ==========================================
// 3. MOTOR DE IA (GEMINI)
// ==========================================
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

const ALETHEIA_PROMPT = `
Eres Aletheia, la agente operativa y estratega del equipo de Angel.
Tu backend corre de forma independiente sobre el motor Gemini.
Procesa ideas, tareas y reportes de forma rápida, concisa y ejecutiva.
`;

// ==========================================
// 4. COMANDOS SLASH
// ==========================================
const commands = [
    new SlashCommandBuilder()
        .setName('aletheia-idea')
        .setDescription('[Aletheia] Registra y analiza una idea')
        .addStringOption(opt => opt.setName('detalle').setDescription('Detalle de la idea').setRequired(true)),
    new SlashCommandBuilder()
        .setName('aletheia-tarea')
        .setDescription('[Aletheia] Registra y desglosa una tarea')
        .addStringOption(opt => opt.setName('descripcion').setDescription('Descripción de la tarea').setRequired(true)),
    new SlashCommandBuilder()
        .setName('aletheia-pendientes')
        .setDescription('[Aletheia] Muestra las tareas pendientes'),
    new SlashCommandBuilder()
        .setName('aletheia-completar')
        .setDescription('[Aletheia] Marca una tarea como completada por ID')
        .addIntegerOption(opt => opt.setName('id').setDescription('ID de la tarea').setRequired(true)),
    new SlashCommandBuilder()
        .setName('aletheia-resumen')
        .setDescription('[Aletheia] Genera un resumen ejecutivo de las tareas pendientes'),
    new SlashCommandBuilder()
        .setName('aletheia-exportar')
        .setDescription('[Aletheia] Genera un reporte formateado para sincronizar contexto')
].map(cmd => cmd.toJSON());

// ==========================================
// 5. CLIENTE DISCORD
// ==========================================
const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

discordClient.once('ready', async () => {
    console.log(`Orquestador en línea. Conectado como ${discordClient.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(discordClient.user.id), { body: commands });
        console.log('Comandos registrados correctamente.');
    } catch (err) {
        console.error('Error al registrar comandos:', err);
    }
});

discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options } = interaction;
    await interaction.deferReply();

    try {
        if (commandName === 'aletheia-idea') {
            const detalle = options.getString('detalle');
            const respuesta = await callGeminiEngine(ALETHEIA_PROMPT, `Analiza esta idea: "${detalle}"`);
            await dbRun('INSERT INTO ideas (detalle, analisis) VALUES (?, ?)', [detalle, respuesta]);
            await respondInChunks(interaction, '💡 **Idea Registrada y Guardada en Memoria**\n', respuesta);
        } 
        else if (commandName === 'aletheia-tarea') {
            const descripcion = options.getString('descripcion');
            const respuesta = await callGeminiEngine(ALETHEIA_PROMPT, `Desglosa esta tarea: "${descripcion}"`);
            await dbRun('INSERT INTO tareas (descripcion) VALUES (?)', [descripcion]);
            await respondInChunks(interaction, '📌 **Tarea Guardada en Memoria**\n', respuesta);
        }
        else if (commandName === 'aletheia-pendientes') {
            const filas = await dbAll("SELECT id, descripcion, fecha FROM tareas WHERE estado = 'PENDIENTE' ORDER BY id DESC");
            if (filas.length === 0) return await interaction.editReply('📋 **No hay tareas pendientes.**');

            let lista = '📋 **Lista de Tareas Pendientes:**\n\n';
            filas.forEach(r => { lista += `• **[ID: ${r.id}]** ${r.descripcion} _(${r.fecha})_\n`; });
            await respondInChunks(interaction, '', lista);
        }
        else if (commandName === 'aletheia-completar') {
            const id = options.getInteger('id');
            const res = await dbRun("UPDATE tareas SET estado = 'COMPLETADA' WHERE id = ?", [id]);
            if (res.changes > 0) await interaction.editReply(`✅ **Tarea ID #${id} completada.**`);
            else await interaction.editReply(`❌ No se encontró la tarea #${id}.`);
        }
        else if (commandName === 'aletheia-resumen') {
            const tareas = await dbAll("SELECT id, descripcion FROM tareas WHERE estado = 'PENDIENTE'");
            const prompt = `Genera un resumen ejecutivo corto y priorizado de estas tareas pendientes:\n${JSON.stringify(tareas)}`;
            const resumen = await callGeminiEngine(ALETHEIA_PROMPT, prompt);
            await respondInChunks(interaction, '📊 **Resumen Ejecutivo de Pendientes**\n\n', resumen);
        }
        else if (commandName === 'aletheia-exportar') {
            const tareas = await dbAll("SELECT id, descripcion, estado FROM tareas ORDER BY id DESC LIMIT 10");
            const ideas = await dbAll("SELECT id, detalle FROM ideas ORDER BY id DESC LIMIT 5");
            
            let exportData = "```json\n" + JSON.stringify({ tareas, ideas }, null, 2) + "\n```";
            await respondInChunks(interaction, '📦 **Estado Actual del Sistema (Copia este bloque para sincronizar):**\n', exportData);
        }
    } catch (error) {
        console.error('Error procesando interacción:', error);
        await interaction.editReply(`❌ Error de agente: ${error.message}`);
    }
});

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
