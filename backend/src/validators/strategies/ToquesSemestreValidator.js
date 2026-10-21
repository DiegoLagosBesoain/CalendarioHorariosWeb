import pool from '../../db/pool.js';
import { conflictosDeSemestre } from '../../services/conflict-utils.js';

export default {
  nombre: 'toques_de_semestre',

  async validar({ horaProgramableId, dashboardId, horario, dia, horaInicio }) {
    try {
      const progResult = await pool.query(
        `SELECT codigo, seccion, especialidades_semestres FROM horas_programables WHERE id = $1`,
        [horaProgramableId]
      );

      if (progResult.rows.length === 0) {
        return { isValid: true };
      }

      const horaProgramableActual = progResult.rows[0];

      const horasResult = await pool.query(
        `SELECT hr.id, hp.codigo, hp.seccion, hp.especialidades_semestres
         FROM horas_registradas hr
         JOIN horas_programables hp ON hr.hora_programable_id = hp.id
         WHERE hr.dashboard_id = $1
         AND hr.horario = $2
         AND hr.dia_semana = $3
         AND hr.hora_inicio = $4`,
        [dashboardId, horario, dia, horaInicio]
      );

      for (const row of horasResult.rows) {
        if (row.codigo === horaProgramableActual.codigo) {
          continue;
        }

        const { hayConflicto, paresComunes, semestresPlanComun } = conflictosDeSemestre(
          horaProgramableActual.especialidades_semestres,
          row.especialidades_semestres
        );

        if (!hayConflicto) {
          continue;
        }

        const prog1Result = await pool.query(
          `SELECT titulo FROM horas_programables WHERE id = $1`,
          [horaProgramableId]
        );
        const prog1Title = prog1Result.rows[0]?.titulo || horaProgramableActual.codigo;

        const prog2Result = await pool.query(
          `SELECT titulo FROM horas_programables WHERE id = (SELECT hora_programable_id FROM horas_registradas WHERE id = $1)`,
          [row.id]
        );
        const prog2Title = prog2Result.rows[0]?.titulo || row.codigo;

        const detalles = [];
        for (const par of paresComunes) {
          detalles.push(`${par.especialidad} semestre ${par.semestre}`);
        }
        for (const semestre of semestresPlanComun) {
          if (!paresComunes.some(p => p.semestre === semestre)) {
            detalles.push(`semestre ${semestre} (Plan Común transversal)`);
          }
        }

        const semestresInvolucrados = [...new Set([
          ...paresComunes.map(p => p.semestre),
          ...semestresPlanComun,
        ])];

        return {
          isValid: false,
          warning: `⚠️ Conflicto de horario: ${prog1Title} Sección ${horaProgramableActual.seccion} está tocando con ${prog2Title} Sección ${row.seccion} en ${detalles.join(', ')}.`,
          conflictingHoraRegId: row.id,
          conflictingCourses: [
            { codigo: horaProgramableActual.codigo, seccion: horaProgramableActual.seccion, horaProgId: horaProgramableId },
            { codigo: row.codigo, seccion: row.seccion, horaRegId: row.id }
          ],
          conflictingSemesters: semestresInvolucrados,
        };
      }

      return { isValid: true };
    } catch (err) {
      console.error('Error en ToquesSemestreValidator:', err);
      return { isValid: true };
    }
  },
};
