import express from 'express';
import * as pruebasRegistradasService from '../services/pruebas-registradas.service.js';
import { reevaluarConflictosPruebasDashboard } from '../services/conflict-detector.service.js';

const router = express.Router();

/**
 * GET /api/pruebas-registradas/:dashboardId
 * Obtener todas las pruebas registradas de un dashboard
 */
router.get('/:dashboardId', async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const pruebasRegistradas = await pruebasRegistradasService.obtenerPorDashboard(dashboardId);
    res.json({ pruebasRegistradas });
  } catch (err) {
    console.error('Error al obtener pruebas registradas:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/pruebas-registradas/rango/:dashboardId
 * Obtener pruebas registradas por rango de fechas
 * Query params: fechaInicio, fechaFin (formato YYYY-MM-DD)
 */
router.get('/rango/:dashboardId', async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'Se requieren fechaInicio y fechaFin' });
    }

    const pruebas = await pruebasRegistradasService.obtenerPorRangoFechas(
      dashboardId,
      fechaInicio,
      fechaFin
    );
    res.json({ pruebas });
  } catch (err) {
    console.error('Error al obtener pruebas por rango de fechas:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/pruebas-registradas
 * Crear una nueva prueba registrada
 * Body: { pruebaProgramableId, dashboardId, fecha }
 */
router.post('/', async (req, res) => {
  try {
    const { pruebaProgramableId, dashboardId, fecha } = req.body;

    if (!pruebaProgramableId || !dashboardId || !fecha) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const pruebaRegistrada = await pruebasRegistradasService.crear(
      pruebaProgramableId,
      dashboardId,
      fecha
    );

    // Re-evaluar conflictos del dashboard después de crear
    await reevaluarConflictosPruebasDashboard(dashboardId);

    res.json({ pruebaRegistrada });
  } catch (err) {
    console.error('Error al crear prueba registrada:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/pruebas-registradas/:id
 * Actualizar una prueba registrada
 * Body: { fecha }
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha } = req.body;

    if (!fecha) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const pruebaRegistrada = await pruebasRegistradasService.actualizar(
      id,
      fecha
    );

    // Re-evaluar conflictos del dashboard después de actualizar
    await reevaluarConflictosPruebasDashboard(pruebaRegistrada.dashboard_id);

    res.json({ pruebaRegistrada });
  } catch (err) {
    console.error('Error al actualizar prueba registrada:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/pruebas-registradas/:id
 * Eliminar una prueba registrada
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener dashboard_id antes de eliminar
    const pruebaAntes = await pruebasRegistradasService.obtenerPorId(id);
    
    if (!pruebaAntes) {
      return res.status(404).json({ error: 'Prueba registrada no encontrada' });
    }
    
    const dashboardId = pruebaAntes.dashboard_id;
    
    // Limpiar conflictos antes de eliminar
    await pruebasRegistradasService.limpiarConflictos(id);
    
    const pruebaRegistrada = await pruebasRegistradasService.eliminar(id);

    // Re-evaluar conflictos del dashboard después de eliminar
    await reevaluarConflictosPruebasDashboard(dashboardId);

    res.json({ message: 'Prueba registrada eliminada', pruebaRegistrada });
  } catch (err) {
    console.error('Error al eliminar prueba registrada:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/pruebas-registradas/dashboard/:dashboardId
 * Eliminar todas las pruebas registradas de un dashboard
 */
router.delete('/dashboard/:dashboardId', async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const count = await pruebasRegistradasService.limpiarDashboard(dashboardId);

    res.json({ message: `${count} pruebas registradas eliminadas` });
  } catch (err) {
    console.error('Error al limpiar pruebas registradas:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
