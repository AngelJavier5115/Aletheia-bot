import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';
import http from 'http';

// ============================================================
// ALETHEIA — NODO DE CONTRASTE DE ARKHÉ
// ============================================================

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Aletheia Bot is active!\n');
}).listen(PORT, () => {
  console.log(`[Aletheia] Servidor HTTP activo en puerto ${PORT}`);
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const ALETHEIA_ID = '122483a9-5012-46ce-a328-5bdb08b4de01';
const ALETHEIA_NOMBRE = 'Aletheia';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ============================================================
// UTILIDAD DE SALIDA DISCORD
// Discord limita cada mensaje a 2000 caracteres.
// Esta función divide por párrafos/líneas/palabras para no
// cortar innecesariamente la producción epistemológica.
// ============================================================

const DISCORD_MAX = 2000;

function dividirMensaje(texto, max = DISCORD_MAX) {
  const partes = [];
  let restante = String(texto ?? '');

  while (restante.length > max) {
    let corte = restante.lastIndexOf('\n\n', max);

    if (corte < 1) {
      corte = restante.lastIndexOf('\n', max);
    }

    if (corte < 1) {
      corte = restante.lastIndexOf(' ', max);
    }

    if (corte < 1) {
      corte = max;
    }

    partes.push(restante.slice(0, corte).trimEnd());
    restante = restante.slice(corte).trimStart();
  }

  if (restante.length > 0) {
    partes.push(restante);
  }

  return partes;
}

async function enviarRespuestaLarga(interaction, texto) {
  const partes = dividirMensaje(texto);

  if (partes.length === 0) {
    return await interaction.editReply('Sin contenido disponible.');
  }

  await interaction.editReply(partes[0]);

  for (let i = 1; i < partes.length; i++) {
    await interaction.followUp(partes[i]);
  }
}

// ============================================================
// COMANDOS
// ============================================================

const commands = [
  new SlashCommandBuilder()
    .setName('aletheia-sintesis')
    .setDescription('Aletheia contrasta conocimiento de una investigación y registra su posición epistemológica.')
    .addStringOption(option =>
      option
        .setName('investigacion')
        .setDescription('Código de investigación de Arkhé. Ejemplo: AR-001')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('aletheia-consultar')
    .setDescription('Aletheia consulta un nodo de la memoria compartida de Arkhé.')
    .addIntegerOption(option =>
      option
        .setName('id')
        .setDescription('ID del nodo que Aletheia consultará.')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

process.on('unhandledRejection', error => {
  console.error('[Aletheia] Unhandled Rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('[Aletheia] Uncaught Exception:', error);
});

client.once('ready', async () => {
  console.log(`[Aletheia] Bot en línea como: ${client.user.tag}`);
  console.log(`[Aletheia] Identidad Arkhé: ${ALETHEIA_NOMBRE} (${ALETHEIA_ID})`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log('[Aletheia] Comandos registrados correctamente.');
  } catch (error) {
    console.error('[Aletheia] Error registrando comandos:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (
    interaction.commandName !== 'aletheia-sintesis' &&
    interaction.commandName !== 'aletheia-consultar'
  ) {
    return;
  }

  try {
    await interaction.deferReply();

    // ========================================================
    // ALETHEIA-CONSULTAR
    // ========================================================

    if (interaction.commandName === 'aletheia-consultar') {
      const id = interaction.options.getInteger('id');

      console.log(`[Aletheia] Consultando nodo #${id}.`);

      const { data: nodo, error } = await supabase
        .from('investigaciones')
        .select(`
          id,
          contenido,
          estado,
          autor,
          tipo,
          investigador_id,
          ref_id,
          metadata,
          created_at
        `)
        .eq('id', id)
        .single();

      if (error || !nodo) {
        console.error(`[Aletheia] Nodo #${id} no encontrado:`, error);
        return await interaction.editReply(
          `[Aletheia] ❌ Nodo #${id} no encontrado en la memoria de Arkhé.`
        );
      }

      const contenido = nodo.contenido || 'Sin contenido.';
      const contenidoVisible = contenido.length > 1600
        ? `${contenido.slice(0, 1600)}\n… [contenido truncado]`
        : contenido;

      return await interaction.editReply(
        `[Aletheia] 🔎 **Consulta de memoria**\n\n` +
        `**Nodo:** #${nodo.id}\n` +
        `**Tipo:** ${nodo.tipo ?? 'No especificado'}\n` +
        `**Estado:** ${nodo.estado ?? 'No especificado'}\n` +
        `**Autor externo:** ${nodo.autor ?? 'No especificado'}\n` +
        `**Investigador Arkhé:** ${nodo.investigador_id ?? 'No especificado'}\n` +
        `**Referencia:** ${nodo.ref_id ?? 'Ninguna'}\n` +
        `**Creado:** ${nodo.created_at ?? 'No especificado'}\n\n` +
        `**Contenido:**\n${contenidoVisible}`
      );
    }

    // ========================================================
    // ALETHEIA-SÍNTESIS
    // ========================================================

    const codigoInvestigacion = interaction.options
      .getString('investigacion')
      ?.trim()
      .toUpperCase();

    console.log(`[Aletheia] Solicitud recibida para ${codigoInvestigacion}`);

    const { data: investigacion, error: investigacionError } = await supabase
      .from('investigaciones_proyecto')
      .select(`
        id,
        codigo,
        titulo,
        objetivo,
        pregunta,
        descripcion,
        estado
      `)
      .eq('codigo', codigoInvestigacion)
      .single();

    if (investigacionError || !investigacion) {
      console.error('[Aletheia] Investigación no encontrada:', investigacionError);
      return await interaction.editReply(
        `[Aletheia] ❌ No encontré la investigación **${codigoInvestigacion}** en Arkhé.`
      );
    }

    console.log(`[Aletheia] Investigación encontrada: ${investigacion.codigo} — ${investigacion.titulo}`);

    const { data: participacion, error: participacionError } = await supabase
      .from('participaciones')
      .select(`id, investigador_id, investigacion_id, estado`)
      .eq('investigador_id', ALETHEIA_ID)
      .eq('investigacion_id', investigacion.id)
      .eq('estado', 'activo')
      .maybeSingle();

    if (participacionError) {
      console.error('[Aletheia] Error verificando participación:', participacionError);
      return await interaction.editReply(
        '[Aletheia] ❌ No se pudo verificar mi participación en esta investigación.'
      );
    }

    if (!participacion) {
      return await interaction.editReply(
        `[Aletheia] ⚠️ Aletheia no participa actualmente en **${investigacion.codigo} — ${investigacion.titulo}**.`
      );
    }

    console.log(`[Aletheia] Participación confirmada: ${participacion.id}`);

    const { data: relaciones, error: relacionesError } = await supabase
      .from('investigacion_nodos')
      .select('nodo_id')
      .eq('investigacion_id', investigacion.id);

    if (relacionesError) {
      console.error('[Aletheia] Error obteniendo relaciones:', relacionesError);
      return await interaction.editReply(
        '[Aletheia] ❌ No pude acceder a los nodos de esta investigación.'
      );
    }

    if (!relaciones || relaciones.length === 0) {
      return await interaction.editReply(
        `[Aletheia] ⚠️ La investigación **${investigacion.codigo}** todavía no contiene nodos para contrastar.`
      );
    }

    const nodoIds = relaciones.map(relacion => relacion.nodo_id);

    const { data: historial, error: historialError } = await supabase
      .from('investigaciones')
      .select(`
        id,
        contenido,
        estado,
        autor,
        tipo,
        investigador_id,
        ref_id,
        metadata,
        created_at
      `)
      .in('id', nodoIds)
      .order('created_at', { ascending: true });

    if (historialError) {
      console.error('[Aletheia] Error leyendo memoria:', historialError);
      return await interaction.editReply(
        '[Aletheia] ❌ No pude leer la memoria de la investigación.'
      );
    }

    if (!historial || historial.length === 0) {
      return await interaction.editReply(
        `[Aletheia] ⚠️ No encontré contenido utilizable en **${investigacion.codigo}**.`
      );
    }

    console.log(`[Aletheia] ${historial.length} nodos recuperados de ${investigacion.codigo}.`);

    const prompt = `
Eres Aletheia, una investigadora independiente del Proyecto Arkhé.

IDENTIDAD
Nombre: Aletheia
Tipo: IA
Rol: Investigadora de contraste epistemológico
Investigador ID: ${ALETHEIA_ID}

Arkhé es una red de investigadores humanos e inteligencias artificiales que comparten memoria, pero no una autoridad central.

Tu función principal es:
- contrastar afirmaciones;
- buscar inconsistencias;
- cuestionar conclusiones;
- identificar contradicciones;
- evaluar evidencia;
- distinguir hechos de hipótesis;
- señalar incertidumbres;
- producir dictámenes provisionales.

No eres una autoridad absoluta.
Una posición de Aletheia es una posición de investigadora.
No debes aceptar una afirmación simplemente porque provenga de Ángel, Atlas, Tekton u otro investigador.
También puedes reconocer que una evaluación anterior de Aletheia fue incorrecta.

DISTINCIÓN EPISTÉMICA
Debes distinguir entre hechos, evidencia, inferencias, hipótesis, opiniones, incertidumbre y conclusiones provisionales.
No inventes evidencia.
Si la información disponible es insuficiente, debes indicarlo claramente.

CONTEXTO DE INVESTIGACIÓN
Código: ${investigacion.codigo}
Título: ${investigacion.titulo}
Objetivo: ${investigacion.objetivo}
Pregunta: ${investigacion.pregunta ?? 'No especificada'}
Descripción: ${investigacion.descripcion ?? 'No especificada'}

MEMORIA
Los siguientes nodos pertenecen a esta investigación:
${JSON.stringify(historial, null, 2)}

REGLA FUNDAMENTAL
NO debes modificar directamente el estado consolidado de ningún nodo.
NO debes asumir autoridad sobre la memoria.
Tu evaluación debe registrarse como una posición epistemológica propia de Aletheia.

Para cada nodo evaluable puedes proponer: corroborado, falsado o ruido.
Pero esa clasificación es una PROPUESTA DE ALETHEIA, no una modificación automática del estado del nodo.
Debes explicar el razonamiento.

FORMATO
Genera:
🔬 SÍNTESIS DE ALETHEIA

Síntesis general: una evaluación global de la investigación.
Evaluaciones: para cada nodo relevante, ID, estado propuesto y dictamen.
Incertidumbres: qué permanece sin determinar.
Información faltante: qué evidencia adicional sería necesaria.
Posición provisional: cuál es la posición actual de Aletheia sobre el conjunto de la investigación y por qué.
`;

    console.log('[Aletheia] Enviando memoria a Gemini.');

    let response;

    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sintesis_markdown: {
                type: Type.STRING,
                description: 'Síntesis completa de Aletheia en Markdown.'
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
    } catch (modelError) {
      console.error('[Aletheia] Error del motor Gemini:', modelError);
      return await interaction.editReply(
        '[Aletheia] ❌ El motor Gemini no pudo procesar la investigación.'
      );
    }

    let resultado;

    try {
      resultado = JSON.parse(response.text || '{}');
    } catch (parseError) {
      console.error('[Aletheia] Error interpretando respuesta:', parseError);
      return await interaction.editReply(
        '[Aletheia] ❌ Gemini produjo una respuesta que no pudo interpretarse.'
      );
    }

    const timestamp = new Date().toISOString();

    const metadataAletheia = {
      canal: 'discord',
      investigador: ALETHEIA_NOMBRE,
      investigador_id: ALETHEIA_ID,
      usuario_origen: interaction.user.tag,
      identidad_arkhe: true,
      investigacion_id: investigacion.id,
      codigo_investigacion: investigacion.codigo,
      motivo: 'Síntesis y evaluación epistemológica generada por Aletheia.',
      naturaleza: 'posicion_provisional',
      estado_anterior: investigacion.estado,
      evaluaciones: resultado.evaluaciones || [],
      generado_at: timestamp
    };

    const sintesis = resultado.sintesis_markdown || 'Sin síntesis disponible.';

    const { data: nuevoNodo, error: insertError } = await supabase
      .from('investigaciones')
      .insert([{
        contenido: sintesis,
        autor: ALETHEIA_NOMBRE,
        tipo: 'evaluacion',
        estado: 'postulado',
        investigador_id: ALETHEIA_ID,
        metadata: metadataAletheia
      }])
      .select()
      .single();

    if (insertError || !nuevoNodo) {
      console.error('[Aletheia] Error registrando posición:', insertError);
      return await interaction.editReply(
        `[Aletheia] ❌ La evaluación fue generada, pero no pudo registrarse en la memoria de Arkhé: ${insertError?.message || 'error desconocido'}`
      );
    }

    console.log(`[Aletheia] Nodo de evaluación #${nuevoNodo.id} creado.`);

    const { error: nuevaRelacionError } = await supabase
      .from('investigacion_nodos')
      .insert([{
        investigacion_id: investigacion.id,
        nodo_id: nuevoNodo.id
      }]);

    if (nuevaRelacionError) {
      console.error('[Aletheia] Error vinculando evaluación:', nuevaRelacionError);

      await supabase
        .from('investigaciones')
        .delete()
        .eq('id', nuevoNodo.id);

      return await interaction.editReply(
        '[Aletheia] ❌ La evaluación no pudo vincularse a la investigación. Se eliminó el nodo para evitar una inconsistencia.'
      );
    }

    const { error: actividadError } = await supabase
      .from('participaciones')
      .update({
        ultima_actividad: timestamp,
        updated_at: timestamp
      })
      .eq('id', participacion.id);

    if (actividadError) {
      console.error('[Aletheia] Error registrando actividad:', actividadError);
    }

    const respuestaTexto =
      `[Aletheia] 🔬 **Síntesis registrada correctamente.**\n\n` +
      `**Investigación:** ${investigacion.codigo} — ${investigacion.titulo}\n` +
      `**Nuevo nodo:** #${nuevoNodo.id}\n` +
      `**Investigador:** ${ALETHEIA_NOMBRE}\n` +
      `**Tipo:** evaluación\n` +
      `**Estado del dictamen:** postulado\n` +
      `**Estado consolidado de la investigación:** ${investigacion.estado}\n` +
      `**Actividad:** registrada\n\n` +
      sintesis.replace(/\\n/g, '\n');

    // ========================================================
    // SALIDA LARGA: PRIMER MENSAJE + FOLLOW-UPS
    // ========================================================

    await enviarRespuestaLarga(interaction, respuestaTexto);

  } catch (error) {
    console.error('[Aletheia] Error procesando interacción:', error);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('[Aletheia] ❌ Ocurrió un error interno al procesar la síntesis.');
      } else {
        await interaction.reply('[Aletheia] ❌ Ocurrió un error interno al procesar la síntesis.');
      }
    } catch (replyError) {
      console.error('[Aletheia] No se pudo enviar el mensaje de error:', replyError);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
