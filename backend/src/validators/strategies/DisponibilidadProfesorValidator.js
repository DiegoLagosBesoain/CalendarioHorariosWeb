import pool from '../../db/pool.js';
import { verificarBloqueEnDisponibilidad } from '../../utils/disponibilidad-utils.js';
import { BLOQUES_MAP } from '../../constants/horarios.js';
import { normalizarHora } from '../../utils/horario-utils.js';

export default {
  nombre: 'disponibilidad_profesor',

  async validar({ horaProgramableId, dia, horaInicio }) {
    try {
      const result = await pool.query(
        `SELECT hp.disponibilidad, hp.codigo, hp.seccion, hp.titulo, hp.tipo_hora,
                hp.profesor_1_id, hp.profesor_2_id,
                p1.nombre as prof1_nombre, p2.nombre as prof2_nombre
         FROM horas_programables hp
         LEFT JOIN profesores p1 ON hp.profesor_1_id = p1.id
         LEFT JOIN profesores p2 ON hp.profesor_2_id = p2.id
         WHERE hp.id = $1`,
        [horaProgramableId]
      );

      if (result.rows.length === 0) {
        return { isValid: true };
      }

      const {
        disponibilidad, codigo, seccion, titulo, tipo_hora,
        profesor_1_id, profesor_2_id, prof1_nombre, prof2_nombre,
      } = result.rows[0];

      if (tipo_hora === 'AYUDANTIA' || tipo_hora === 'LAB/TALLER') {
        return { isValid: true };
      }

      if (!profesor_1_id && !profesor_2_id) {
        return { isValid: true };
      }

      const check = verificarBloqueEnDisponibilidad(disponibilidad, dia, horaInicio);

      if (check.razon === 'sin_disponibilidad') {
        return { isValid: true };
      }

      if (!check.disponible) {
        const nombreProf = prof1_nombre || prof2_nombre || 'Profesor';
        const bloqueCompleto = BLOQUES_MAP[normalizarHora(horaInicio)] || horaInicio;

        if (check.razon === 'sin_datos_dia') {
          return {
            isValid: false,
            warning: `🚫 Disponibilidad: ${nombreProf} no tiene disponibilidad registrada el día ${dia} para ${titulo || codigo} Sección ${seccion}.`,
          };
        }

        return {
          isValid: false,
          warning: `🚫 Disponibilidad: ${nombreProf} no está disponible ${dia} ${bloqueCompleto} para ${titulo || codigo} Sección ${seccion}.`,
        };
      }

      return { isValid: true };
    } catch (err) {
      console.error('Error en DisponibilidadProfesorValidator:', err);
      return { isValid: true };
    }
  },
};
