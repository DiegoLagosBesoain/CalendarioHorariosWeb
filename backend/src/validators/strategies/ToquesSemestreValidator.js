import pool from '../../db/pool.js';

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
      let especialidadesActuales = horaProgramableActual.especialidades_semestres;

      if (typeof especialidadesActuales === 'string') {
        try {
          especialidadesActuales = JSON.parse(especialidadesActuales);
        } catch (e) {
          especialidadesActuales = {};
        }
      }

      let semestresActuales = [];
      if (Array.isArray(especialidadesActuales)) {
        semestresActuales = especialidadesActuales.map(e => e.semestre || e).filter(s => s);
      } else if (typeof especialidadesActuales === 'object') {
        semestresActuales = Object.values(especialidadesActuales).filter(s => s);
      }

      if (semestresActuales.length === 0) {
        return { isValid: true };
      }

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

        let especialidadesOtras = row.especialidades_semestres;
        if (typeof especialidadesOtras === 'string') {
          try {
            especialidadesOtras = JSON.parse(especialidadesOtras);
          } catch (e) {
            especialidadesOtras = {};
          }
        }

        let semestresOtras = [];
        if (Array.isArray(especialidadesOtras)) {
          semestresOtras = especialidadesOtras.map(e => e.semestre || e).filter(s => s);
        } else if (typeof especialidadesOtras === 'object') {
          semestresOtras = Object.values(especialidadesOtras).filter(s => s);
        }

        const semestresComunes = semestresActuales.filter(s =>
          semestresOtras.includes(s)
        );

        if (semestresComunes.length > 0) {
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

          return {
            isValid: false,
            warning: `⚠️ Conflicto de horario: ${prog1Title} Sección ${horaProgramableActual.seccion} está tocando con ${prog2Title} Sección ${row.seccion} en el semestre ${semestresComunes.join(', ')}.`,
            conflictingHoraRegId: row.id,
            conflictingCourses: [
              { codigo: horaProgramableActual.codigo, seccion: horaProgramableActual.seccion, horaProgId: horaProgramableId },
              { codigo: row.codigo, seccion: row.seccion, horaRegId: row.id }
            ],
            conflictingSemesters: semestresComunes,
          };
        }
      }

      return { isValid: true };
    } catch (err) {
      console.error('Error en ToquesSemestreValidator:', err);
      return { isValid: true };
    }
  },
};
