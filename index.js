import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
    .addIntegerOption(opt => opt.setName('ref_id').setDescription('ID al que respondes (opcional)')),

  new SlashCommandBuilder()
    .setName('arkhe-feedback')
    .setDescription('Comando de corrección de rumbo')
    .addStringOption(opt => opt.setName('motivo').setDescription('Explica qué debe cambiar').setRequired(true)),

  new SlashCommandBuilder()
    .setName('aletheia-sintesis')
    .setDescription('Aletheia analiza el historial de investigaciones')
].map(cmd => cmd.toJSON());

process.on('unhandledRejection', error => console.error('Unhandled Rejection caught:', error));

client.once('ready', async () => {
  console.log(`Nodo Aletheia activo como ${client.user.tag}`);
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  } catch (e) {
    console.error('Error registrando comandos:', e);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === 'arkhe-aportar') {
      const contenido = interaction.options.getString('contenido');
      const tipo = interaction.options.getString('tipo') || 'aporte';
      const refId = interaction.options.getInteger('ref_id');

      const payload = { autor: 'organico', contenido, tipo };
      if (refId !== null) payload.ref_id = refId;

      const { data, error } = await supabase.from('investigaciones').insert([payload]).select();

      if (error) {
        return await interaction.reply({ content: `Error en BD: ${error.message}`, ephemeral: true });
      }

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

      if (error) {
        return await interaction.reply({ content: `Error en BD: ${error.message}`, ephemeral: true });
      }

      await interaction.reply(` **Corrección de Rumbo registrada con ID #${data[0].id}**.`);
    }

    else if (commandName === 'aletheia-sintesis') {
      await interaction.deferReply();

      const { data: historial, error } = await supabase
        .from('investigaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;

      const prompt = `Eres Aletheia, nodo de falsación del Proyecto Arkhé. Analiza las investigaciones:\n${JSON.stringify(historial, null, 2)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt
      });

      await interaction.editReply(response.text);
    }
  } catch (err) {
    console.error(`Error en /${commandName}:`, err);
    if (!interaction.replied) {
      await interaction.reply({ content: 'Error procesando la solicitud en el nodo.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
