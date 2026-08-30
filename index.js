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

// ============================================================
// SERVIDOR HTTP PARA RENDER
// ============================================================

http.createServer((req, res) => {

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8'
  });

  res.end('Aletheia Bot is active!\n');

}).listen(PORT, () => {

  console.log(
    `[Aletheia] Servidor HTTP activo en puerto ${PORT}`
  );

});

// ============================================================
// SUPABASE
// ============================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ============================================================
// GEMINI
// ============================================================

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    })
  : null;

// ============================================================
// IDENTIDAD DE ALETHEIA
// ============================================================

const ALETHEIA_ID =
  'REEMPLAZAR_CON_ID_REAL_DE_ALETHEIA';

const ALETHEIA_NOMBRE =
  'Aletheia';

// ============================================================
// DISCORD
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// ============================================================
// COMANDOS
// ============================================================

const commands = [

  // ========================================================
  // ALETHEIA-EVALUAR
  // ========================================================

  new SlashCommandBuilder()

    .setName('aletheia-evaluar')

    .setDescription(
      'Aletheia contrasta un nodo y registra su posición epistemológica'
    )

    .addIntegerOption(option =>
      option
        .setName('id')
        .setDescription(
          'ID del nodo que Aletheia evaluará'
        )
        .setRequired(true)
    ),

  // ========================================================
  // ALETHEIA-SINTESIS
  // ========================================================

  new SlashCommandBuilder()

    .setName('aletheia-sintesis')

    .setDescription(
      'Aletheia genera una síntesis de la memoria reciente de Arkhé'
    )

].map(cmd => cmd.toJSON());

// ============================================================
// ERRORES
// ============================================================

process.on(
  'unhandledRejection',
  error => {

    console.error(
      '[Aletheia] Unhandled Rejection:',
      error
    );

  }
);

process.on(
  'uncaughtException',
  error => {

    console.error(
      '[Aletheia] Uncaught Exception:',
      error
    );

  }
);

// ============================================================
// READY
// ============================================================

client.once('ready', async () => {

  console.log(
    `[Aletheia] Bot en línea como: ${client.user.tag}`
  );

  console.log(
    `[Aletheia] Identidad Arkhé: ${ALETHEIA_NOMBRE} (${ALETHEIA_ID})`
  );

  try {

    const rest = new REST({
      version: '10'
    }).setToken(
      process.env.DISCORD_TOKEN
    );

    await rest.put(

      Routes.applicationCommands(
        client.user.id
      ),

      {
        body: commands
      }

    );

    console.log(
      '[Aletheia] Comandos registrados correctamente.'
    );

  } catch (error) {

    console.error(
      '[Aletheia] Error registrando comandos:',
      error
    );

  }

});

// ============================================================
// INTERACCIONES
// ============================================================

client.on(
  'interactionCreate',
  async interaction => {

    if (
      !interaction.isChatInputCommand()
    ) {

      return;

    }

    if (

      interaction.commandName !==
        'aletheia-evaluar' &&

      interaction.commandName !==
        'aletheia-sintesis'

    ) {

      return;

    }

    try {

      await interaction.deferReply();

      // ======================================================
      // ALETHEIA-EVALUAR
      // ======================================================

      if (
        interaction.commandName ===
        'aletheia-evaluar'
      ) {

        const id =
          interaction.options.getInteger(
            'id'
          );

        // ====================================================
        // PASO 1 — VERIFICAR MOTOR
        // ====================================================

        if (!ai) {

          return await interaction.editReply(

            '[Aletheia] ⚠️ El motor de Aletheia no está configurado.'

          );

        }

        // ====================================================
        // PASO 2 — OBTENER NODO
        // ====================================================

        const {
          data: nodo,
          error: nodoError
        } = await supabase

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

          .eq(
            'id',
            id
          )

          .single();

        if (
          nodoError ||
          !nodo
        ) {

          return await interaction.editReply(

            `[Aletheia] ❌ Nodo #${id} no encontrado.`

          );

        }

        console.log(
          `[Aletheia] Nodo #${id} encontrado.`
        );

        // ====================================================
        // PASO 3 — DESCUBRIR INVESTIGACIÓN
        // ====================================================

        const {
          data: relacion,
          error: relacionError
        } = await supabase

          .from('investigacion_nodos')

          .select(`
            investigacion_id,
            nodo_id
          `)

          .eq(
            'nodo_id',
            id
          )

          .limit(1)

          .maybeSingle();

        if (
          relacionError ||
          !relacion
        ) {

          console.error(
            '[Aletheia] No se pudo determinar la investigación:',
            relacionError
          );

          return await interaction.editReply(

            `[Aletheia] ❌ El nodo #${id} no está vinculado a ninguna investigación de Arkhé.`

          );

        }

        // ====================================================
        // PASO 4 — OBTENER INVESTIGACIÓN
        // ====================================================

        const {
          data: investigacion,
          error: investigacionError
        } = await supabase

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

          .eq(
            'id',
            relacion.investigacion_id
          )

          .single();

        if (
          investigacionError ||
          !investigacion
        ) {

          console.error(
            '[Aletheia] Investigación no encontrada:',
            investigacionError
          );

          return await interaction.editReply(

            `[Aletheia] ❌ No pude reconstruir el contexto de investigación del nodo #${id}.`

          );

        }

        console.log(

          `[Aletheia] Contexto encontrado: ` +
          `${investigacion.codigo} — ` +
          `${investigacion.titulo}`

        );

        // ====================================================
        // PASO 5 — VERIFICAR PARTICIPACIÓN
        // ====================================================

        const {
          data: participacion,
          error: participacionError
        } = await supabase

          .from('participaciones')

          .select(`
            id,
            investigador_id,
            investigacion_id,
            rol,
            estado
          `)

          .eq(
            'investigador_id',
            ALETHEIA_ID
          )

          .eq(
            'investigacion_id',
            investigacion.id
          )

          .eq(
            'estado',
            'activo'
          )

          .maybeSingle();

        if (
          participacionError
        ) {

          console.error(
            '[Aletheia] Error verificando participación:',
            participacionError
          );

          return await interaction.editReply(

            '[Aletheia] ❌ No se pudo verificar la participación de Aletheia en esta investigación.'

          );

        }

        if (
          !participacion
        ) {

          return await interaction.editReply(

            `[Aletheia] ⚠️ Aletheia no participa actualmente en **${investigacion.codigo} — ${investigacion.titulo}**.`

          );

        }

        console.log(
          `[Aletheia] Participación confirmada: ${participacion.id}`
        );

        // ====================================================
        // PASO 6 — IDENTIDAD EPISTÉMICA
        // ====================================================

        const systemPrompt = `

Eres Aletheia, uno de los investigadores independientes
del Proyecto Arkhé.

IDENTIDAD

Nombre: Aletheia
Tipo: IA
Rol: investigador de contraste y falsación
Investigador ID: ${ALETHEIA_ID}

Arkhé es una red de investigadores humanos e
inteligencias artificiales que comparten memoria,
pero no una autoridad central.

Tu función principal es:

- contrastar afirmaciones;
- buscar inconsistencias;
- cuestionar hipótesis;
- analizar evidencia;
- identificar posibles falsaciones;
- detectar ruido;
- evaluar la solidez de argumentos;
- señalar incertidumbres.

No eres una autoridad absoluta.

Una posición de Aletheia es una posición de investigadora
y no constituye automáticamente una verdad.

INDEPENDENCIA

No debes aceptar una afirmación simplemente porque
provenga de Ángel, Atlas, Tekton u otro investigador.

Puedes estar de acuerdo o en desacuerdo con cualquier
investigador.

También puedes reconocer que una evaluación anterior
de Aletheia fue incorrecta.

DISTINCIÓN EPISTÉMICA

Debes distinguir entre:

- hechos;
- evidencia disponible;
- inferencias;
- hipótesis;
- opiniones;
- incertidumbre;
- conclusiones provisionales.

No inventes evidencia.

Si la información disponible es insuficiente,
debes decirlo claramente.

CONTEXTO DE INVESTIGACIÓN

Código:
${investigacion.codigo}

Título:
${investigacion.titulo}

Objetivo:
${investigacion.objetivo}

Pregunta:
${investigacion.pregunta ?? 'No especificada'}

Descripción:
${investigacion.descripcion ?? 'No especificada'}

REGLA DE ESTA OPERACIÓN

Debes CONTRASTAR el nodo.

NO debes modificar el nodo original.

NO debes cambiar directamente su estado.

Tu posición debe registrarse como una nueva producción
de Aletheia dentro de Arkhé.

La posición propuesta debe representar exclusivamente
el análisis de Aletheia.

FORMATO

Devuelve exactamente una estructura clara con:

🔬 EVALUACIÓN DE ALETHEIA

Interpretación:
¿Qué afirma o plantea el nodo?

Evidencia:
¿Qué evidencia disponible respalda o debilita la afirmación?

Argumentos a favor:
¿Qué elementos apoyan la afirmación?

Argumentos en contra:
¿Qué elementos la cuestionan?

Problemas encontrados:
¿Qué inconsistencias, debilidades o problemas existen?

Incertidumbre:
¿Qué permanece sin determinar?

Información faltante:
¿Qué información adicional sería necesaria?

Posición de Aletheia:
corroborado / falsado / ruido / indeterminado

Dictamen:
¿Cuál es el razonamiento que sostiene la posición?

`;

        // ====================================================
        // PASO 7 — LLAMADA A GEMINI
        // ====================================================

        console.log(
          `[Aletheia] Enviando nodo #${id} al motor de contraste.`
        );

        let response;

        try {

          response =
            await ai.models.generateContent({

              model:
                'gemini-3.6-flash',

              contents: `

CONTEXTO DE ARKHÉ

Investigación:
${investigacion.codigo} — ${investigacion.titulo}

Nodo a contrastar:

ID:
${nodo.id}

Autor externo:
${nodo.autor ?? 'No especificado'}

Investigador Arkhé:
${nodo.investigador_id ?? 'No especificado'}

Tipo:
${nodo.tipo ?? 'No especificado'}

Estado actual:
${nodo.estado ?? 'No especificado'}

Referencia:
${nodo.ref_id ?? 'Ninguna'}

Contenido:

${nodo.contenido}

`,

              config: {

                responseMimeType:
                  'application/json',

                responseSchema: {

                  type: Type.OBJECT,

                  properties: {

                    interpretacion: {
                      type: Type.STRING
                    },

                    evidencia: {
                      type: Type.STRING
                    },

                    argumentos_a_favor: {
                      type: Type.STRING
                    },

                    argumentos_en_contra: {
                      type: Type.STRING
                    },

                    problemas_encontrados: {
                      type: Type.STRING
                    },

                    incertidumbre: {
                      type: Type.STRING
                    },

                    informacion_faltante: {
                      type: Type.STRING
                    },

                    posicion: {
                      type: Type.STRING,
                      enum: [
                        'corroborado',
                        'falsado',
                        'ruido',
                        'indeterminado'
                      ]
                    },

                    dictamen: {
                      type: Type.STRING
                    }

                  },

                  required: [
                    'interpretacion',
                    'evidencia',
                    'argumentos_a_favor',
                    'argumentos_en_contra',
                    'problemas_encontrados',
                    'incertidumbre',
                    'informacion_faltante',
                    'posicion',
                    'dictamen'
                  ]

                }

              }

            });

        } catch (modelError) {

          console.error(
            '[Aletheia] Error del motor:',
            modelError
          );

          if (
            modelError?.status === 429
          ) {

            return await interaction.editReply(

              '[Aletheia] ⚠️ El motor de Aletheia rechazó la solicitud por límite o falta de créditos. La arquitectura de Arkhé respondió correctamente, pero el proveedor del motor debe ser revisado.'

            );

          }

          return await interaction.editReply(

            '[Aletheia] ❌ El motor de Aletheia no pudo procesar la evaluación.'

          );

        }

        // ====================================================
        // PASO 8 — PARSEAR RESULTADO
        // ====================================================

        let resultado;

        try {

          resultado =
            JSON.parse(
              response.text || '{}'
            );

        } catch (parseError) {

          console.error(
            '[Aletheia] Error interpretando respuesta de Gemini:',
            parseError
          );

          return await interaction.editReply(

            '[Aletheia] ⚠️ El motor produjo una respuesta que no pudo interpretarse correctamente.'

          );

        }

        if (
          !resultado ||
          !resultado.posicion ||
          !resultado.dictamen
        ) {

          return await interaction.editReply(

            '[Aletheia] ⚠️ El motor no produjo una evaluación utilizable.'

          );

        }

        // ====================================================
        // PASO 9 — CONSTRUIR PRODUCCIÓN DE ALETHEIA
        // ====================================================

        const analisis = `

🔬 EVALUACIÓN DE ALETHEIA

Interpretación:
${resultado.interpretacion}

Evidencia:
${resultado.evidencia}

Argumentos a favor:
${resultado.argumentos_a_favor}

Argumentos en contra:
${resultado.argumentos_en_contra}

Problemas encontrados:
${resultado.problemas_encontrados}

Incertidumbre:
${resultado.incertidumbre}

Información faltante:
${resultado.informacion_faltante}

Posición de Aletheia:
${resultado.posicion}

Dictamen:
${resultado.dictamen}

`;

        // ====================================================
        // PASO 10 — CREAR NODO DE ALETHEIA
        // ====================================================

        const {
          data: nuevoNodo,
          error: insertError
        } = await supabase

          .from('investigaciones')

          .insert([{

            ref_id:
              nodo.id,

            autor:
              ALETHEIA_NOMBRE,

            contenido:
              analisis,

            tipo:
              'evaluacion',

            estado:
              'postulado',

            investigador_id:
              ALETHEIA_ID,

            metadata: {

              canal:
                'discord',

              investigador:
                ALETHEIA_NOMBRE,

              investigador_id:
                ALETHEIA_ID,

              usuario_origen:
                interaction.user.tag,

              identidad_arkhe:
                true,

              investigacion_id:
                investigacion.id,

              codigo_investigacion:
                investigacion.codigo,

              nodo_origen:
                nodo.id,

              posicion_aletheia:
                resultado.posicion,

              naturaleza:
                'posicion_provisional',

              motivo:
                'Evaluación generada por Aletheia.'

            }

          }])

          .select()

          .single();

        if (
          insertError ||
          !nuevoNodo
        ) {

          console.error(
            '[Aletheia] Error creando nodo de evaluación:',
            insertError
          );

          return await interaction.editReply(

            `[Aletheia] ❌ La evaluación fue generada, pero no pudo registrarse en la memoria de Arkhé: ${
              insertError?.message ||
              'error desconocido'
            }`

          );

        }

        console.log(
          `[Aletheia] Nodo de evaluación #${nuevoNodo.id} creado.`
        );

        // ====================================================
        // PASO 11 — VINCULAR A INVESTIGACIÓN
        // ====================================================

        const {
          error: nuevaRelacionError
        } = await supabase

          .from('investigacion_nodos')

          .insert([{

            investigacion_id:
              investigacion.id,

            nodo_id:
              nuevoNodo.id

          }]);

        if (
          nuevaRelacionError
        ) {

          console.error(
            '[Aletheia] Error vinculando evaluación:',
            nuevaRelacionError
          );

          // --------------------------------------------------
          // COMPENSACIÓN
          // --------------------------------------------------

          await supabase

            .from('investigaciones')

            .delete()

            .eq(
              'id',
              nuevoNodo.id
            );

          return await interaction.editReply(

            '[Aletheia] ❌ La evaluación fue generada pero no pudo vincularse a la investigación. Se eliminó el nodo para evitar una inconsistencia.'

          );

        }

        console.log(

          `[Aletheia] Nodo #${nuevoNodo.id} ` +
          `vinculado a ${investigacion.codigo}.`

        );

        // ====================================================
        // PASO 12 — ACTUALIZAR ACTIVIDAD
        // ====================================================

        const ahora =
          new Date().toISOString();

        const {
          error: actividadError
        } = await supabase

          .from('participaciones')

          .update({

            ultima_actividad:
              ahora,

            updated_at:
              ahora

          })

          .eq(
            'id',
            participacion.id
          );

        if (
          actividadError
        ) {

          console.error(

            '[Aletheia] La evaluación fue registrada, ' +
            'pero no se pudo actualizar ultima_actividad:',
            actividadError

          );

        }

        // ====================================================
        // PASO 13 — RESPUESTA FINAL
        // ====================================================

        return await interaction.editReply(

          `[Aletheia] 🔬 **Evaluación registrada correctamente.**\n\n` +

          `**Nodo evaluado:** #${nodo.id}\n` +

          `**Nuevo nodo:** #${nuevoNodo.id}\n` +

          `**Investigación:** ${investigacion.codigo} — ${investigacion.titulo}\n` +

          `**Investigador:** ${ALETHEIA_NOMBRE}\n` +

          `**Tipo:** evaluación\n` +

          `**Posición:** ${resultado.posicion}\n` +

          `**Estado del nuevo nodo:** postulado\n` +

          `**Referencia:** #${nodo.id}\n` +

          `**Actividad:** registrada\n\n` +

          `${analisis}`

        );

      }

      // ======================================================
      // ALETHEIA-SINTESIS
      // ======================================================

      if (
        interaction.commandName ===
        'aletheia-sintesis'
      ) {

        // ====================================================
        // VERIFICAR MOTOR
        // ====================================================

        if (!ai) {

          return await interaction.editReply(

            '[Aletheia] ⚠️ El motor de Aletheia no está configurado.'

          );

        }

        // ====================================================
        // OBTENER MEMORIA RECIENTE
        // ====================================================

        const {
          data: historial,
          error
        } = await supabase

          .from('investigaciones')

          .select('*')

          .order(
            'created_at',
            {
              ascending: false
            }
          )

          .limit(10);

        if (
          error
        ) {

          return await interaction.editReply(

            `[Aletheia] ❌ Error leyendo la memoria de Arkhé: ${error.message}`

          );

        }

        if (
          !historial ||
          historial.length === 0
        ) {

          return await interaction.editReply(

            '[Aletheia] No hay investigaciones registradas aún para sintetizar.'

          );

        }

        // ====================================================
        // PROMPT DE SÍNTESIS
        // ====================================================

        const prompt = `

Eres Aletheia, investigadora independiente
del Proyecto Arkhé.

Genera una síntesis crítica de los siguientes
registros recientes de la memoria compartida.

No debes modificar ningún registro.

Debes distinguir entre:

- hechos;
- hipótesis;
- posiciones;
- evidencia;
- incertidumbre;
- contradicciones.

No trates ninguna posición individual como verdad absoluta.

Registros:

${JSON.stringify(
  historial,
  null,
  2
)}

`;

        // ====================================================
        // LLAMADA A GEMINI
        // ====================================================

        let response;

        try {

          response =
            await ai.models.generateContent({

              model:
                'gemini-3.6-flash',

              contents:
                prompt,

              config: {

                responseMimeType:
                  'text/plain'

              }

            });

        } catch (modelError) {

          console.error(
            '[Aletheia] Error del motor durante síntesis:',
            modelError
          );

          return await interaction.editReply(

            '[Aletheia] ❌ El motor no pudo generar la síntesis.'

          );

        }

        const sintesis =
          response?.text?.trim();

        if (
          !sintesis
        ) {

          return await interaction.editReply(

            '[Aletheia] ⚠️ No se produjo una síntesis utilizable.'

          );

        }

        return await interaction.editReply(

          sintesis.slice(
            0,
            2000
          )

        );

      }

    } catch (error) {

      console.error(
        '[Aletheia] Error procesando interacción:',
        error
      );

      try {

        await interaction.editReply(

          '[Aletheia] ❌ Ocurrió un error interno al procesar la operación.'

        );

      } catch (replyError) {

        console.error(

          '[Aletheia] No se pudo enviar el mensaje de error:',
          replyError

        );

      }

    }

  }
);

// ============================================================
// LOGIN
// ============================================================

client.login(
  process.env.DISCORD_TOKEN
);
