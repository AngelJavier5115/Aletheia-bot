// ============================================================
// ARKHÉ — COMANDO DE RONDA PARA ALETHEIA
// ============================================================
// Adaptador Discord. Recibe un nodo de memoria, crea/reutiliza
// una ronda abierta dirigida a Aletheia y registra una perspectiva.
// El número de ronda es global dentro de la investigación.
// ============================================================

import {
  generarPerspectivaAletheia,
  formatearPerspectivaDiscord
} from './arkhe-round.js';

export const ALETHEIA_ROUND_COMMAND_NAME = 'aletheia-ronda';

const ARKHE_CODIGO = 'AR-001';
const ANGEL_NOMBRE = 'Ángel';

export function crearComandoAletheiaRonda(SlashCommandBuilder) {
  return new SlashCommandBuilder()
    .setName(ALETHEIA_ROUND_COMMAND_NAME)
    .setDescription('Aletheia: aporta una perspectiva independiente sobre un nodo Arkhé')
    .addIntegerOption(option => option
      .setName('id')
      .setDescription('ID del nodo de memoria a consultar')
      .setRequired(true));
}

async function prepararRondaParaNodo({ supabase, aletheiaId, nodoId }) {
  const { data: nodo, error: nodoError } = await supabase
    .from('investigaciones')
    .select('id, ref_id, autor, contenido, tipo, metadata, estado, created_at')
    .eq('id', nodoId)
    .single();

  if (nodoError) throw nodoError;
  if (!nodo) throw new Error(`Nodo ${nodoId} no encontrado.`);

  const { data: investigacion, error: investigacionError } = await supabase
    .from('investigaciones_proyecto')
    .select('id, codigo, titulo, objetivo, pregunta, estado')
    .eq('codigo', ARKHE_CODIGO)
    .single();

  if (investigacionError) throw investigacionError;
  if (!investigacion) throw new Error(`Investigación ${ARKHE_CODIGO} no encontrada.`);

  const { data: angel, error: angelError } = await supabase
    .from('investigadores')
    .select('id, nombre, tipo')
    .eq('nombre', ANGEL_NOMBRE)
    .eq('tipo', 'humano')
    .single();

  if (angelError) throw angelError;
  if (!angel) throw new Error('Investigador humano Ángel no encontrado.');

  // Reutilizar una ronda abierta de Aletheia para el mismo nodo evita duplicados.
  const { data: rondasAbiertas, error: rondasError } = await supabase
    .from('rondas_investigacion')
    .select('id, investigacion_id, numero, tipo, estado, pregunta, iniciada_por, destinatario_id, ronda_padre_id, fase_id, contexto, conclusion, decision, created_at, closed_at, updated_at')
    .eq('investigacion_id', investigacion.id)
    .eq('estado', 'abierta')
    .eq('destinatario_id', aletheiaId)
    .order('numero', { ascending: false });

  if (rondasError) throw rondasError;

  const rondaExistente = (rondasAbiertas ?? []).find(
    ronda => Number(ronda?.contexto?.nodo_id) === Number(nodoId)
  );

  if (rondaExistente) return rondaExistente;

  // El número de ronda pertenece a la investigación, no al investigador.
  // Por eso buscamos el máximo entre TODAS las rondas existentes.
  const { data: todasLasRondas, error: todasLasRondasError } = await supabase
    .from('rondas_investigacion')
    .select('numero')
    .eq('investigacion_id', investigacion.id)
    .order('numero', { ascending: false })
    .limit(1);

  if (todasLasRondasError) throw todasLasRondasError;

  const siguienteNumero = ((todasLasRondas ?? [])[0]?.numero ?? 0) + 1;

  const contexto = {
    nodo_id: nodo.id,
    nodo: {
      id: nodo.id,
      ref_id: nodo.ref_id,
      autor: nodo.autor,
      contenido: nodo.contenido,
      tipo: nodo.tipo,
      metadata: nodo.metadata ?? {},
      estado: nodo.estado,
      created_at: nodo.created_at
    },
    convocatoria: 'aletheia-ronda-v1'
  };

  const { data: ronda, error: rondaError } = await supabase
    .from('rondas_investigacion')
    .insert({
      investigacion_id: investigacion.id,
      numero: siguienteNumero,
      tipo: 'consulta',
      estado: 'abierta',
      pregunta: `Aletheia, aporta una perspectiva independiente sobre el nodo #${nodo.id} dentro de ${ARKHE_CODIGO}.`,
      iniciada_por: angel.id,
      destinatario_id: aletheiaId,
      contexto
    })
    .select('id, investigacion_id, numero, tipo, estado, pregunta, iniciada_por, destinatario_id, ronda_padre_id, fase_id, contexto, conclusion, decision, created_at, closed_at, updated_at')
    .single();

  if (rondaError) throw rondaError;
  return ronda;
}

export async function ejecutarAletheiaRonda({
  interaction,
  supabase,
  ai,
  aletheiaId,
  responderLargo
}) {
  const nodoId = interaction.options.getInteger('id', true);

  try {
    const ronda = await prepararRondaParaNodo({
      supabase,
      aletheiaId,
      nodoId
    });

    const resultado = await generarPerspectivaAletheia({
      supabase,
      ai,
      aletheiaId,
      rondaId: ronda.id
    });

    const mensaje = formatearPerspectivaDiscord(resultado);
    return await responderLargo(interaction, mensaje);
  } catch (error) {
    console.error('[Aletheia] Error en ronda:', error);

    return await interaction.editReply(
      `[Aletheia] ❌ No pude registrar la perspectiva sobre el nodo #${nodoId}.\n\n` +
      `Motivo: ${error?.message || 'error desconocido'}`
    );
  }
}
