// ============================================================
// ARKHÉ — CUERPO DISCORD DE ALETHEIA
// ============================================================
// La investigación sólo comienza mediante un despacho firmado de
// Arkhé Core después de autorización humana WebAuthn. Una UUID no
// concede permiso para ejecutar una convocatoria.
// ============================================================

export const ALETHEIA_ROUND_COMMAND_NAME = 'aletheia-convocatoria';

export function crearComandoAletheiaRonda(SlashCommandBuilder) {
  return new SlashCommandBuilder()
    .setName(ALETHEIA_ROUND_COMMAND_NAME)
    .setDescription('Ejecución directa bloqueada: las convocatorias deben llegar mediante despacho firmado de Arkhé Core.')
    .addStringOption(option => option
      .setName('convocatoria_id')
      .setDescription('UUID informativo de la convocatoria (no la ejecuta)')
      .setRequired(true));
}

export async function ejecutarAletheiaRonda({ interaction }) {
  return await interaction.editReply(
    '⛔ **Aletheia — ejecución directa deshabilitada.**\\n\\n' +
    'Una convocatoria sólo puede procesarse después de recibir un despacho firmado, de un solo uso, emitido por Arkhé Core con autorización humana reciente. ' +
    'Este comando no ejecutó el motor ni contactó al Core.'
  );
}
