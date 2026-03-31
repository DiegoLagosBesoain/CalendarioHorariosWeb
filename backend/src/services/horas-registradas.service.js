import  pool  from '../db/pool.js';

/**
 * Crear una nueva hora registrada
 */
async function crear(horaProgramableId, dashboardId, diaNumero, bloqueIndex, horaInicio, horaFin, horario = 'plan_comun') {
  const dias = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const diaSemana = dias[diaNumero] || 'Lunes';

  const result = await pool.query(
    `INSERT INTO horas_registradas (hora_programable_id, dashboard_id, dia_semana, hora_inicio, hora_fin, horario)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [horaProgramableId, dashboardId, diaSemana, horaInicio, horaFin, horario]
  );

  return result.rows[0];
}

/**
 * Obtener todas las horas registradas de un dashboard
 */
async function obtenerPorDashboard(dashboardId) {
  const result = await pool.query(
    `SELECT hr.*, hp.codigo, hp.seccion, hp.titulo, hp.tipo_hora, hp.especialidades_semestres, hp.cantidad_horas
     FROM horas_registradas hr
     JOIN horas_programables hp ON hr.hora_programable_id = hp.id
     WHERE hr.dashboard_id = $1
     ORDER BY hr.created_at DESC`,
    [dashboardId]
  );

  return result.rows;
}

/**
 * Obtener una hora registrada específica
 */
async function obtenerPorId(id) {
  const result = await pool.query(
    `SELECT hr.*, hp.codigo, hp.seccion, hp.titulo, hp.tipo_hora, hp.especialidades_semestres, hp.cantidad_horas
     FROM horas_registradas hr
     JOIN horas_programables hp ON hr.hora_programable_id = hp.id
     WHERE hr.id = $1`,
    [id]
  );

  return result.rows[0];
}

/**
 * Actualizar una hora registrada (cuando se mueve de celda)
 */
async function actualizar(id, diaNumero, horaInicio, horaFin) {
  const dias = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const diaSemana = dias[diaNumero] || 'Lunes';

  const result = await pool.query(
    `UPDATE horas_registradas
     SET dia_semana = $1, hora_inicio = $2, hora_fin = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [diaSemana, horaInicio, horaFin, id]
  );

  return result.rows[0];
}

/**
 * Eliminar una hora registrada
 */
async function eliminar(id) {
  const result = await pool.query(
    `DELETE FROM horas_registradas WHERE id = $1 RETURNING *`,
    [id]
  );

  return result.rows[0];
}

/**
 * Guardar conflictos bidireccionales entre dos horas
 * Si A conflictúa con B, también B conflictúa con A
 */
async function guardarConflictos(horaRegId, conflictIds) {
  if (!conflictIds || conflictIds.length === 0) {
    return;
  }

  // Obtener los conflictos actuales de la hora
  const result = await pool.query(
    `SELECT conflictos FROM horas_registradas WHERE id = $1`,
    [horaRegId]
  );

  if (result.rows.length === 0) return;

  let conflictosActuales = result.rows[0].conflictos || [];
  if (typeof conflictosActuales === 'string') {
    try {
      conflictosActuales = JSON.parse(conflictosActuales);
    } catch (e) {
      conflictosActuales = [];
    }
  }

  // Agregar nuevos conflictos
  const nuevosConflictos = [...new Set([...conflictosActuales, ...conflictIds])];

  // Guardar en la hora actual
  await pool.query(
    `UPDATE horas_registradas SET conflictos = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [JSON.stringify(nuevosConflictos), horaRegId]
  );

  // Guardar bidireccionales: agregar horaRegId a cada conflicto
  for (const conflictId of conflictIds) {
    const conflictResult = await pool.query(
      `SELECT conflictos FROM horas_registradas WHERE id = $1`,
      [conflictId]
    );

    if (conflictResult.rows.length === 0) continue;

    let conflictosDelOtro = conflictResult.rows[0].conflictos || [];
    if (typeof conflictosDelOtro === 'string') {
      try {
        conflictosDelOtro = JSON.parse(conflictosDelOtro);
      } catch (e) {
        conflictosDelOtro = [];
      }
    }

    if (!conflictosDelOtro.includes(horaRegId)) {
      conflictosDelOtro.push(horaRegId);
      await pool.query(
        `UPDATE horas_registradas SET conflictos = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [JSON.stringify(conflictosDelOtro), conflictId]
      );
    }
  }
}

/**
 * Limpiar conflictos cuando se elimina una hora
 */
async function limpiarConflictos(horaRegId) {
  // Obtener los conflictos de esta hora
  const result = await pool.query(
    `SELECT conflictos FROM horas_registradas WHERE id = $1`,
    [horaRegId]
  );

  if (result.rows.length === 0) return;

  let conflictos = result.rows[0].conflictos || [];
  if (typeof conflictos === 'string') {
    try {
      conflictos = JSON.parse(conflictos);
    } catch (e) {
      conflictos = [];
    }
  }

  // Remover horaRegId de los conflictos de todas las horas relacionadas
  for (const conflictId of conflictos) {
    const conflictResult = await pool.query(
      `SELECT conflictos FROM horas_registradas WHERE id = $1`,
      [conflictId]
    );

    if (conflictResult.rows.length === 0) continue;

    let conflictosDelOtro = conflictResult.rows[0].conflictos || [];
    if (typeof conflictosDelOtro === 'string') {
      try {
        conflictosDelOtro = JSON.parse(conflictosDelOtro);
      } catch (e) {
        conflictosDelOtro = [];
      }
    }

    conflictosDelOtro = conflictosDelOtro.filter(id => id !== horaRegId);
    await pool.query(
      `UPDATE horas_registradas SET conflictos = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [JSON.stringify(conflictosDelOtro), conflictId]
    );
  }
}

/**
 * Eliminar todas las horas registradas de un dashboard
 */
async function limpiarDashboard(dashboardId) {
  const result = await pool.query(
    `DELETE FROM horas_registradas WHERE dashboard_id = $1 RETURNING *`,
    [dashboardId]
  );

  return result.rows.length;
}

/**
 * Armar diccionario para enviar a Google Sheets
 * Estructura: { "CodigoSeccion": { "Lunes": ["TIPO HH:MM-HH:MM", ...], ... }, ... }
 * Agrupa horas del mismo tipo que estén cerca una de la otra (permite descansos cortos)
 */
async function armarDiccionarioParaGoogleSheets(dashboardId) {
  const horas = await obtenerPorDashboard(dashboardId);
  
  // Helper: abreviar tipo de hora
  const abreviarTipo = (tipo) => {
    if (tipo === 'CLASE') return 'CLAS';
    if (tipo === 'AYUDANTIA') return 'AYUD';
    return tipo;
  };
  
  // Helper: convertir formato HH:MM o 09:MM a H:MM (remover leading zeros)
  const normalizarTiempo = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return `${h}:${m < 10 ? '0' + m : m}`;
  };

  // Helper: convertir formato H:MM a minutos desde medianoche
  const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };
  
  // Helper: convertir minutos desde medianoche a formato H:MM
  const minutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m < 10 ? '0' + m : m}`;
  };
  
  // Agrupar horas por codigo+seccion, día y tipo
  const horasPorCursoYDia = {};
  
  for (const hora of horas) {
    const clave = `${hora.codigo}${hora.seccion}`;
    
    if (!horasPorCursoYDia[clave]) {
      horasPorCursoYDia[clave] = {
        Lunes: {},
        Martes: {},
        Miércoles: {},
        Jueves: {},
        Viernes: {}
      };
    }
    
    const tipo = hora.tipo_hora;
    const horaInicio = normalizarTiempo(hora.hora_inicio.substring(0, 5));
    const horaFin = normalizarTiempo(hora.hora_fin.substring(0, 5));
    
    if (!horasPorCursoYDia[clave][hora.dia_semana][tipo]) {
      horasPorCursoYDia[clave][hora.dia_semana][tipo] = [];
    }
    
    horasPorCursoYDia[clave][hora.dia_semana][tipo].push({
      inicio: horaInicio,
      fin: horaFin
    });
  }
  
  // Agrupar horas consecutivas (con un margen de hasta 15 minutos de descanso)
  const diccionario = {};
  const DESCANSO_MAXIMO = 15; // minutos máximos de descanso permitido
  
  for (const codigo in horasPorCursoYDia) {
    diccionario[codigo] = {
      Lunes: [],
      Martes: [],
      Miércoles: [],
      Jueves: [],
      Viernes: []
    };
    
    for (const dia in horasPorCursoYDia[codigo]) {
      const tiposHora = horasPorCursoYDia[codigo][dia];
      
      for (const tipo in tiposHora) {
        // Ordenar horas por hora de inicio (numéricamente, no lexicográficamente)
        const horasOrdenadas = tiposHora[tipo].sort((a, b) => {
          const minA = timeToMinutes(a.inicio);
          const minB = timeToMinutes(b.inicio);
          return minA - minB;
        });
        
        if (!horasOrdenadas.length) continue;
        
        // Agrupar horas que estén cerca (con descanso permitido)
        const horasAgrupadas = [];
        let horaActual = { ...horasOrdenadas[0] };
        const tipoAbreviado = abreviarTipo(tipo);
        
        for (let i = 1; i < horasOrdenadas.length; i++) {
          const proximaHora = horasOrdenadas[i];
          
          // Convertir a minutos para calcular distancia
          const finActual = timeToMinutes(horaActual.fin);
          const inicioProxima = timeToMinutes(proximaHora.inicio);
          const descanso = inicioProxima - finActual;
          
          // Si el descanso es pequeño (<=DESCANSO_MAXIMO), agrupar
          if (descanso >= 0 && descanso <= DESCANSO_MAXIMO) {
            horaActual.fin = proximaHora.fin;
          } else {
            // Si no son cercanas, guardar la actual e iniciar una nueva
            horasAgrupadas.push(`${tipoAbreviado} ${horaActual.inicio}-${horaActual.fin}`);
            horaActual = { ...proximaHora };
          }
        }
        
        // Agregar la última hora agrupada
        horasAgrupadas.push(`${tipoAbreviado} ${horaActual.inicio}-${horaActual.fin}`);
        
        // Agregar al diccionario
        diccionario[codigo][dia].push(...horasAgrupadas);
      }
      
      // Ordenar todos los horarios del día por hora de inicio (numéricamente)
      diccionario[codigo][dia].sort((a, b) => {
        const horaA = a.split(' ')[1].split('-')[0];
        const horaB = b.split(' ')[1].split('-')[0];
        return timeToMinutes(horaA) - timeToMinutes(horaB);
      });
    }
  }
  
  return diccionario;
}

export { crear, obtenerPorDashboard, obtenerPorId, actualizar, eliminar, guardarConflictos, limpiarConflictos, limpiarDashboard, armarDiccionarioParaGoogleSheets };

