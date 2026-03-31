import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';

const router = express.Router();

// Registro de usuario (protegido por clave admin de entorno)
router.post('/register', async (req, res) => {
  try {
    const { nombre, mail, password, adminPassword } = req.body;

    if (!nombre || !mail || !password || !adminPassword) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const expectedAdminPassword = process.env.ADMIN_REGISTRATION_PASSWORD;
    if (!expectedAdminPassword) {
      return res.status(500).json({ error: 'ADMIN_REGISTRATION_PASSWORD no configurada' });
    }

    if (adminPassword !== expectedAdminPassword) {
      return res.status(403).json({ error: 'Clave de administrador inválida' });
    }

    const existing = await pool.query(
      'SELECT id FROM usuarios WHERE mail = $1',
      [mail]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, mail, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, mail, rol, created_at',
      [nombre, mail, passwordHash, 'user']
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
      'SELECT id, nombre, mail, rol, created_at, password_hash FROM usuarios WHERE mail = $1',
      [mail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const passwordOk = await bcrypt.compare(password, user.password_hash || '');

    if (!passwordOk) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

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
