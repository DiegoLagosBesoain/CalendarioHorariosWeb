import express from 'express';
import * as horasRegistradasService from '../services/horas-registradas.service.js';
import * as appScriptService from '../services/appscript.service.js';
import { ejecutarValidaciones } from '../validators/hora-registrada.validators.js';
import { reevaluarConflictosDashboard } from '../services/conflict-detector.service.js';
import pool from '../db/pool.js';


const router = express.Router();

// Mapeo de día a número
const diaNumeroPorNombre = {
  'Lunes': 1,
  'Martes': 2,
  'Miércoles': 3,
  'Jueves': 4,
  'Viernes': 5
};

const ORDEN_HORARIOS = ['plan_comun', '5to_6to', '7mo_8vo', '9no_10_11'];

function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function obtenerHorariosObjetivo(especialidadesSemestres, horarioSolicitado) {
  const horarios = new Set();

  if (horarioSolicitado && ORDEN_HORARIOS.includes(horarioSolicitado)) {
    horarios.add(horarioSolicitado);
  }

  let parsed = especialidadesSemestres;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (_e) {
      parsed = null;
    }
  }

  const items = [];
  if (Array.isArray(parsed)) {
    parsed.forEach((item) => {
      if (item && typeof item === 'object') {
        items.push({ nombre: item.nombre, semestre: item.semestre });
      }
    });
  } else if (parsed && typeof parsed === 'object') {
    Object.entries(parsed).forEach(([nombre, val]) => {
      if (Array.isArray(val)) {
        val.forEach((semestre) => items.push({ nombre, semestre }));
      } else {
        items.push({ nombre, semestre: val });
      }
    });
  }

  items.forEach((item) => {
    const nombre = normalizarTexto(item.nombre);
    const semestre = Number(String(item.semestre ?? '').replace(/[^0-9]/g, ''));

    if (nombre === 'PLAN COMUN' || nombre === 'PLAN_COMUN') {
      horarios.add('plan_comun');
    }

    if (!Number.isNaN(semestre)) {
      if (semestre <= 4) horarios.add('plan_comun');
      if (semestre >= 5 && semestre <= 6) horarios.add('5to_6to');
      if (semestre >= 7 && semestre <= 8) horarios.add('7mo_8vo');
      if (semestre >= 9) horarios.add('9no_10_11');
    }
  });

  const ordenados = ORDEN_HORARIOS.filter((h) => horarios.has(h));
  return ordenados.length > 0 ? ordenados : ['plan_comun'];
}

// Bloques de horarios
const BLOQUES = [
  { inicio: "8:30", fin: "9:20" },
  { inicio: "9:30", fin: "10:20" },
  { inicio: "10:30", fin: "11:20" },
  { inicio: "11:30", fin: "12:20" },
  { inicio: "12:30", fin: "13:20" },
  { inicio: "13:30", fin: "14:20" },
  { inicio: "14:30", fin: "15:20" },
  { inicio: "15:30", fin: "16:20" },
  { inicio: "16:30", fin: "17:20" },
  { inicio: "17:30", fin: "18:20" },
  { inicio: "18:30", fin: "19:20" },
  { inicio: "19:30", fin: "20:20" }
];

/**
 * GET /api/horas-registradas/diccionario/:dashboardId
 * Obtener diccionario preparado para Google Sheets
 */
router.get('/diccionario/:dashboardId', async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const diccionario = await horasRegistradasService.armarDiccionarioParaGoogleSheets(dashboardId);
    res.json({ diccionario });
  } catch (err) {
    console.error('Error al armar diccionario para Google Sheets:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/horas-registradas/debug-conflictos/:dashboardId
 * Diagnóstico: muestra datos de profesores y conflictos detectados
 */
router.get('/debug-conflictos/:dashboardId', async (req, res) => {
  try {
    const { dashboardId } = req.params;
    
    // Re-evaluar conflictos primero
    const resultado = await reevaluarConflictosDashboard(dashboardId);
    
    // Obtener estado actual
    const { pool: dbPool } = await import('../db/pool.js');
    const { rows } = await dbPool.query(
      `SELECT 
        hr.id, hr.dia_semana, hr.hora_inicio, hr.horario, hr.conflictos,
        hp.codigo, hp.seccion, hp.tipo_hora, hp.profesor_1_id, hp.profesor_2_id
       FROM horas_registradas hr
       JOIN horas_programables hp ON hr.hora_programable_id = hp.id
       WHERE hr.dashboard_id = $1
       ORDER BY hr.dia_semana, hr.hora_inicio`,
      [dashboardId]
    );
    
    res.json({ 
      resultado,
      horas: rows.map(r => ({
        id: r.id,
        dia: r.dia_semana,
        hora: String(r.hora_inicio),
        horario: r.horario,
        curso: `${r.codigo} Sec${r.seccion} ${r.tipo_hora}`,
        prof1: r.profesor_1_id,
        prof2: r.profesor_2_id,
        conflictos: r.conflictos
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/horas-registradas/:dashboardId
 * Obtener todas las horas registradas de un dashboard
 */
router.get('/:dashboardId', async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const horasRegistradas = await horasRegistradasService.obtenerPorDashboard(dashboardId);
    res.json({ horasRegistradas });
  } catch (err) {
    console.error('Error al obtener horas registradas:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/horas-registradas
 * Crear una nueva hora registrada
 * Body: { horaProgramableId, dashboardId, dia, bloqueIndex, semestreId }
 */
router.post('/', async (req, res) => {
  try {
    const { horaProgramableId, dashboardId, dia, bloqueIndex, semestreId } = req.body;

    if (!horaProgramableId || !dashboardId || !dia || bloqueIndex === undefined) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    // Obtener la hora de inicio y fin del bloque
    const bloque = BLOQUES[bloqueIndex];
    if (!bloque) {
      return res.status(400).json({ error: 'Bloque inválido' });
    }

    const progResult = await pool.query(
      `SELECT id, especialidades_semestres, codigo, seccion, tipo_hora
       FROM horas_programables
       WHERE id = $1`,
      [horaProgramableId]
    );

    if (progResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hora programable no encontrada' });
    }

    const existenteMismoBloque = await pool.query(
      `SELECT id
       FROM horas_registradas
       WHERE hora_programable_id = $1
         AND dashboard_id = $2
         AND dia_semana = $3
         AND hora_inicio = $4::time
         AND hora_fin = $5::time
       LIMIT 1`,
      [horaProgramableId, dashboardId, dia, bloque.inicio, bloque.fin]
    );

    if (existenteMismoBloque.rows.length > 0) {
      return res.status(400).json({
        error: 'Esta hora ya está registrada para el mismo curso/sección/tipo en ese bloque'
      });
    }

    // Convertir el día a número
    const diaNumero = diaNumeroPorNombre[dia] || 1;

    // Ejecutar validaciones CON EL DÍA Y HORA_INICIO ESPECÍFICOS
    const validationResult = await ejecutarValidaciones(horaProgramableId, dashboardId, semestreId, dia, bloque.inicio);
    
    // Si hay errores, rechazar la solicitud
    if (validationResult.hasErrors) {
      return res.status(400).json({ 
        error: 'Validación fallida',
        errors: validationResult.errors 
      });
    }

    const horariosObjetivo = obtenerHorariosObjetivo(
      progResult.rows[0].especialidades_semestres,
      semestreId
    );

    const horasCreadas = [];
    for (const horarioObjetivo of horariosObjetivo) {
      const horaRegistrada = await horasRegistradasService.crear(
        horaProgramableId,
        dashboardId,
        diaNumero,
        bloqueIndex,
        bloque.inicio,
        bloque.fin,
        horarioObjetivo
      );
      horasCreadas.push(horaRegistrada);
    }

    // Re-evaluar TODOS los conflictos del dashboard de forma centralizada
    await reevaluarConflictosDashboard(dashboardId);

    // Retornar la hora registrada junto con las advertencias
    res.json({ 
      horaRegistrada: horasCreadas[0],
      horasRegistradas: horasCreadas,
      warnings: validationResult.warnings 
    });
  } catch (err) {
    console.error('Error al crear hora registrada:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/horas-registradas/:id
 * Actualizar una hora registrada (cuando se mueve)
 * Body: { dia, bloqueIndex }
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { dia, bloqueIndex } = req.body;

    if (!dia || bloqueIndex === undefined) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const bloque = BLOQUES[bloqueIndex];
    if (!bloque) {
      return res.status(400).json({ error: 'Bloque inválido' });
    }

    const horaBase = await horasRegistradasService.obtenerPorId(id);
    if (!horaBase) {
      return res.status(404).json({ error: 'Hora registrada no encontrada' });
    }

    const horaInicioActual = String(horaBase.hora_inicio).substring(0, 8);
    const horaFinActual = String(horaBase.hora_fin).substring(0, 8);

    const existeEnDestino = await pool.query(
      `SELECT id
       FROM horas_registradas
       WHERE hora_programable_id = $1
         AND dashboard_id = $2
         AND dia_semana = $3
         AND hora_inicio = $4::time
         AND hora_fin = $5::time
         AND NOT (
           dia_semana = $6
           AND hora_inicio = $7::time
           AND hora_fin = $8::time
         )
       LIMIT 1`,
      [
        horaBase.hora_programable_id,
        horaBase.dashboard_id,
        dia,
        bloque.inicio,
        bloque.fin,
        horaBase.dia_semana,
        horaInicioActual,
        horaFinActual,
      ]
    );

    if (existeEnDestino.rows.length > 0) {
      return res.status(400).json({
        error: 'Ya existe una hora registrada para el mismo curso/sección/tipo en ese bloque destino',
      });
    }

    const diaNumero = diaNumeroPorNombre[dia] || 1;
    const diaSemanaDestino = Object.keys(diaNumeroPorNombre).find(k => diaNumeroPorNombre[k] === diaNumero) || dia;

    const result = await pool.query(
      `UPDATE horas_registradas
       SET dia_semana = $1, hora_inicio = $2::time, hora_fin = $3::time, updated_at = CURRENT_TIMESTAMP
       WHERE hora_programable_id = $4
         AND dashboard_id = $5
         AND dia_semana = $6
         AND hora_inicio = $7::time
         AND hora_fin = $8::time
       RETURNING *`,
      [
        diaSemanaDestino,
        bloque.inicio,
        bloque.fin,
        horaBase.hora_programable_id,
        horaBase.dashboard_id,
        horaBase.dia_semana,
        horaInicioActual,
        horaFinActual,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron horas para actualizar' });
    }

    await reevaluarConflictosDashboard(horaBase.dashboard_id);

    res.json({
      horaRegistrada: result.rows[0],
      horasRegistradas: result.rows,
    });
  } catch (err) {
    console.error('Error al actualizar hora registrada:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/horas-registradas/:id
 * Eliminar una hora registrada
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener el dashboardId antes de eliminar
    const horaCompleta = await horasRegistradasService.obtenerPorId(id);
    if (!horaCompleta) {
      return res.status(404).json({ error: 'Hora registrada no encontrada' });
    }

    const horaInicioActual = String(horaCompleta.hora_inicio).substring(0, 8);
    const horaFinActual = String(horaCompleta.hora_fin).substring(0, 8);

    const eliminadas = await pool.query(
      `DELETE FROM horas_registradas
       WHERE hora_programable_id = $1
         AND dashboard_id = $2
         AND dia_semana = $3
         AND hora_inicio = $4::time
         AND hora_fin = $5::time
       RETURNING *`,
      [
        horaCompleta.hora_programable_id,
        horaCompleta.dashboard_id,
        horaCompleta.dia_semana,
        horaInicioActual,
        horaFinActual,
      ]
    );

    // Re-evaluar TODOS los conflictos del dashboard después de eliminar
    await reevaluarConflictosDashboard(horaCompleta.dashboard_id);

    res.json({
      message: `${eliminadas.rows.length} hora(s) registrada(s) eliminada(s)`,
      horasRegistradas: eliminadas.rows,
      horaRegistrada: eliminadas.rows[0] || null,
    });
  } catch (err) {
    console.error('Error al eliminar hora registrada:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/horas-registradas/dashboard/:dashboardId
 * Eliminar todas las horas registradas de un dashboard
 */
router.delete('/dashboard/:dashboardId', async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const count = await horasRegistradasService.limpiarDashboard(dashboardId);

    res.json({ message: `${count} horas registradas eliminadas` });
  } catch (err) {
    console.error('Error al limpiar horas registradas:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/horas-registradas/enviar-sheets/:dashboardId
 * Obtener diccionario y enviarlo a Google Sheets
 */
router.post('/enviar-sheets/:dashboardId', async (req, res) => {
  try {
    const { dashboardId } = req.params;
    
    // Obtener el diccionario preparado
    const diccionario = await horasRegistradasService.armarDiccionarioParaGoogleSheets(dashboardId);
    
    // Enviar a Google Sheets a través del Apps Script
    const resultado = await appScriptService.enviarDiccionarioASheets(diccionario);
    
    res.json({ 
      mensaje: 'Datos enviados a Google Sheets exitosamente',
      resultado 
    });
  } catch (err) {
    console.error('Error al enviar datos a Google Sheets:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

