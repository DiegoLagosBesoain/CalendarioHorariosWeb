import express from 'express';
import * as horasRegistradasService from '../services/horas-registradas.service.js';
import * as appScriptService from '../services/appscript.service.js';
import { ejecutarValidaciones } from '../validators/hora-registrada.validators.js';

const router = express.Router();

// Mapeo de día a número
const diaNumeroPorNombre = {
  'Lunes': 1,
  'Martes': 2,
  'Miércoles': 3,
  'Jueves': 4,
  'Viernes': 5
};

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

    const horaRegistrada = await horasRegistradasService.crear(
      horaProgramableId,
      dashboardId,
      diaNumero,
      bloqueIndex,
      bloque.inicio,
      bloque.fin,
      semestreId
    );

    // Guardar conflictos si existen
    if (validationResult.conflictIds && validationResult.conflictIds.length > 0) {
      await horasRegistradasService.guardarConflictos(horaRegistrada.id, validationResult.conflictIds);
    }

    // Retornar la hora registrada junto con las advertencias
    res.json({ 
      horaRegistrada,
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

    const diaNumero = diaNumeroPorNombre[dia] || 1;

    const horaRegistrada = await horasRegistradasService.actualizar(
      id,
      diaNumero,
      bloque.inicio,
      bloque.fin
    );

    res.json({ horaRegistrada });
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
    
    // Limpiar conflictos antes de eliminar
    await horasRegistradasService.limpiarConflictos(id);
    
    const horaRegistrada = await horasRegistradasService.eliminar(id);

    if (!horaRegistrada) {
      return res.status(404).json({ error: 'Hora registrada no encontrada' });
    }

    res.json({ message: 'Hora registrada eliminada', horaRegistrada });
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

