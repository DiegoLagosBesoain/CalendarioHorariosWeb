import { verificarBloqueEnDisponibilidad } from '../utils/disponibilidad-utils.js';

export function extraerSemestres(especialidades_semestres) {
  if (!especialidades_semestres) return [];

  let esp = especialidades_semestres;
  if (typeof esp === 'string') {
    try {
      esp = JSON.parse(esp);
    } catch {
      return [];
    }
  }

  let semestres = [];

  if (Array.isArray(esp)) {
    semestres = esp.map(e => {
      const sem = e.semestre || e;
      if (typeof sem === 'string') {
        const num = parseInt(sem.replace(/[^0-9]/g, ''), 10);
        return isNaN(num) ? null : num;
      }
      return sem;
    }).filter(s => s !== null);
  } else if (typeof esp === 'object') {
    semestres = Object.values(esp).flat().map(sem => {
      if (typeof sem === 'string') {
        const num = parseInt(sem.replace(/[^0-9]/g, ''), 10);
        return isNaN(num) ? null : num;
      }
      return sem;
    }).filter(s => s !== null);
  }

  return semestres;
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
