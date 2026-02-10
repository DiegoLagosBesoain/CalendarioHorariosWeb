import { pool } from '../db/pool.js';

/**
 * Crear una nueva hora registrada
 */
async function crear(horaProgramableId, dashboardId, diaNumero, bloqueIndex, horaInicio, horaFin) {
  const dias = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const diaSemana = dias[diaNumero] || 'Lunes';

  const result = await pool.query(
    `INSERT INTO horas_registradas (hora_programable_id, dashboard_id, dia_semana, hora_inicio, hora_fin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [horaProgramableId, dashboardId, diaSemana, horaInicio, horaFin]
  );

  return result.rows[0];
}

/**
 * Obtener todas las horas registradas de un dashboard
 */
async function obtenerPorDashboard(dashboardId) {
  const result = await pool.query(
    `SELECT hr.*, hp.codigo, hp.seccion, hp.titulo, hp.tipo_hora
     FROM horas_registradas hr
     JOIN horas_programables hp ON hr.hora_programable_id = hp.id
     WHERE hr.dashboard_id = $1
     ORDER BY hr.created_at DESC`,
    [dashboardId]
  );

  return result.rows;
}

/**
 * Obtener una hora registrada específica
 */
async function obtenerPorId(id) {
  const result = await pool.query(
    `SELECT hr.*, hp.codigo, hp.seccion, hp.titulo, hp.tipo_hora
     FROM horas_registradas hr
     JOIN horas_programables hp ON hr.hora_programable_id = hp.id
     WHERE hr.id = $1`,
    [id]
  );

  return result.rows[0];
}

/**
 * Actualizar una hora registrada (cuando se mueve de celda)
 */
async function actualizar(id, diaNumero, horaInicio, horaFin) {
  const dias = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const diaSemana = dias[diaNumero] || 'Lunes';

  const result = await pool.query(
    `UPDATE horas_registradas
     SET dia_semana = $1, hora_inicio = $2, hora_fin = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [diaSemana, horaInicio, horaFin, id]
  );

  return result.rows[0];
}

/**
 * Eliminar una hora registrada
 */
async function eliminar(id) {
  const result = await pool.query(
    `DELETE FROM horas_registradas WHERE id = $1 RETURNING *`,
    [id]
  );

  return result.rows[0];
}

/**
 * Eliminar todas las horas registradas de un dashboard
 */
async function limpiarDashboard(dashboardId) {
  const result = await pool.query(
    `DELETE FROM horas_registradas WHERE dashboard_id = $1 RETURNING *`,
    [dashboardId]
  );

  return result.rows.length;
}

export { crear, obtenerPorDashboard, obtenerPorId, actualizar, eliminar, limpiarDashboard };

