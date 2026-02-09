import express from 'express';
import { pool } from '../db/pool.js';

const router = express.Router();

// Obtener dashboards de un usuario
router.get('/', async (req, res) => {
  try {
    const { usuario_id } = req.query;

    if (!usuario_id) {
      return res.status(400).json({ error: 'usuario_id es requerido' });
    }

    const result = await pool.query(
      'SELECT id, nombre, usuario_id, created_at, updated_at FROM dashboards WHERE usuario_id = $1 ORDER BY created_at DESC',
      [usuario_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo dashboards:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear dashboard
router.post('/', async (req, res) => {
  try {
    const { nombre, usuario_id } = req.body;

    if (!nombre || !usuario_id) {
      return res.status(400).json({ error: 'Nombre y usuario_id son requeridos' });
    }

    // Verificar que el usuario existe
    const userCheck = await pool.query(
      'SELECT id FROM usuarios WHERE id = $1',
      [usuario_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const result = await pool.query(
      'INSERT INTO dashboards (nombre, usuario_id) VALUES ($1, $2) RETURNING id, nombre, usuario_id, created_at, updated_at',
      [nombre, usuario_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creando dashboard:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar dashboard
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }

    const result = await pool.query(
      'UPDATE dashboards SET nombre = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, nombre, usuario_id, created_at, updated_at',
      [nombre, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando dashboard:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar dashboard
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM dashboards WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard no encontrado' });
    }

    res.json({ message: 'Dashboard eliminado exitosamente', id });
  } catch (error) {
    console.error('Error eliminando dashboard:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
