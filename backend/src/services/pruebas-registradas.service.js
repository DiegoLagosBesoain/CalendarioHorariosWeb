import { pool } from '../db/pool.js';

/**
 * Crear una nueva prueba registrada
 */
async function crear(pruebaProgramableId, dashboardId, fecha, horaInicio = null, horaFin = null) {
  const result = await pool.query(
    `INSERT INTO pruebas_registradas (prueba_programable_id, dashboard_id, fecha, hora_inicio, hora_fin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [pruebaProgramableId, dashboardId, fecha, horaInicio, horaFin]
  );

  return result.rows[0];
}

/**
 * Obtener todas las pruebas registradas de un dashboard
 */
async function obtenerPorDashboard(dashboardId) {
  const result = await pool.query(
    `SELECT pr.*, pp.codigo, pp.seccion, pp.titulo, pp.tipo_prueba, pp.especialidades_semestres, pp.bloques_horario, pp.tiene_examen, pp.cantidad_evaluaciones
     FROM pruebas_registradas pr
     JOIN pruebas_programables pp ON pr.prueba_programable_id = pp.id
     WHERE pr.dashboard_id = $1
     ORDER BY pr.fecha, pp.tipo_prueba`,
    [dashboardId]
  );

  return result.rows;
}

/**
 * Obtener una prueba registrada específica
 */
async function obtenerPorId(id) {
  const result = await pool.query(
    `SELECT pr.*, pp.codigo, pp.seccion, pp.titulo, pp.tipo_prueba, pp.especialidades_semestres, pp.bloques_horario, pp.tiene_examen, pp.cantidad_evaluaciones
     FROM pruebas_registradas pr
     JOIN pruebas_programables pp ON pr.prueba_programable_id = pp.id
     WHERE pr.id = $1`,
    [id]
  );

  return result.rows[0];
}

/**
 * Actualizar una prueba registrada (cuando se cambia de fecha)
 */
async function actualizar(id, fecha, horaInicio = null, horaFin = null) {
  const result = await pool.query(
    `UPDATE pruebas_registradas
     SET fecha = $1, hora_inicio = $2, hora_fin = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [fecha, horaInicio, horaFin, id]
  );

  return result.rows[0];
}

/**
 * Eliminar una prueba registrada
 */
async function eliminar(id) {
  const result = await pool.query(
    `DELETE FROM pruebas_registradas WHERE id = $1 RETURNING *`,
    [id]
  );

  return result.rows[0];
}

/**
 * Guardar conflictos bidireccionales entre dos pruebas
 * Si A conflictúa con B, también B conflictúa con A
 */
async function guardarConflictos(pruebaRegId, conflictIds) {
  if (!conflictIds || conflictIds.length === 0) {
    return;
  }

  // Obtener los conflictos actuales de la prueba
  const result = await pool.query(
    `SELECT conflictos FROM pruebas_registradas WHERE id = $1`,
    [pruebaRegId]
  );

  if (result.rows.length === 0) return;

  let conflictosActuales = result.rows[0].conflictos || [];
  if (typeof conflictosActuales === 'string') {
    try {
      conflictosActuales = JSON.parse(conflictosActuales);
    } catch (e) {
      conflictosActuales = [];
    }
  }

  // Agregar nuevos conflictos
  const nuevosConflictos = [...new Set([...conflictosActuales, ...conflictIds])];

  // Guardar en la prueba actual
  await pool.query(
    `UPDATE pruebas_registradas SET conflictos = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [JSON.stringify(nuevosConflictos), pruebaRegId]
  );

  // Guardar bidireccionales: agregar pruebaRegId a cada conflicto
  for (const conflictId of conflictIds) {
    const conflictResult = await pool.query(
      `SELECT conflictos FROM pruebas_registradas WHERE id = $1`,
      [conflictId]
    );

    if (conflictResult.rows.length === 0) continue;

    let conflictosDelOtro = conflictResult.rows[0].conflictos || [];
    if (typeof conflictosDelOtro === 'string') {
      try {
        conflictosDelOtro = JSON.parse(conflictosDelOtro);
      } catch (e) {
        conflictosDelOtro = [];
      }
    }

    if (!conflictosDelOtro.includes(pruebaRegId)) {
      conflictosDelOtro.push(pruebaRegId);
      await pool.query(
        `UPDATE pruebas_registradas SET conflictos = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [JSON.stringify(conflictosDelOtro), conflictId]
      );
    }
  }
}

/**
 * Limpiar conflictos cuando se elimina una prueba
 */
async function limpiarConflictos(pruebaRegId) {
  // Obtener los conflictos de esta prueba
  const result = await pool.query(
    `SELECT conflictos FROM pruebas_registradas WHERE id = $1`,
    [pruebaRegId]
  );

  if (result.rows.length === 0) return;

  let conflictos = result.rows[0].conflictos || [];
  if (typeof conflictos === 'string') {
    try {
      conflictos = JSON.parse(conflictos);
    } catch (e) {
      conflictos = [];
    }
  }

  // Remover pruebaRegId de los conflictos de todas las pruebas relacionadas
  for (const conflictId of conflictos) {
    const conflictResult = await pool.query(
      `SELECT conflictos FROM pruebas_registradas WHERE id = $1`,
      [conflictId]
    );

    if (conflictResult.rows.length === 0) continue;

    let conflictosDelOtro = conflictResult.rows[0].conflictos || [];
    if (typeof conflictosDelOtro === 'string') {
      try {
        conflictosDelOtro = JSON.parse(conflictosDelOtro);
      } catch (e) {
        conflictosDelOtro = [];
      }
    }

    conflictosDelOtro = conflictosDelOtro.filter(id => id !== pruebaRegId);
    await pool.query(
      `UPDATE pruebas_registradas SET conflictos = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [JSON.stringify(conflictosDelOtro), conflictId]
    );
  }
}

/**
 * Eliminar todas las pruebas registradas de un dashboard
 */
async function limpiarDashboard(dashboardId) {
  const result = await pool.query(
    `DELETE FROM pruebas_registradas WHERE dashboard_id = $1 RETURNING *`,
    [dashboardId]
  );

  return result.rows.length;
}

/**
 * Obtener pruebas registradas por rango de fechas
 */
async function obtenerPorRangoFechas(dashboardId, fechaInicio, fechaFin) {
  const result = await pool.query(
    `SELECT pr.*, pp.codigo, pp.seccion, pp.titulo, pp.tipo_prueba
     FROM pruebas_registradas pr
     JOIN pruebas_programables pp ON pr.prueba_programable_id = pp.id
     WHERE pr.dashboard_id = $1 AND pr.fecha >= $2 AND pr.fecha <= $3
     ORDER BY pr.fecha, pp.tipo_prueba`,
    [dashboardId, fechaInicio, fechaFin]
  );

  return result.rows;
}

export { 
  crear, 
  obtenerPorDashboard, 
  obtenerPorId, 
  actualizar, 
  eliminar, 
  guardarConflictos, 
  limpiarConflictos, 
  limpiarDashboard,
  obtenerPorRangoFechas
};
