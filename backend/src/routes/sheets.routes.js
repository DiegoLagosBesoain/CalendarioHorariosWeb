import express from "express";
import { callAppScript } from "../services/appscript.service.js";
import {
  procesarMaestrosYCrearHorarios,
  obtenerHorariosProgramables,
  limpiarHorariosProgramables,
  obtenerPruebasProgramables,
  limpiarPruebasProgramables,
  actualizarCalendarioPruebas,
} from "../services/maestros.service.js";

const router = express.Router();

router.get("/ping", async (req, res) => {
  try {
    const result = await callAppScript("ping");

    res.json({
      ok: true,
      appscript: result,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

router.get("/master.list", async (req, res) => {
  try {
    const result = await callAppScript("maestro.listar");

    res.json({
      ok: true,
      appscript: result,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/sheets/load-maestros
 * Carga los maestros desde Google Sheets y crea los horarios programables
 */
router.post("/load-maestros", async (req, res) => {
  try {
    // Obtener datos de maestro.listar
    const resultString = await callAppScript("maestro.listar");

    // Parsear el JSON string
    let maestrosData;
    try {
      maestrosData = JSON.parse(resultString);
    } catch (parseError) {
      return res.status(400).json({
        ok: false,
        error: "Error parseando JSON de maestros",
        details: parseError.message,
      });
    }

    // Validar que sea un array
    if (!Array.isArray(maestrosData)) {
      return res.status(400).json({
        ok: false,
        error: "Los datos de maestros no son un array",
      });
    }

    // Procesar y crear horarios
    const horariosCreados = await procesarMaestrosYCrearHorarios(maestrosData);

    res.json({
      ok: true,
      mensaje: `Se cargaron ${horariosCreados.length} horarios programables`,
      horariosCreados,
    });
  } catch (err) {
    console.error("Error en load-maestros:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/sheets/horas-programables
 * Obtiene todos los horarios programables creados
 */
router.get("/horas-programables", async (req, res) => {
  try {
    const horarios = await obtenerHorariosProgramables();

    res.json({
      ok: true,
      cantidad: horarios.length,
      horarios,
    });
  } catch (err) {
    console.error("Error en horas-programables:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

/**
 * DELETE /api/sheets/horas-programables
 * Limpia todos los horarios programables (para reload)
 */
router.delete("/horas-programables", async (req, res) => {
  try {
    const cantidad = await limpiarHorariosProgramables();

    res.json({
      ok: true,
      mensaje: `Se eliminaron ${cantidad} horarios programables`,
    });
  } catch (err) {
    console.error("Error limpiando horas-programables:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/sheets/pruebas-programables
 * Obtiene todas las pruebas programables creadas
 */
router.get("/pruebas-programables", async (req, res) => {
  try {
    const pruebas = await obtenerPruebasProgramables();

    res.json({
      ok: true,
      cantidad: pruebas.length,
      pruebas,
    });
  } catch (err) {
    console.error("Error en pruebas-programables:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

/**
 * DELETE /api/sheets/pruebas-programables
 * Limpia todas las pruebas programables (para reload)
 */
router.delete("/pruebas-programables", async (req, res) => {
  try {
    const cantidad = await limpiarPruebasProgramables();

    res.json({
      ok: true,
      mensaje: `Se eliminaron ${cantidad} pruebas programables`,
    });
  } catch (err) {
    console.error("Error limpiando pruebas-programables:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/sheets/actualizar-calendario/:dashboardId
 * Crea/actualiza pruebas programables de CLASE, AYUDANTIA y LAB/TALLER
 * basándose en las horas registradas del dashboard
 */
router.post("/actualizar-calendario/:dashboardId", async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const { pruebasCreadas, eliminadas } = await actualizarCalendarioPruebas(parseInt(dashboardId));
    const todasLasPruebas = await obtenerPruebasProgramables();
    res.json({
      ok: true,
      mensaje: `Se crearon/actualizaron ${pruebasCreadas.length} pruebas programables desde el horario`,
      pruebasCreadas,
      eliminadas,
      pruebas: todasLasPruebas,
    });
  } catch (err) {
    console.error("Error en actualizar-calendario:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

export default router;
