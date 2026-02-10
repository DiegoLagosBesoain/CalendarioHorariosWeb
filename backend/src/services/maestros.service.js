import { pool } from "../db/pool.js";

/**
 * Obtiene o crea un profesor por RUT
 * @param {string} rut - RUT del profesor
 * @param {string} nombre - Nombre del profesor
 * @returns {Promise<Object>} - Objeto del profesor {id, rut, nombre}
 */
async function obtenerOCrearProfesor(rut, nombre) {
  if (!rut || rut.trim() === '') {
    return null;
  }

  try {
    // Intentar obtener el profesor existente
    const resultado = await pool.query(
      `SELECT id, rut, nombre FROM profesores WHERE rut = $1`,
      [rut.trim()]
    );

    if (resultado.rows.length > 0) {
      return resultado.rows[0];
    }

    // Si no existe, crear nuevo
    if (!nombre || nombre.trim() === '') {
      console.warn(`Profesor con RUT ${rut} no tiene nombre, saltando...`);
      return null;
    }

    const nuevoProfesor = await pool.query(
      `INSERT INTO profesores (rut, nombre, disponibilidades)
       VALUES ($1, $2, $3)
       RETURNING id, rut, nombre`,
      [rut.trim(), nombre.trim(), JSON.stringify({})]
    );

    console.log(`Creado nuevo profesor: ${rut} - ${nombre}`);
    return nuevoProfesor.rows[0];
  } catch (error) {
    console.error(`Error obtener/crear profesor ${rut}:`, error);
    return null;
  }
}

/**
 * Extrae especialidades del curso como diccionario
 * @param {Object} curso - Datos del curso
 * @returns {Object} - Diccionario con especialidades y sus semestres
 */
function extraerEspecialidades(curso) {
  const especialidadesMap = {
    "Plan Común": curso["Plan Común"],
    ICA: curso["ICA"],
    ICQ: curso["ICQ"],
    ICI: curso["ICI"],
    IOC: curso["IOC"],
    ICE: curso["ICE"],
    ICC: curso["ICC"],
  };

  // Filtrar solo las que tengan valor
  const especialidades = {};
  for (const [clave, valor] of Object.entries(especialidadesMap)) {
    if (valor && valor !== "" && valor !== 0) {
      especialidades[clave] = valor;
    }
  }

  return especialidades;
}

/**
 * Procesa la respuesta de maestro.listar y crea entradas en horas_programables
 * @param {Array} maestrosData - Array de diccionarios con datos de cursos
 * @returns {Promise<Array>} - Array de horarios programables creados
 */
export async function procesarMaestrosYCrearHorarios(maestrosData) {
  const horariosCreados = [];

  try {
    // Filtrar solo los cursos con CURSO MANDANTE = "SI"
    const cursosMandantes = maestrosData.filter(
      (curso) => curso["CURSO MANDANTE"] === "SI"
    );

    console.log(
      `Procesando ${cursosMandantes.length} cursos mandantes de ${maestrosData.length} totales`
    );

    for (const curso of cursosMandantes) {
      // Extraer información base del curso
      const codigo = curso["CODIGO"];
      const seccion = curso["SECCIONES"];
      const titulo = curso["TITULO"];

      if (!codigo) {
        console.warn("Curso sin código, saltando...");
        continue;
      }

      // Extraer especialidades
      const especialidades = extraerEspecialidades(curso);

      // Obtener o crear profesores
      const profesor1RUT = curso["RUT PROFESOR 1"];
      const profesor1Nombre = curso["NOMBRE PROFESOR 1 \n(PROFESOR PRINCIPAL SESIÓN 01)"];
      const profesor2RUT = curso["RUT PROFESOR 2"];
      const profesor2Nombre = curso["NOMBRE PROFESOR 2\n(2DO PROFESOR - SESIÓN 02)"];
      const profesorLabRUT = curso["RUT PROFESOR LABT"];
      const profesorLabNombre = curso["PROFESOR LABT "];

      const prof1 = await obtenerOCrearProfesor(profesor1RUT, profesor1Nombre);
      const prof2 = await obtenerOCrearProfesor(profesor2RUT, profesor2Nombre);
      const profLab = await obtenerOCrearProfesor(profesorLabRUT, profesorLabNombre);

      // Crear entrada para CLASES si existe
      if (curso["Clases A PROGRAMAR"] && curso["Clases A PROGRAMAR"] > 0) {
        const horarioClase = await crearHorarioProgramable(
          codigo,
          seccion,
          "CLASE",
          curso["Clases A PROGRAMAR"],
          especialidades,
          prof1?.id || null,
          prof2?.id || null,
          titulo
        );
        horariosCreados.push(horarioClase);
      }

      // Crear entrada para AYUDANTÍAS si existe
      if (
        curso["Ayudantías PROGRAMAR"] &&
        curso["Ayudantías PROGRAMAR"] > 0
      ) {
        const horarioAyudantia = await crearHorarioProgramable(
          codigo,
          seccion,
          "AYUDANTIA",
          curso["Ayudantías PROGRAMAR"],
          especialidades,
          prof1?.id || null,
          prof2?.id || null,
          titulo
        );
        horariosCreados.push(horarioAyudantia);
      }

      // Crear entrada para LABORATORIOS/TALLERES si existe
      // Para LAB: solo usa prof1 (profesor lab), prof2 es null
      if (
        curso["Laboratorios o Talleres PROGRAMAR"] &&
        curso["Laboratorios o Talleres PROGRAMAR"] > 0
      ) {
        const horarioLab = await crearHorarioProgramable(
          codigo,
          seccion,
          "LAB/TALLER",
          curso["Laboratorios o Talleres PROGRAMAR"],
          especialidades,
          profLab?.id || null,
          null,
          titulo
        );
        horariosCreados.push(horarioLab);
      }
    }

    return horariosCreados;
  } catch (error) {
    console.error("Error procesando maestros:", error);
    throw new Error(`Error procesando datos de maestros: ${error.message}`);
  }
}

/**
 * Crea un registro en horas_programables
 * @param {string} codigo - Código del curso
 * @param {number} seccion - Número de sección
 * @param {string} tipoHora - CLASE, AYUDANTIA, LAB/TALLER
 * @param {number} cantidadHoras - Cantidad de horas/sesiones
 * @param {Object} especialidades - Diccionario de especialidades
 * @param {number} profesor1Id - ID del profesor 1
 * @param {number} profesor2Id - ID del profesor 2
 * @returns {Promise<Object>} - Registro creado
 */
async function crearHorarioProgramable(
  codigo,
  seccion,
  tipoHora,
  cantidadHoras,
  especialidades,
  profesor1Id,
  profesor2Id,
  titulo
) {
  try {
    // Verificar si ya existe (por combinación de codigo, seccion, tipo_hora)
    const existente = await pool.query(
      `SELECT id FROM horas_programables 
       WHERE codigo = $1 AND seccion = $2 AND tipo_hora = $3`,
      [codigo, seccion, tipoHora]
    );

    if (existente.rows.length > 0) {
      console.log(
        `Horario ${codigo}-${seccion}-${tipoHora} ya existe, actualizando...`
      );
      // Actualizar si ya existe
      const result = await pool.query(
        `UPDATE horas_programables 
         SET cantidad_horas = $1, profesor_1_id = $2, profesor_2_id = $3, 
             especialidades_semestres = $4, titulo = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          cantidadHoras,
          profesor1Id,
          profesor2Id,
          JSON.stringify(especialidades),
          titulo,
          existente.rows[0].id,
        ]
      );
      return result.rows[0];
    }

    // Crear nuevo registro usando ON CONFLICT para manejar duplicados
    const result = await pool.query(
      `INSERT INTO horas_programables 
       (codigo, seccion, tipo_hora, cantidad_horas, profesor_1_id, profesor_2_id, especialidades_semestres, titulo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (codigo, seccion, tipo_hora) 
       DO UPDATE SET 
         cantidad_horas = $4,
         profesor_1_id = $5,
         profesor_2_id = $6,
         especialidades_semestres = $7,
         titulo = $8,
         updated_at = NOW()
       RETURNING *`,
      [
        codigo,
        seccion,
        tipoHora,
        cantidadHoras,
        profesor1Id,
        profesor2Id,
        JSON.stringify(especialidades),
        titulo,
      ]
    );

    console.log(
      `Creado/Actualizado: ${codigo}-${seccion}-${tipoHora} (${cantidadHoras} horas)`
    );
    return result.rows[0];
  } catch (error) {
    console.error(
      `Error creando horario ${codigo}-${seccion}-${tipoHora}:`,
      error
    );
    throw error;
  }
}

/**
 * Obtiene todos los horas_programables
 * @returns {Promise<Array>}
 */
export async function obtenerHorariosProgramables() {
  try {
    const result = await pool.query(
      `SELECT * FROM horas_programables ORDER BY codigo, seccion, tipo_hora`
    );
    return result.rows;
  } catch (error) {
    console.error("Error obteniendo horas programables:", error);
    throw error;
  }
}

/**
 * Obtiene horas_programables por dashboard (filtrado)
 * @param {number} dashboardId - ID del dashboard
 * @returns {Promise<Array>}
 */
export async function obtenerHorariosPorDashboard(dashboardId) {
  try {
    const result = await pool.query(
      `SELECT hp.* FROM horas_programables hp
       JOIN horas_registradas hr ON hp.id = hr.hora_programable_id
       WHERE hr.dashboard_id = $1
       GROUP BY hp.id
       ORDER BY hp.codigo, hp.seccion, hp.tipo_hora`,
      [dashboardId]
    );
    return result.rows;
  } catch (error) {
    console.error("Error obteniendo horas por dashboard:", error);
    throw error;
  }
}

/**
 * Limpia todos los horas_programables (útil para reload)
 * @returns {Promise}
 */
export async function limpiarHorariosProgramables() {
  try {
    const result = await pool.query(`DELETE FROM horas_programables`);
    console.log(`Eliminados ${result.rowCount} registros de horas_programables`);
    return result.rowCount;
  } catch (error) {
    console.error("Error limpiando horas programables:", error);
    throw error;
  }
}
