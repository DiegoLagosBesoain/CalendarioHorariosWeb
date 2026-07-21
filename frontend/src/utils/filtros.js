/**
 * Helper compartido de filtrado y determinación de semestres
 * Unifica la lógica duplicada entre DashboardDetailPage, TimeTable y CalendarView
 */

/**
 * Limpia el número de semestre removiendo letras
 * Ej: "11e" -> 11, "9" -> 9
 */
function limpiarNumeroSemestre(semestre) {
  if (semestre == null) return null;
  if (typeof semestre === 'number') return Math.floor(semestre);
  const num = parseInt(String(semestre).replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? null : num;
}

/**
 * Parsea especialidades_semestres a un array normalizado [{nombre, semestre}]
 * Soporta tanto array como objeto
 */
function parsearEspecialidades(especialidades_semestres) {
  if (!especialidades_semestres) return [];

  let esp = especialidades_semestres;
  if (typeof esp === 'string') {
    try {
      esp = JSON.parse(esp);
    } catch (e) {
      return [];
    }
  }

  const resultado = [];

  if (Array.isArray(esp)) {
    esp.forEach(item => {
      if (item && item.nombre !== undefined && item.semestre !== undefined) {
        resultado.push({
          nombre: item.nombre,
          semestre: limpiarNumeroSemestre(item.semestre),
        });
      }
    });
    return resultado;
  }

  if (typeof esp === 'object') {
    Object.keys(esp).forEach(key => {
      const semestres = esp[key];
      if (Array.isArray(semestres)) {
        semestres.forEach(sem => {
          const semestreNum = limpiarNumeroSemestre(sem);
          if (semestreNum) {
            resultado.push({ nombre: key, semestre: semestreNum });
          }
        });
      } else {
        const semestreNum = limpiarNumeroSemestre(semestres);
        if (semestreNum) {
          resultado.push({ nombre: key, semestre: semestreNum });
        }
      }
    });
    return resultado;
  }

  return [];
}

/**
 * Filtra un horario/prueba según los filtros de especialidad y semestre
 * @param {Object} horario - El horario_programable o prueba_programable
 * @param {string} filtroEspecialidad - 'TODOS' o nombre de especialidad
 * @param {string[]} filtroSemestre - Array de semestres permitidos ([] = todos)
 * @returns {boolean}
 */
export function filtrarHorario(horario, filtroEspecialidad = 'TODOS', filtroSemestre = []) {
  if (!horario || !horario.especialidades_semestres) return false;

  let esp = horario.especialidades_semestres;
  if (typeof esp === 'string') {
    try {
      esp = JSON.parse(esp);
    } catch (e) {
      return false;
    }
  }

  // Si no hay filtros, mostrar todo
  const espVacia = filtroEspecialidad === 'TODOS' || filtroEspecialidad === '';
  const semVacio = !filtroSemestre || filtroSemestre.length === 0;
  if (espVacia && semVacio) return true;

  const especialidades = parsearEspecialidades(esp);

  for (const item of especialidades) {
    const nombreEsp = item.nombre;
    const semestreNum = item.semestre;

    if (semestreNum == null) continue;

    const cumpleEspecialidad = espVacia ||
      nombreEsp === filtroEspecialidad ||
      nombreEsp === 'Plan Común' ||
      nombreEsp === 'plan_comun';

    const cumpleSemestre = semVacio ||
      filtroSemestre.includes(String(semestreNum));

    if (cumpleEspecialidad && cumpleSemestre) return true;
  }

  return false;
}

/**
 * Determina si un programable pertenece a un grupo de horario específico
 * @param {Object} programable - El horario_programable o prueba_programable
 * @param {string} semestreId - 'plan_comun', '5to_6to', '7mo_8vo', '9no_10_11'
 * @returns {boolean}
 */
export function filterForSemester(programable, semestreId) {
  if (!programable || !programable.especialidades_semestres) return false;

  let esp = programable.especialidades_semestres;
  if (typeof esp === 'string') {
    try {
      esp = JSON.parse(esp);
    } catch (err) {
      return false;
    }
  }

  const especialidades = parsearEspecialidades(esp);

  if (semestreId === 'plan_comun') {
    return especialidades.some(e =>
      e.nombre === 'Plan Común' ||
      (e.nombre && e.nombre.toLowerCase && e.nombre.toLowerCase() === 'plan común')
    );
  }

  const targets = {
    '5to_6to': [5, 6],
    '7mo_8vo': [7, 8],
    '9no_10_11': [9, 10, 11]
  }[semestreId];

  if (!targets) return false;

  return especialidades.some(e => targets.includes(e.semestre));
}

/**
 * Determina el grupo de horario al que pertenece un programable
 * @param {Object} programable - El horario_programable
 * @param {Object[]} horariosProgramables - Lista completa de programables para búsqueda por ID
 * @returns {string} 'plan_comun', '5to_6to', '7mo_8vo', '9no_10_11'
 */
export function determinarSemestre(programable) {
  if (!programable) return 'plan_comun';

  let esp = programable.especialidades_semestres;
  if (typeof esp === 'string') {
    try {
      esp = JSON.parse(esp);
    } catch (err) {
      return 'plan_comun';
    }
  }

  const especialidades = parsearEspecialidades(esp);

  if (especialidades.some(e => [9, 10, 11].includes(Number(e.semestre)))) return '9no_10_11';
  if (especialidades.some(e => [7, 8].includes(Number(e.semestre)))) return '7mo_8vo';
  if (especialidades.some(e => [5, 6].includes(Number(e.semestre)))) return '5to_6to';

  return 'plan_comun';
}
