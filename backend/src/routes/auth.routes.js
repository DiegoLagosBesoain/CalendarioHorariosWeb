import express from 'express';
import { pool } from '../db/pool.js';

const router = express.Router();

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { nombre, mail, password } = req.body;

    if (!nombre || !mail || !password) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Verificar si el usuario ya existe
    const existing = await pool.query(
      'SELECT id FROM usuarios WHERE mail = $1',
      [mail]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    // Insertar nuevo usuario con rol por defecto
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, mail, rol) VALUES ($1, $2, $3) RETURNING id, nombre, mail, rol, created_at',
      [nombre, mail, 'user'] // Cambiar 'user' si quieres otro rol por defecto
    );

    const user = result.rows[0];
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        nombre: user.nombre,
        mail: user.mail,
        rol: user.rol,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Login de usuario
router.post('/login', async (req, res) => {
  try {
    const { mail, password } = req.body;

    if (!mail || !password) {
      return res.status(400).json({ error: 'Correo y contraseña requeridos' });
    }

    // Buscar usuario por correo
    const result = await pool.query(
      'SELECT id, nombre, mail, rol, created_at FROM usuarios WHERE mail = $1',
      [mail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // TODO: Implementar validación de contraseña (hash)
    // Por ahora, aceptamos cualquier contraseña para demostración

    const user = result.rows[0];
    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        nombre: user.nombre,
        mail: user.mail,
        rol: user.rol,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
