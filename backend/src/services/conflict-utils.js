import { verificarBloqueEnDisponibilidad } from '../utils/disponibilidad-utils.js';

function normalizarNombreEspecialidad(valor) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function normalizarSemestre(valor) {
  if (valor == null) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? Math.floor(valor) : null;
  const num = parseInt(String(valor).replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(num) ? null : num;
}

/**
 * Extrae pares (especialidad, semestre) desde especialidades_semestres.
 * Soporta { ICI: 5, 'PLAN COMUN': [2, 3] } y [{ nombre: 'ICI', semestre: 5 }].
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
        const semestre = normalizarSemestre(item.semestre);
        if (especialidad && semestre != null) {
          pares.push({ especialidad, semestre });
        }
      } else {
        const semestre = normalizarSemestre(item);
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
        const semestre = normalizarSemestre(v);
        if (semestre != null) {
          pares.push({ especialidad, semestre });
        }
      }
    }
  }

  return pares;
}

/**
 * Compara los semestres de dos cursos considerando la carrera:
 * hay choque solo si comparten una pareja (carrera, semestre).
 */
export function conflictosDeSemestre(esp1, esp2) {
  const pares1 = extraerParesEspecialidadSemestre(esp1);
  const pares2 = extraerParesEspecialidadSemestre(esp2);

  const clavePar = (p) => `${p.especialidad}|${p.semestre}`;
  const pares2Set = new Set(pares2.map(clavePar));

  const paresComunes = [];
  const vistos = new Set();
  for (const par of pares1) {
    const clave = clavePar(par);
    if (pares2Set.has(clave) && !vistos.has(clave)) {
      vistos.add(clave);
      paresComunes.push(par);
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
