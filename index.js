import http from 'http';
import sqlite3 from 'sqlite3';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

// 1. Servidor HTTP básico para Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Orquestador de Agentes Activo');
}).listen(PORT);

// ==========================================
// CONFIGURACIÓN DE BASE DE DATOS (SQLITE)
// ==========================================
const db = new sqlite3.Database('./aletheia_memory.db', (err) => {
    if (err) console.error('Error al conectar con SQLite:', err.message);
    else console.log('Conectado a la base de datos SQLite.');
});

// Inicialización de tablas
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

// Funciones Helper para SQLite (Promesas)
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
// PROVEEDORES DE IA (INDEPENDENCIA DE MODELOS)
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

// ==========================================
// DEFINICIÓN DE IDENTIDAD DE ALETHEIA
// ==========================================
const ALETHEIA_PROMPT = `
Eres Aletheia, la agente operativa y estratega del equipo de Angel.
Tu backend corre de forma independiente sobre el motor Gemini.
Procesa ideas, tareas y reportes de forma rápida, concisa y ejecutiva.
`;

// ==========================================
// REGISTRO DE COMANDOS SLASH
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
        .setDescription('[Aletheia] Muestra la lista de tareas pendientes en la base de datos'),
    new SlashCommandBuilder()
        .setName('aletheia-completar')
        .setDescription('[Aletheia] Marca una tarea como completada por su ID')
        .addIntegerOption(opt => opt.setName('id').setDescription('ID de la tarea').setRequired(true))
].map(cmd => cmd.toJSON());

// ==========================================
// CLIENTE DISCORD E INTERACCIONES
// ==========================================
const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

discordClient.once('ready', async () => {
    console.log(`Orquestador en línea. Conectado como ${discordClient.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(discordClient.user.id), { body: commands });
        console.log('Comandos de Aletheia con Base de Datos registrados.');
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
            const respuesta = await callGeminiEngine(ALETHEIA_PROMPT, `[COMANDO /ALETHEIA-IDEA]: Analiza esta idea: "${detalle}"`);
            
            // Persistencia en DB
            await dbRun('INSERT INTO ideas (detalle, analisis) VALUES (?, ?)', [detalle, respuesta]);
            await respondInChunks(interaction, '💡 **Idea Registrada y Guardada en Memoria**\n', respuesta);
        } 
        else if (commandName === 'aletheia-tarea') {
            const descripcion = options.getString('descripcion');
            const respuesta = await callGeminiEngine(ALETHEIA_PROMPT, `[COMANDO /ALETHEIA-TAREA]: Desglosa esta tarea: "${descripcion}"`);
            
            // Persistencia en DB
            await dbRun('INSERT INTO tareas (descripcion) VALUES (?)', [descripcion]);
            await respondInChunks(interaction, '📌 **Tarea Guardada en Memoria**\n', respuesta);
        }
        else if (commandName === 'aletheia-pendientes') {
            const filas = await dbAll("SELECT id, descripcion, fecha FROM tareas WHERE estado = 'PENDIENTE' ORDER BY id DESC");
            if (filas.length === 0) {
                await interaction.editReply('📋 **No hay tareas pendientes en la base de datos.**');
                return;
            }

            let lista = '📋 **Lista de Tareas Pendientes:**\n\n';
            filas.forEach(row => {
                lista += `• **[ID: ${row.id}]** ${row.descripcion} _(${row.fecha})_\n`;
            });

            await respondInChunks(interaction, '', lista);
        }
        else if (commandName === 'aletheia-completar') {
            const id = options.getInteger('id');
            const res = await dbRun("UPDATE tareas SET estado = 'COMPLETADA' WHERE id = ?", [id]);
            
            if (res.changes > 0) {
                await interaction.editReply(`✅ **Tarea ID #${id} marcada como completada.**`);
            } else {
                await interaction.editReply(`❌ No se encontró ninguna tarea con el ID #${id}.`);
            }
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

// Mención directa en canales de texto
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
