import { verificarBloqueEnDisponibilidad } from '../utils/disponibilidad-utils.js';
import { normalizarSemestreToken } from '../utils/horario-utils.js';

function normalizarNombreEspecialidad(valor) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/**
 * Separa un token de semestre en número + mención (sufijo).
 * "10" -> { numero: 10, sufijo: '' }
 * "10A" -> { numero: 10, sufijo: 'A' }
 * "10ANALYTICS" -> { numero: 10, sufijo: 'ANALYTICS' }
 */
function parseSemestreToken(valor) {
  const token = normalizarSemestreToken(valor);
  if (token == null) return null;

  const match = token.match(/^(\d+)([A-Z]*)$/);
  if (!match) return null;

  return {
    numero: parseInt(match[1], 10),
    sufijo: match[2] || '',
  };
}

/**
 * Extrae pares (especialidad, semestre) desde especialidades_semestres.
 * El semestre se guarda como token que conserva la mención: "10A", "10", etc.
 * Soporta { ICI: '10a', 'PLAN COMUN': [2, 3] } y [{ nombre: 'ICI', semestre: '10a' }].
 */
export function extraerParesEspecialidadSemestre(especialidades_semestres) {
  if (!especialidades_semestres) return [];

  let esp = especialidades_semestres;
  if (typeof esp === 'string') {
    try { esp = JSON.parse(esp); } catch { return []; }
  }

  const pares = [];

  if (Array.isArray(esp)) {
    for (const item of esp) {
      if (item && typeof item === 'object' && item.nombre != null) {
        const especialidad = normalizarNombreEspecialidad(item.nombre);
        const semestre = normalizarSemestreToken(item.semestre);
        if (especialidad && semestre != null) {
          pares.push({ especialidad, semestre });
        }
      } else {
        const semestre = normalizarSemestreToken(item);
        if (semestre != null) {
          pares.push({ especialidad: '', semestre });
        }
      }
    }
    return pares;
  }

  if (typeof esp === 'object') {
    for (const [nombreRaw, valor] of Object.entries(esp)) {
      const especialidad = normalizarNombreEspecialidad(nombreRaw);
      if (!especialidad) continue;

      const valores = Array.isArray(valor) ? valor : [valor];
      for (const v of valores) {
        const semestre = normalizarSemestreToken(v);
        if (semestre != null) {
          pares.push({ especialidad, semestre });
        }
      }
    }
  }

  return pares;
}

/**
 * Compara los semestres de dos cursos considerando carrera y mención:
 * - mismo número de semestre y misma carrera
 * - y (algún lado sin mención o la misma mención)
 * El semestre sin mención ("10") es transversal a las menciones de su carrera.
 */
export function conflictosDeSemestre(esp1, esp2) {
  const pares1 = extraerParesEspecialidadSemestre(esp1);
  const pares2 = extraerParesEspecialidadSemestre(esp2);

  const paresComunes = [];
  const vistos = new Set();

  for (const a of pares1) {
    const semA = parseSemestreToken(a.semestre);
    if (!semA) continue;

    for (const b of pares2) {
      if (a.especialidad !== b.especialidad) continue;

      const semB = parseSemestreToken(b.semestre);
      if (!semB) continue;
      if (semA.numero !== semB.numero) continue;
      if (semA.sufijo && semB.sufijo && semA.sufijo !== semB.sufijo) continue;

      const token = semA.sufijo ? a.semestre : b.semestre;
      const clave = `${a.especialidad}|${token}`;
      if (vistos.has(clave)) continue;

      vistos.add(clave);
      paresComunes.push({ especialidad: a.especialidad, semestre: token });
    }
  }

  return {
    hayConflicto: paresComunes.length > 0,
    paresComunes,
  };
}

export function tieneConflictoDisponibilidad(hora) {
  try {
    const { disponibilidad, dia_semana, hora_inicio, profesor_1_id, profesor_2_id, tipo_hora } = hora;

    if (tipo_hora === 'AYUDANTIA' || tipo_hora === 'LAB/TALLER') {
      return false;
    }

    if (!profesor_1_id && !profesor_2_id) {
      return false;
    }

    const check = verificarBloqueEnDisponibilidad(disponibilidad, dia_semana, hora_inicio);

    if (check.razon === 'sin_disponibilidad') {
      return false;
    }

    return !check.disponible;

  } catch (error) {
    console.error('[ConflictDetector] Error verificando disponibilidad:', error);
    return false;
  }
}

export function tieneConflictoHorarioProtegido(hora) {
  try {
    const { horario, dia_semana, hora_inicio } = hora;

    if (!['plan_comun', '5to_6to', '7mo_8vo'].includes(horario)) {
      return false;
    }

    const horariosProtegidos = {
      'Martes': ['17:30', '18:30'],
      'Miércoles': ['17:30', '18:30'],
      'Viernes': ['10:30', '11:30', '12:30']
    };

    const horasProhibidas = horariosProtegidos[dia_semana] || [];
    return horasProhibidas.includes(hora_inicio);

  } catch (error) {
    console.error('[ConflictDetector] Error verificando horario protegido:', error);
    return false;
  }
}
