// Variable global o de configuración para tu canal de archivo maestro (reemplaza con tu ID real de Discord)
const ARCHIVO_MAESTRO_ID = 'AQUÍ_PEGAS_EL_ID_DE_TU_CANAL_DE_DISCORD';

// Función auxiliar mejorada para enviar al canal actual y replicar en el Archivo Maestro
async function enviarConPersistencia(message, titulo, contenidoTexto) {
    const mensajeCompleto = `${titulo}\n> *Autor: ${message.author.username} | Canal: <#${message.channel.id}>*\n\n${contenidoTexto}`;
    
    // 1. Envía la respuesta al canal donde se invocó el comando (usando tu función de partición limpia)
    await sendSafeReply(message, mensajeCompleto);

    // 2. Si configuraste el ID del canal de archivo, manda una copia automática allá
    if (ARCHIVO_MAESTRO_ID && ARCHIVO_MAESTRO_ID !== 'AQUÍ_PEGAS_EL_ID_DE_TU_CANAL_DE_DISCORD') {
        try {
            const canalArchivo = await message.client.channels.fetch(ARCHIVO_MAESTRO_ID);
            if (canalArchivo && canalArchivo.isTextBased()) {
                const mensajeArchivo = `📦 **[REGISTRO AUTOMÁTICO DE SISTEMA]**\n${mensajeCompleto}`;
                // Divide también el mensaje si es muy largo para el archivo maestro
                if (mensajeArchivo.length > 2000) {
                    const lines = mensajeArchivo.split('\n');
                    let chunk = '';
                    for (const line of lines) {
                        if ((chunk + line + '\n').length > 1900) {
                            await canalArchivo.send(chunk);
                            chunk = line + '\n';
                        } else {
                            chunk += line + '\n';
                        }
                    }
                    if (chunk.trim().length > 0) await canalArchivo.send(chunk);
                } else {
                    await canalArchivo.send(mensajeArchivo);
                }
            }
        } catch (error) {
            console.error('Error al replicar en el Archivo Maestro:', error);
        }
    }
}
