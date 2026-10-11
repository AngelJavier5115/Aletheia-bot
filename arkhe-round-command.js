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

export const ALETHEIA_ROUND_COMMAND_NAME = 'aletheia-convocatoria';

const ALETHEIA_ID = '122483a9-5012-46ce-a328-5bdb08b4de01';

export function crearComandoAletheiaRonda(SlashCommandBuilder) {
  return new SlashCommandBuilder()
    .setName(ALETHEIA_ROUND_COMMAND_NAME)
    .setDescription('Aletheia: procesa una convocatoria existente autorizada por Arkhé Core')
    .addStringOption(option => option
      .setName('convocatoria_id')
      .setDescription('UUID de una convocatoria pendiente asignada a Aletheia')
      .setRequired(true));
}

export async function ejecutarAletheiaRonda({
  interaction,
  ai,
  responderLargo
}) {
  const convocatoriaId = interaction.options.getString('convocatoria_id', true);

  try {
    const resultado = await generarPerspectivaAletheia({
      ai,
      aletheiaId: '122483a9-5012-46ce-a328-5bdb08b4de01',
      convocatoriaId
    });

    return await responderLargo(
      interaction,
      formatearPerspectivaDiscord(resultado)
    );
  } catch (error) {
    console.error('[Aletheia] Error en convocatoria:', error);
    return await interaction.editReply(
      '[Aletheia] ❌ Arkhé Core no pudo completar la convocatoria ' + convocatoriaId + '.\\n\\n' +
      'Motivo: ' + (error?.message || 'error desconocido')
    );
  }
}
