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
            .setName('aletheia-completar')
            .setDescription('Marca una tarea como completada por su ID')
            .addIntegerOption(option => 
                option.setName('id').setDescription('ID de la tarea a completar').setRequired(true)),
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

    } else if (commandName === 'aletheia-completar') {
        const id = interaction.options.getInteger('id');

        const { data, error } = await supabase
            .from('tareas')
            .update({ estado: 'COMPLETADA' })
            .eq('id', id)
            .select();

        if (error || !data || data.length === 0) {
            console.error('Error Supabase al completar:', error);
            return interaction.reply({ content: `❌ No se encontró la tarea con ID #${id} o no se pudo actualizar.`, ephemeral: true });
        }

        await interaction.reply(`✅ **Tarea ID #${id} marcada como COMPLETADA.**`);

    } else if (commandName === 'aletheia-resumen') {
        await interaction.deferReply();

        try {
            const { data: tareas, error } = await supabase
                .from('tareas')
                .select('*')
                .neq('estado', 'COMPLETADA');

            if (error) throw error;

            if (!tareas || tareas.length === 0) {
                return interaction.editReply('🎉 **No hay tareas pendientes en el sistema.**');
            }

            const prompt = `Analiza las siguientes tareas pendientes y dame un resumen ejecutivo estructurado para priorizar el trabajo. Sé conciso para no sobrepasar límites de caracteres:\n${JSON.stringify(tareas, null, 2)}`;

            const response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: prompt,
            });

            let textoResumen = response.text || 'No se pudo generar contenido.';
            
            // Recorte defensivo para el límite de 2000 caracteres de Discord
            if (textoResumen.length > 1900) {
                textoResumen = textoResumen.substring(0, 1900) + '\n\n*(Resumen recortado por longitud)*';
            }

            await interaction.editReply(`🧠 **Resumen de Gemini:**\n${textoResumen}`);

        } catch (err) {
            console.error('Error Gemini/Supabase:', err);
            await interaction.editReply(`❌ Error al procesar el resumen: ${err.message}`);
        }

    } else if (commandName === 'aletheia-exportar') {
        await interaction.deferReply();

        const { data: tareas, error: errorTareas } = await supabase.from('tareas').select('*');
        const { data: ideas, error: errorIdeas } = await supabase.from('ideas').select('*');
        
        if (errorTareas || errorIdeas) {
            console.error('Error al exportar:', errorTareas || errorIdeas);
            return interaction.editReply('❌ Error al consultar la base de datos.');
        }

        const payload = {
            tareas: tareas || [],
            ideas: ideas || []
        };

        await interaction.editReply(`📦 **Estado Actual del Sistema (Supabase Cloud):**\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``);
    }
});

client.login(process.env.DISCORD_TOKEN);
