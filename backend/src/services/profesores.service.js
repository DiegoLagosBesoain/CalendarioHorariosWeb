import pool from "../db/pool.js";

export async function obtenerOCrearProfesor(rut, nombre, contexto = '') {
  const rutStr = rut != null ? String(rut).trim() : '';
  if (!rutStr) {
    console.log(`[PROF] Saltando profesor${contexto ? ` [${contexto}]` : ''}: rut es vacío/null (raw value: ${JSON.stringify(rut)})`);
    return null;
  }

  try {
    const resultado = await pool.query(
      `SELECT id, rut, nombre FROM profesores WHERE rut = $1`,
      [rutStr]
    );

    if (resultado.rows.length > 0) {
      console.log(`[PROF] Encontrado existente: rut=${rutStr} -> id=${resultado.rows[0].id}${contexto ? ` (${contexto})` : ''}`);
      return resultado.rows[0];
    }

    let nombreStr = nombre != null ? String(nombre).trim() : '';
    if (!nombreStr) {
      console.warn(`[PROF] Profesor con RUT "${rutStr}" no tiene nombre (raw: ${JSON.stringify(nombre)}), usando RUT como nombre provisional`);
      nombreStr = `Profesor ${rutStr}`;
    }

    const nuevoProfesor = await pool.query(
      `INSERT INTO profesores (rut, nombre, disponibilidades)
       VALUES ($1, $2, $3)
       RETURNING id, rut, nombre`,
      [rutStr, nombreStr, JSON.stringify({})]
    );

    console.log(`[PROF] Creado nuevo profesor: rut=${rutStr} nombre=${nombreStr} -> id=${nuevoProfesor.rows[0].id}`);
    return nuevoProfesor.rows[0];
  } catch (error) {
    console.error(`[PROF] ERROR creando/buscando profesor rut="${rutStr}" nombre="${nombre}":`, error.message);
    return null;
  }
}
