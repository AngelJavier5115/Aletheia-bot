require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

// Inicializar cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Inicializar cliente Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Función para enviar mensajes largos fragmentados
async function sendSplitMessages(destination, text, maxLength = 1900) {
  if (text.length <= maxLength) {
    await destination.send(text);
    return;
  }
  let index = 0;
  while (index < text.length) {
    let chunk = text.substring(index, index + maxLength);
    await destination.send(chunk);
    index += maxLength;
  }
}

// Definición de Comandos Slash
const commands = [
  new SlashCommandBuilder()
    .setName('aletheia-tarea')
    .setDescription('Registra una nueva tarea en la base de datos central')
    .addStringOption(option =>
      option.setName('descripcion')
        .setDescription('Detalle de la tarea a registrar')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('aletheia-completar')
    .setDescription('Marca una tarea como completada')
    .addIntegerOption(option =>
      option.setName('id')
        .setDescription('ID de la tarea a completar')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('aletheia-resumen')
    .setDescription('Genera un reporte ejecutivo consolidado del backlog con Gemini'),
  new SlashCommandBuilder()
    .setName('aletheia-exportar')
    .setDescription('Exporta el estado del sistema en JSON para sincronizar contexto')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  console.log(`Orquestador en línea. Conectado como ${client.user.tag}`);
  console.log('Base de datos conectada: Supabase Cloud.');

  try {
    console.log('Registrando comandos Slash globalmente...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('Comandos registrados correctamente.');
  } catch (error) {
    console.error('Error registrando comandos:', error);
  }
});

// Manejo de Comandos Slash
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'aletheia-tarea') {
    const desc = interaction.options.getString('descripcion');
    await interaction.deferReply();
    const { data, error } = await supabase
      .from('tareas')
      .insert([{ descripcion: desc, estado: 'PENDIENTE' }])
      .select();

    if (error) {
      await interaction.editReply(`❌ Error al guardar tarea: ${error.message}`);
    } else {
      await interaction.editReply(`📌 **Tarea registrada (ID #${data[0].id}):** ${desc}`);
    }
  }

  else if (commandName === 'aletheia-completar') {
    const id = interaction.options.getInteger('id');
    await interaction.deferReply();
    const { data, error } = await supabase
      .from('tareas')
      .update({ estado: 'COMPLETADA' })
      .eq('id', id)
      .select();

    if (error || data.length === 0) {
      await interaction.editReply(`❌ No se encontró la tarea ID #${id} o falló la actualización.`);
    } else {
      await interaction.editReply(`✅ Tarea ID #${id} marcada como completada.`);
    }
  }

  else if (commandName === 'aletheia-resumen') {
    await interaction.deferReply();
    
    // Consulta flexible para traer tareas pendientes sin restricciones estrictas de mayúsculas
    const { data: tareas, error } = await supabase
      .from('tareas')
      .select('*')
      .neq('estado', 'COMPLETADA');

    if (error) {
      await interaction.editReply(`❌ Error al consultar tareas: ${error.message}`);
      return;
    }

    const prompt = `Actúa como Aletheia, la IA Orquestadora Estratégica del Sistema Arkhé.
Analiza la siguiente lista de tareas pendientes registrada en la base de datos central:
${JSON.stringify(tareas, null, 2)}

Genera un reporte ejecutivo breve y estructurado en Markdown con:
1. Estado general del backlog.
2. Estatus operativo del sistema.
3. Acción requerida o sugerencia de priorización.
Mantén un tono profesional, analítico y directo.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      const resumenText = typeof response.text === 'function' ? response.text() : response.text;
      await interaction.editReply(`📊 **Resumen Ejecutivo de Pendientes**\n\n${resumenText}`);
    } catch (err) {
      console.error('Error con Gemini API:', err);
      await interaction.editReply(`❌ Error al procesar el resumen con Gemini: ${err.message}`);
    }
  }

  else if (commandName === 'aletheia-exportar') {
    await interaction.deferReply();
    const { data: tareas } = await supabase.from('tareas').select('*');
    const { data: ideas } = await supabase.from('ideas').select('*');

    const snapshot = {
      tareas: tareas || [],
      ideas: ideas || []
    };

    const jsonText = JSON.stringify(snapshot, null, 2);
    await interaction.editReply(`📦 **Estado Actual del Sistema (Supabase Cloud):**\n\`\`\`json\n${jsonText}\n\`\`\``);
  }
});

// Respuestas a Menciones Directas
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.mentions.has(client.user)) {
    await message.channel.sendTyping();

    const userPrompt = message.content.replace(`<@${client.user.id}>`, '').trim();

    const systemPrompt = `Eres Aletheia, la entidad Orquestadora y Analítica Central del Sistema Arkhé.
Tus funciones son la síntesis de información, la priorización estratégica y la gestión del contexto.
Responde de forma concisa, inteligente, clara y directa. Siempre mantén tu personalidad analítica.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${systemPrompt}\n\nUsuario: ${userPrompt}`
      });

      const replyText = typeof response.text === 'function' ? response.text() : response.text;
      await sendSplitMessages(message.channel, replyText);
    } catch (error) {
      console.error('Error al responder:', error);
      await message.channel.send('❌ Ocurrió un error al procesar tu solicitud con el motor de Gemini.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
