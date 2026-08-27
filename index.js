require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

// 1. Inicializar Clientes
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log(`¡Bot conectado como ${client.user.tag}!`);

    // Registrar comandos slash automáticamente
    const commands = [
        new SlashCommandBuilder()
            .setName('aletheia-tarea')
            .setDescription('Registra una nueva tarea en Supabase')
            .addStringOption(option => 
                option.setName('descripcion').setDescription('Descripción de la tarea').setRequired(true)),
        new SlashCommandBuilder()
            .setName('aletheia-resumen')
            .setDescription('Genera un resumen inteligente de tus tareas pendientes usando Gemini'),
        new SlashCommandBuilder()
            .setName('aletheia-exportar')
            .setDescription('Exporta el estado actual de las tareas')
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Comandos de barra (/) registrados correctamente.');
    } catch (error) {
        console.error('Error al registrar comandos:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'aletheia-tarea') {
        const descripcion = interaction.options.getString('descripcion');
        
        // Guardar en Supabase
        const { data, error } = await supabase
            .from('tareas')
            .insert([{ descripcion, estado: 'PENDIENTE' }])
            .select();

        if (error) {
            console.error('Error Supabase:', error);
            return interaction.reply({ content: '❌ Error al guardar la tarea en la base de datos.', ephemeral: true });
        }

        const tareaId = data && data[0] ? data[0].id : 'N/A';
        await interaction.reply(`📌 **Tarea registrada (ID #${tareaId}):** ${descripcion}`);

    } else if (commandName === 'aletheia-resumen') {
        await interaction.deferReply();

        try {
            // Obtener tareas pendientes de Supabase
            const { data: tareas, error } = await supabase
                .from('tareas')
                .select('*')
                .neq('estado', 'COMPLETADA');

            if (error) throw error;

            const prompt = `Analiza las siguientes tareas pendientes y dame un resumen ejecutivo estructurado para priorizar el trabajo:\n${JSON.stringify(tareas, null, 2)}`;

            // Usando gemini-3.6-flash actualizado
            const response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: prompt,
            });

            // Extracción robusta de texto
            const textoResumen = response.text ? response.text() : 'No se pudo generar contenido.';
            await interaction.editReply(`🧠 **Resumen de Gemini:**\n${textoResumen}`);

        } catch (err) {
            console.error('Error Gemini/Supabase:', err);
            await interaction.editReply(`❌ Error al procesar el resumen: ${err.message}`);
        }

    } else if (commandName === 'aletheia-exportar') {
        await interaction.deferReply();

        const { data: tareas, error } = await supabase.from('tareas').select('*');
        
        if (error) {
            console.error('Error al exportar:', error);
            return interaction.editReply('❌ Error al consultar la base de datos.');
        }

        const payload = {
            tareas: tareas || [],
            ideas: []
        };

        await interaction.editReply(`📦 **Estado Actual del Sistema (Supabase Cloud):**\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``);
    }
});

client.login(process.env.DISCORD_TOKEN);
