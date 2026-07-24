import { BLOQUES_MAP } from '../constants/horarios.js';
import { normalizarHora } from '../utils/horario-utils.js';

function verificarBloqueEnDisponibilidad(disponibilidad, dia, horaInicio) {
  if (!disponibilidad) {
    return { disponible: false, razon: 'sin_disponibilidad' };
  }

  let disp = disponibilidad;
  if (typeof disp === 'string') {
    try { disp = JSON.parse(disp); } catch {
      return { disponible: false, razon: 'sin_disponibilidad' };
    }
  }

  if (typeof disp !== 'object' || disp === null || Object.keys(disp).length === 0) {
    return { disponible: false, razon: 'sin_disponibilidad' };
  }

  const bloquesDisponibles = disp[dia];
  if (!bloquesDisponibles || !Array.isArray(bloquesDisponibles) || bloquesDisponibles.length === 0) {
    return { disponible: false, razon: 'sin_datos_dia' };
  }

  const horaInicioNorm = normalizarHora(horaInicio);
  const bloqueCompleto = BLOQUES_MAP[horaInicioNorm];
  if (!bloqueCompleto) {
    return { disponible: true }; // Bloque desconocido, asumir disponible
  }

  const bloquesNorm = bloquesDisponibles.map(b => {
    const partes = b.split('-');
    if (partes.length === 2) {
      return `${normalizarHora(partes[0])}-${normalizarHora(partes[1])}`;
    }
    return b;
  });

  if (bloquesNorm.includes(bloqueCompleto)) {
    return { disponible: true };
  }

  return { disponible: false, razon: 'bloque_no_encontrado' };
}

export { verificarBloqueEnDisponibilidad };
