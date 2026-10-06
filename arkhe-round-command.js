// ============================================================
// ARKHÉ — CUERPO DISCORD DE ALETHEIA
// ============================================================
// Discord transporta la orden humana. Arkhé Core gobierna la ronda.
// Aletheia conserva su propia identidad y razonamiento.
// ============================================================

import {
  generarPerspectivaAletheia,
  formatearPerspectivaDiscord
} from './arkhe-round.js';
import { coreRequest } from './arkhe-core-client.js';

export const ALETHEIA_ROUND_COMMAND_NAME = 'aletheia-ronda';

const ARKHE_CODIGO = 'AR-001';
const ANGEL_ID = '2a003935-f248-442c-96fc-dcee29c4d41a';
const ALETHEIA_ID = '122483a9-5012-46ce-a328-5bdb08b4de01';

export function crearComandoAletheiaRonda(SlashCommandBuilder) {
  return new SlashCommandBuilder()
    .setName(ALETHEIA_ROUND_COMMAND_NAME)
    .setDescription('Aletheia: aporta una perspectiva independiente sobre un nodo Arkhé')
    .addIntegerOption(option => option
      .setName('id')
      .setDescription('ID del nodo de memoria a consultar')
      .setRequired(true));
}

export async function ejecutarAletheiaRonda({
  interaction,
  ai,
  responderLargo
}) {
  const nodoId = interaction.options.getInteger('id', true);

  try {
    const inicio = await coreRequest({
      action: 'iniciar_ronda',
      actor_id: ANGEL_ID,
      investigacion_codigo: ARKHE_CODIGO,
      tipo: 'consulta',
      pregunta: `Solicitar una perspectiva independiente de Aletheia sobre el nodo #${nodoId}.`,
      participantes: [ALETHEIA_ID],
      nodo_id: nodoId,
      contexto: {
        origen: 'discord',
        cuerpo_investigador: 'aletheia'
      }
    });

    const convocatorias = await coreRequest({
      action: 'convocar_investigadores',
      actor_id: ANGEL_ID,
      ronda_id: inicio.ronda.id,
      investigadores: [ALETHEIA_ID],
      tipo_convocatoria: 'perspectiva',
      instruccion_humana: `Ángel solicita la perspectiva independiente de Aletheia sobre el nodo #${nodoId}.`
    });

    const convocatoria = convocatorias.convocatorias?.[0];
    if (!convocatoria) throw new Error('Arkhé Core no creó la convocatoria de Aletheia.');

    const resultado = await generarPerspectivaAletheia({
      ai,
      aletheiaId: ALETHEIA_ID,
      convocatoriaId: convocatoria.id
    });

    return await responderLargo(
      interaction,
      formatearPerspectivaDiscord(resultado)
    );
  } catch (error) {
    console.error('[Aletheia] Error en ronda:', error);

    return await interaction.editReply(
      `[Aletheia] ❌ Arkhé Core no pudo completar la convocatoria del nodo #${nodoId}.\n\n` +
      `Motivo: ${error?.message || 'error desconocido'}`
    );
  }
}
