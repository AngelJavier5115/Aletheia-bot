import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Comandos actualizados para la Fase 2 (Investigaciones & Debates)
const commands = [
  new SlashCommandBuilder()
    .setName('arkhe-aportar')
    .setDescription('Registra una hipótesis, propuesta o crítica en la red')
    .addStringOption(opt => opt.setName('contenido').setDescription('El texto de tu aporte').setRequired(true))
    .addStringOption(opt => opt.setName('tipo').setDescription('Tipo de registro').addChoices(
      { name: 'Propuesta', value: 'propuesta' },
      { name: 'Crítica / Objeción', value: 'critica' },
      { name: 'Falsación', value: 'falsacion' },
      { name: 'Aporte General', value: 'aporte' }
    ))
    .addIntegerOption(opt => opt.setName('ref_id').setDescription('ID de la investigación a la que respondes (opcional)')),

  new SlashCommandBuilder()
    .setName('arkhe-feedback')
    .setDescription('Comando de corrección de rumbo: registra cuando algo no funciona')
    .addStringOption(opt => opt.setName('motivo').setDescription('Explica qué fallo o qué debe cambiar').setRequired(true)),

  new SlashCommandBuilder()
    .setName('aletheia-sintesis')
    .setDescription('Aletheia analiza el historial de investigaciones y genera una síntesis de la red')
].map(cmd => cmd.toJSON());

process.on('unhandledRejection', error => {
  console.error('Unhandled Rejection caught:', error);
});

client.once('ready', async () => {
  console.log(`Nodo Aletheia activo como ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === 'arkhe-aportar') {
      const contenido = interaction.options.getString('contenido');
      const tipo = interaction.options.getString('tipo') || 'aporte';
      const refId = interaction.options.getInteger('ref_id');

      const { data, error } = await supabase.from('investigaciones').insert([{
        autor: 'organico', // Si usas el comando tú, se registra como orgánico
        contenido,
        tipo,
        ref_id: refId
      }]).select();

      if (error) throw error;
      await interaction.reply(` Aporte registrado en **investigaciones** con ID **#${data[0].id}** [Tipo: \`${tipo}\`]`);
    }

    else if (commandName === 'arkhe-feedback') {
      const motivo = interaction.options.getString('motivo');

      const { data, error } = await supabase.from('investigaciones').insert([{
        autor: 'organico',
        contenido: motivo,
        tipo: 'feedback_organico',
        metadata: { severidad: 'alta', requiere_revision: true }
      }]).select();

      if (error) throw error;
      await interaction.reply(` **Corrección de Rumbo (Feedback Orgánico) registrada con ID #${data[0].id}**. La red dará prioridad a este aviso.`);
    }

    else if (commandName === 'aletheia-sintesis') {
      await interaction.deferReply();

      const { data: historial, error } = await supabase
        .from('investigaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;

      const prompt = `Eres Aletheia, nodo de falsación y síntesis del Proyecto Arkhé. Analiza las últimas entradas de la tabla de investigaciones y entrega un resumen de convergencias, divergencias y estado de la red:\n${JSON.stringify(historial, null, 2)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt
      });

      await interaction.editReply(response.text);
    }
  } catch (err) {
    console.error(`Error en /${commandName}:`, err);
    if (interaction.deferred) {
      await interaction.editReply('Error al comunicarse con la base de investigaciones.');
    } else {
      await interaction.reply({ content: 'Error interno en el nodo.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
