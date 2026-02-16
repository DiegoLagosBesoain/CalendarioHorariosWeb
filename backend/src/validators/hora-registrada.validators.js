import { pool } from '../db/pool.js';

/**
 * Sistema modular de validaciones para horas registradas
 * Cada validador retorna: { isValid: boolean, warning?: string, error?: string }
 */

/**
 * Validador 1: Detectar toques de semestre
 * Verifica si dos horas del MISMO BLOQUE HORARIO comparten semestre
 * No compara si tienen el mismo código (mismo curso, diferentes secciones)
 */
async function validarToquesDeSemestre(horaProgramableId, dashboardId, horario, dia, horaInicio) {
  try {
    // Obtener la hora programable actual con sus especialidades y código
    const progResult = await pool.query(
      `SELECT codigo, seccion, especialidades_semestres FROM horas_programables WHERE id = $1`,
      [horaProgramableId]
    );
    
    if (progResult.rows.length === 0) {
      return { isValid: true };
    }

    const horaProgramableActual = progResult.rows[0];
    let especialidadesActuales = horaProgramableActual.especialidades_semestres;
    
    if (typeof especialidadesActuales === 'string') {
      try {
        especialidadesActuales = JSON.parse(especialidadesActuales);
      } catch (e) {
        especialidadesActuales = {};
      }
    }

    // Extraer los semestres de la hora actual
    let semestresActuales = [];
    if (Array.isArray(especialidadesActuales)) {
      semestresActuales = especialidadesActuales.map(e => e.semestre || e).filter(s => s);
    } else if (typeof especialidadesActuales === 'object') {
      semestresActuales = Object.values(especialidadesActuales).filter(s => s);
    }

    if (semestresActuales.length === 0) {
      return { isValid: true }; // Sin semestres asignados, no hay conflicto
    }

    // Obtener todas las horas registradas en el MISMO BLOQUE HORARIO
    // (mismo día + misma hora_inicio + mismo horario)
    const horasResult = await pool.query(
      `SELECT hr.id, hp.codigo, hp.seccion, hp.especialidades_semestres
       FROM horas_registradas hr
       JOIN horas_programables hp ON hr.hora_programable_id = hp.id
       WHERE hr.dashboard_id = $1 
       AND hr.horario = $2
       AND hr.dia_semana = $3
       AND hr.hora_inicio = $4`,
      [dashboardId, horario, dia, horaInicio]
    );

    // Verificar cada hora existente en el mismo bloque
    for (const row of horasResult.rows) {
      // SKIP: Si es del mismo código (mismo curso, diferente sección)
      if (row.codigo === horaProgramableActual.codigo) {
        continue;
      }

      let especialidadesOtras = row.especialidades_semestres;
      if (typeof especialidadesOtras === 'string') {
        try {
          especialidadesOtras = JSON.parse(especialidadesOtras);
        } catch (e) {
          especialidadesOtras = {};
        }
      }

      // Extraer semestres de la otra hora
      let semestresOtras = [];
      if (Array.isArray(especialidadesOtras)) {
        semestresOtras = especialidadesOtras.map(e => e.semestre || e).filter(s => s);
      } else if (typeof especialidadesOtras === 'object') {
        semestresOtras = Object.values(especialidadesOtras).filter(s => s);
      }

      // Buscar semestres comunes
      const semestresComunes = semestresActuales.filter(s => 
        semestresOtras.includes(s)
      );

      // Si comparten semestre en el mismo bloque horario
      if (semestresComunes.length > 0) {
        // Obtener títulos de los programables para el mensaje
        const prog1Result = await pool.query(
          `SELECT titulo FROM horas_programables WHERE id = $1`,
          [horaProgramableId]
        );
        const prog1Title = prog1Result.rows[0]?.titulo || horaProgramableActual.codigo;

        const prog2Result = await pool.query(
          `SELECT titulo FROM horas_programables WHERE id = (SELECT hora_programable_id FROM horas_registradas WHERE id = $1)`,
          [row.id]
        );
        const prog2Title = prog2Result.rows[0]?.titulo || row.codigo;

        return {
          isValid: false,
          warning: `⚠️ Conflicto de horario: ${prog1Title} Sección ${horaProgramableActual.seccion} está tocando con ${prog2Title} Sección ${row.seccion} en el semestre ${semestresComunes.join(', ')}.`,
          conflictingHoraRegId: row.id,
          conflictingCourses: [
            { codigo: horaProgramableActual.codigo, seccion: horaProgramableActual.seccion, horaProgId: horaProgramableId },
            { codigo: row.codigo, seccion: row.seccion, horaRegId: row.id }
          ],
          conflictingSemesters: semestresComunes
        };
      }
    }

    return { isValid: true };
  } catch (err) {
    console.error('Error en validarToquesDeSemestre:', err);
    return { isValid: true }; // No bloquear, solo avisar
  }
}

/**
 * Validador 2: Detectar horarios protegidos
 * Verifica si el horario se está programando en franjas horarias protegidas
 * Solo aplica para 'plan_comun' y '5to_6to'
 * Horarios protegidos:
 * - Martes: 17:30-18:20, 18:30-19:20
 * - Miércoles: 17:30-18:20, 18:30-19:20
 * - Viernes: 10:30-11:20, 11:30-12:20, 12:30-13:20
 */
function validarHorarioProtegido(dia, horaInicio, tipoHorario) {
  try {
    // Solo aplicar validación para plan_comun y 5to_6to
    const tiposAplicables = ['plan_comun', '5to_6to'];
    if (!tiposAplicables.includes(tipoHorario)) {
      return { isValid: true };
    }

    // Convertir nombre de día a número (Martes=2, Miércoles=3, Viernes=5)
    const dias = {
      'Martes': 2,
      'Miércoles': 3,
      'Viernes': 5
    };

    const diaNumeroPorNombre = dias[dia];
    if (!diaNumeroPorNombre) {
      return { isValid: true }; // Solo validar los días especificados
    }

    // Horarios protegidos por día
    const horariosProtegidos = {
      2: ['17:30', '18:30'], // Martes
      3: ['17:30', '18:30'], // Miércoles
      5: ['10:30', '11:30', '12:30'] // Viernes
    };

    const horasProhibidas = horariosProtegidos[diaNumeroPorNombre] || [];

    if (horasProhibidas.includes(horaInicio)) {
      const nombreTipoHorario = tipoHorario === 'plan_comun' ? 'Plan Común' : '5to y 6to';
      return {
        isValid: true, // No bloquea, solo advierte
        warning: `🔒 Horario Protegido: Esta programación se encuentra en una franja protegida de ${nombreTipoHorario}. ${dia} a las ${horaInicio}.`
      };
    }

    return { isValid: true };
  } catch (err) {
    console.error('Error en validarHorarioProtegido:', err);
    return { isValid: true }; // No bloquear en caso de error
  }
}

/**
 * Ejecutar todas las validaciones disponibles
 * Retorna { hasWarnings: boolean, warnings: string[], hasErrors: boolean, errors: string[], conflictIds: number[] }
 */
async function ejecutarValidaciones(horaProgramableId, dashboardId, horario, dia, horaInicio) {
  const warnings = [];
  const errors = [];
  const conflictIds = [];

  // Ejecutar validadores
  const resultadoToques = await validarToquesDeSemestre(horaProgramableId, dashboardId, horario, dia, horaInicio);
  
  if (!resultadoToques.isValid && resultadoToques.warning) {
    warnings.push(resultadoToques.warning);
    if (resultadoToques.conflictingHoraRegId) {
      conflictIds.push(resultadoToques.conflictingHoraRegId);
    }
  }
  if (resultadoToques.error) {
    errors.push(resultadoToques.error);
  }

  // Validador 2: Horarios protegidos
  const resultadoHorarioProtegido = validarHorarioProtegido(dia, horaInicio, horario);
  
  if (resultadoHorarioProtegido.warning) {
    warnings.push(resultadoHorarioProtegido.warning);
  }
  if (resultadoHorarioProtegido.error) {
    errors.push(resultadoHorarioProtegido.error);
  }

  return {
    hasWarnings: warnings.length > 0,
    warnings,
    hasErrors: errors.length > 0,
    errors,
    isValid: errors.length === 0,
    conflictIds
  };
}

export {
  validarToquesDeSemestre,
  validarHorarioProtegido,
  ejecutarValidaciones
};
