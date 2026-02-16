/**
 * GUÍA DE EXTENSIÓN: Sistema Modular de Validaciones
 * 
 * Este archivo explica cómo agregar nuevas validaciones al sistema.
 * Todas las validaciones deben retornar: 
 * { isValid: boolean, warning?: string, error?: string, ... }
 */

// ============================================================================
// EJEMPLO 1: Agregar una validación simple (Validar horas máximas por profesor)
// ============================================================================

/**
 * Validador: Máximo de horas por profesor
 * Evita que un profesor tenga más de X horas programadas en el mismo horario
 */
async function validarMaximoHorasPorProfesor(horaProgramableId, dashboardId, horario, maxHoras = 12) {
  try {
    const progResult = await pool.query(
      `SELECT profesor_1_id, profesor_2_id FROM horas_programables WHERE id = $1`,
      [horaProgramableId]
    );
    
    if (progResult.rows.length === 0) return { isValid: true };

    const { profesor_1_id, profesor_2_id } = progResult.rows[0];

    // Contar horas del profesor 1
    if (profesor_1_id) {
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM horas_registradas hr
         JOIN horas_programables hp ON hr.hora_programable_id = hp.id
         WHERE hp.profesor_1_id = $1
         AND hr.dashboard_id = $2
         AND hr.horario = $3`,
        [profesor_1_id, dashboardId, horario]
      );

      const count = parseInt(countResult.rows[0].count);
      if (count >= maxHoras) {
        return {
          isValid: false,
          warning: `⚠️ El profesor 1 ya tiene ${count} horas en "${horario}"`
        };
      }
    }

    return { isValid: true };
  } catch (err) {
    console.error('Error validando máximo horas profesor:', err);
    return { isValid: true };
  }
}

// ============================================================================
// EJEMPLO 2: Agregar una validación compleja (No overbook de salas)
// ============================================================================

/**
 * Validador: Verificar que no haya overbooking de salas
 * Evita programar dos clases en la misma sala en el mismo bloque horario
 */
async function validarDisponibilidadSala(horaProgramableId, dashboardId, dia, bloqueIndex, horario) {
  try {
    // Obtener la sala de la hora programable
    const progResult = await pool.query(
      `SELECT sala_id FROM horas_programables WHERE id = $1`,
      [horaProgramableId]
    );

    if (!progResult.rows[0]?.sala_id) return { isValid: true }; // Sin sala, no hay conflicto

    const sala_id = progResult.rows[0].sala_id;

    // Buscar conflictos en la misma sala, día y bloque
    const conflictResult = await pool.query(
      `SELECT COUNT(*) as count FROM horas_registradas hr
       JOIN horas_programables hp ON hr.hora_programable_id = hp.id
       WHERE hp.sala_id = $1
       AND hr.dashboard_id = $2
       AND hr.horario = $3
       AND hr.dia_semana = $4
       AND hr.hora_inicio IN (SELECT inicio FROM (VALUES ($5)) as bloques(inicio))`,
      [sala_id, dashboardId, horario, dia, bloqueIndex]
    );

    if (parseInt(conflictResult.rows[0].count) > 0) {
      return {
        isValid: false,
        error: `La sala ya está ocupada en ${dia} a esa hora en "${horario}"`
      };
    }

    return { isValid: true };
  } catch (err) {
    console.error('Error validando sala:', err);
    return { isValid: true };
  }
}

// ============================================================================
// CÓMO INTEGRAR UNA NUEVA VALIDACIÓN
// ============================================================================
/**
 * 
 * 1. Crear la función validadora en hora-registrada.validators.js:
 *    - Nombre: validarXXXX
 *    - Retorna objeto con { isValid, warning?, error? }
 * 
 * 2. Exportar la función:
 *    export { validarXXXX }
 * 
 * 3. Agregar a la función ejecutarValidaciones():
 *    const resultadoXXXX = await validarXXXX(...);
 *    if (!resultadoXXXX.isValid) { ... }
 * 
 * 4. El endpoint automáticamente mostrará warnings/errors
 * 
 * EJEMPLO DE CÓMO SERÍA EN ejecutarValidaciones():
 * 
 * async function ejecutarValidaciones(horaProgramableId, dashboardId, horario) {
 *   const warnings = [];
 *   const errors = [];
 * 
 *   // Validaciones existentes
 *   const resultadoToques = await validarToquesDeSemestre(horaProgramableId, dashboardId, horario);
 *   if (!resultadoToques.isValid && resultadoToques.warning) {
 *     warnings.push(resultadoToques.warning);
 *   }
 * 
 *   // NUEVA VALIDACIÓN
 *   const resultadoProfesor = await validarMaximoHorasPorProfesor(horaProgramableId, dashboardId, horario);
 *   if (!resultadoProfesor.isValid && resultadoProfesor.warning) {
 *     warnings.push(resultadoProfesor.warning);
 *   }
 * 
 *   return {
 *     hasWarnings: warnings.length > 0,
 *     warnings,
 *     hasErrors: errors.length > 0,
 *     errors,
 *     isValid: errors.length === 0
 *   };
 * }
 */

// ============================================================================
// VALIDACIONES SUGERIDAS PARA EL FUTURO
// ============================================================================
/**
 * 
 * 1. ✅ Toques de semestre (YA IMPLEMENTADO)
 *    Detecta cuando dos ramos del mismo semestre se solapan
 * 
 * 2. 📋 Máximo de horas por profesor
 *    Evita que un profesor tenga demasiadas horas
 * 
 * 3. 📍 Disponibilidad de salas
 *    Verifica que una sala no esté en dos clases al mismo tiempo
 * 
 * 4. 👨‍🎓 Compatibilidad de horarios de estudiante
 *    Asegura que estudiantes no tengan clases simultáneas
 * 
 * 5. 🧑‍🏫 Disponibilidad de profesores
 *    Respeta las disponibilidades del profesor
 * 
 * 6. 📚 Secuencia de requisitos
 *    Valida que cursos prerequisitos se dicten antes
 * 
 */

export {};
