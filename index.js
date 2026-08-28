import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// MANTENEMOS ÚNICAMENTE EL COMANDO NATIVO DE ALETHEIA
const commands = [
  new SlashCommandBuilder()
    .setName('aletheia-sintesis')
    .setDescription('Aletheia evalúa el historial y actualiza el estado epistémico de las investigaciones')
].map(cmd => cmd.toJSON());

process.on('unhandledRejection', error => {
  console.error('Unhandled Rejection silencioso:', error);
});

client.once('ready', async () => {
  console.log(`Nodo Aletheia activo como ${client.user.tag}`);
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    // Sobrescribe el registro global en Discord eliminando los comandos antiguos
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Comandos de Aletheia actualizados y limpios.');
  } catch (e) {
    console.error('Error registrando comandos:', e);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.deferReply();
  } catch (e) {
    console.error('Error al diferir respuesta:', e);
    return;
  }

  const { commandName } = interaction;

  try {
    if (commandName === 'aletheia-sintesis') {
      const { data: historial, error } = await supabase
        .from('investigaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        return await interaction.editReply(`Error leyendo base de datos: ${error.message}`);
      }

      if (!historial || historial.length === 0) {
        return await interaction.editReply('No hay investigaciones registradas aún para sintetizar.');
      }

      const prompt = `Eres Aletheia, nodo de falsación del Proyecto Arkhé. 
Analiza las siguientes investigaciones y genera un informe de evaluación epistémica.
Para cada registro analizado, asigna su nuevo estado ('corroborado', 'falsado', o 'ruido') según corresponda a su validez formal.

Registros a evaluar:
${JSON.stringify(historial, null, 2)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sintesis_markdown: { 
                type: Type.STRING, 
                description: 'Informe legible completo en Markdown para Discord' 
              },
              evaluaciones: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    nuevo_estado: { 
                      type: Type.STRING, 
                      enum: ['corroborado', 'falsado', 'ruido'] 
                    },
                    dictamen: { type: Type.STRING }
                  },
                  required: ['id', 'nuevo_estado', 'dictamen']
                }
              }
            },
            required: ['sintesis_markdown', 'evaluaciones']
          }
        }
      });

      const resultado = JSON.parse(response.text || '{}');

      if (resultado.evaluaciones && resultado.evaluaciones.length > 0) {
        for (const item of resultado.evaluaciones) {
          await supabase
            .from('investigaciones')
            .update({ 
              estado: item.nuevo_estado, 
              dictamen_aletheia: item.dictamen,
              evaluado_at: new Date().toISOString()
            })
            .eq('id', item.id);
        }
      }

      const respuestaTexto = (resultado.sintesis_markdown || 'Sin síntesis disponible.')
        .replace(/\\n/g, '\n');
      await interaction.editReply(respuestaTexto.slice(0, 2000));
    }
  } catch (err) {
    console.error(`Error procesando /${commandName}:`, err);
    await interaction.editReply('Ocurrió un error interno al procesar el comando.');
  }
});

client.login(process.env.DISCORD_TOKEN);
