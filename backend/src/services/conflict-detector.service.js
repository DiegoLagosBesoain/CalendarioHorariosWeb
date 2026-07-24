import  pool  from '../db/pool.js';
import { extraerSemestres, tieneConflictoDisponibilidad } from './conflict-utils.js';

async function reevaluarConflictosDashboard(dashboardId) {
  try {
    await pool.query(
      `UPDATE horas_registradas
       SET conflictos = '[]'::json
       WHERE dashboard_id = $1`,
      [dashboardId]
    );

    const result = await pool.query(
      `SELECT
        hr.id as hora_reg_id,
        hr.hora_programable_id,
        hr.dia_semana,
        hr.hora_inicio,
        hr.hora_fin,
        hr.horario,
        hp.codigo,
        hp.seccion,
        hp.titulo,
        hp.tipo_hora,
        hp.especialidades_semestres,
        hp.disponibilidad,
        hp.profesor_1_id,
        hp.profesor_2_id,
        hp.sala_especial
       FROM horas_registradas hr
       JOIN horas_programables hp ON hr.hora_programable_id = hp.id
       WHERE hr.dashboard_id = $1
       ORDER BY hr.id`,
      [dashboardId]
    );

    const horas = result.rows;
    const conflictosPorHora = {};

    const agregarConflicto = (id1, id2, tipo) => {
      if (!conflictosPorHora[id1]) conflictosPorHora[id1] = [];
      if (!conflictosPorHora[id2]) conflictosPorHora[id2] = [];
      if (!conflictosPorHora[id1].some(c => c.id === id2 && c.tipo === tipo)) {
        conflictosPorHora[id1].push({ id: id2, tipo });
      }
      if (!conflictosPorHora[id2].some(c => c.id === id1 && c.tipo === tipo)) {
        conflictosPorHora[id2].push({ id: id1, tipo });
      }
    };

    const agregarConflictoEspecial = (id, tipo) => {
      if (!conflictosPorHora[id]) conflictosPorHora[id] = [];
      if (!conflictosPorHora[id].some(c => c.tipo === tipo)) {
        conflictosPorHora[id].push({ id: null, tipo });
      }
    };

    const normHoraInicio = (h) => {
      if (!h) return '';
      const str = String(h).substring(0, 5);
      const [hh, mm] = str.split(':');
      return `${parseInt(hh)}:${mm}`;
    };

    const profesoresPorHora = horas.map(h => {
      const ids = new Set();
      if (h.profesor_1_id != null) ids.add(Number(h.profesor_1_id));
      if (h.profesor_2_id != null) ids.add(Number(h.profesor_2_id));
      return ids;
    });

    console.log(`[ConflictDetector] Dashboard ${dashboardId}: ${horas.length} horas totales`);
    horas.forEach((h, idx) => {
      const profs = [...profesoresPorHora[idx]];
      if (profs.length > 0) {
        console.log(`  [${idx}] hr_id=${h.hora_reg_id} ${h.codigo} Sec${h.seccion} ${h.tipo_hora} | dia=${h.dia_semana} hora=${normHoraInicio(h.hora_inicio)} horario=${h.horario} | profIds=[${profs.join(',')}]`);
      }
    });

    for (let i = 0; i < horas.length; i++) {
      for (let j = i + 1; j < horas.length; j++) {
        const hora1 = horas[i];
        const hora2 = horas[j];

        if (hora1.dia_semana === hora2.dia_semana &&
            normHoraInicio(hora1.hora_inicio) === normHoraInicio(hora2.hora_inicio) &&
            hora1.horario === hora2.horario) {

          if (hora1.codigo === hora2.codigo) {
            continue;
          }

          const semestres1 = extraerSemestres(hora1.especialidades_semestres);
          const semestres2 = extraerSemestres(hora2.especialidades_semestres);
          const semestresComunes = semestres1.filter(s => semestres2.includes(s));

          if (semestresComunes.length > 0) {
            agregarConflicto(hora1.hora_reg_id, hora2.hora_reg_id, 'semestre');
          }
        }
      }
    }

    const bloqueMap = {};
    horas.forEach((h, idx) => {
      const clave = `${h.dia_semana}|${normHoraInicio(h.hora_inicio)}`;
      if (!bloqueMap[clave]) bloqueMap[clave] = [];
      bloqueMap[clave].push(idx);
    });

    console.log(`[ConflictDetector] Bloques ocupados: ${Object.keys(bloqueMap).length}`);
    for (const [clave, indices] of Object.entries(bloqueMap)) {
      if (indices.length < 2) continue;

      console.log(`  Bloque [${clave}]: ${indices.length} horas`);

      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          const idx1 = indices[i];
          const idx2 = indices[j];
          const hora1 = horas[idx1];
          const hora2 = horas[idx2];

          if (hora1.hora_programable_id === hora2.hora_programable_id) {
            continue;
          }

          if (hora1.tipo_hora === 'AYUDANTIA' || hora2.tipo_hora === 'AYUDANTIA') {
            continue;
          }

          const profs1 = profesoresPorHora[idx1];
          const profs2 = profesoresPorHora[idx2];

          if (profs1.size === 0 || profs2.size === 0) continue;

          let profesorComun = null;
          for (const profId of profs1) {
            if (profs2.has(profId)) {
              profesorComun = profId;
              break;
            }
          }

          if (profesorComun !== null) {
            console.log(`    ⚠️ PROFESOR COMPARTIDO (id=${profesorComun}): ${hora1.codigo} Sec${hora1.seccion} ${hora1.tipo_hora} [${hora1.horario}] vs ${hora2.codigo} Sec${hora2.seccion} ${hora2.tipo_hora} [${hora2.horario}]`);
            agregarConflicto(hora1.hora_reg_id, hora2.hora_reg_id, 'profesor');
          }
        }
      }
    }

    for (const [, indices] of Object.entries(bloqueMap)) {
      if (indices.length < 2) continue;

      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          const idx1 = indices[i];
          const idx2 = indices[j];
          const hora1 = horas[idx1];
          const hora2 = horas[idx2];

          if (hora1.hora_programable_id === hora2.hora_programable_id) {
            continue;
          }

          if (hora1.sala_especial && hora2.sala_especial &&
              hora1.sala_especial === hora2.sala_especial) {
            console.log(`    ⚠️ SALA ESPECIAL COMPARTIDA ("${hora1.sala_especial}"): ${hora1.codigo} Sec${hora1.seccion} ${hora1.tipo_hora} vs ${hora2.codigo} Sec${hora2.seccion} ${hora2.tipo_hora}`);
            agregarConflicto(hora1.hora_reg_id, hora2.hora_reg_id, 'sala_especial');
          }
        }
      }
    }

    for (const hora of horas) {
      if (tieneConflictoDisponibilidad(hora)) {
        agregarConflictoEspecial(hora.hora_reg_id, 'disponibilidad');
      }
    }

    for (const [horaRegId, conflictIds] of Object.entries(conflictosPorHora)) {
      const uniqueConflicts = [...new Set(conflictIds)];

      await pool.query(
        `UPDATE horas_registradas
         SET conflictos = $1::json
         WHERE id = $2`,
        [JSON.stringify(uniqueConflicts), horaRegId]
      );
    }

    console.log(`[ConflictDetector] Re-evaluados conflictos para dashboard ${dashboardId}. Encontrados: ${Object.keys(conflictosPorHora).length} horas con conflictos`);

    return {
      success: true,
      totalHoras: horas.length,
      horasConConflictos: Object.keys(conflictosPorHora).length
    };

  } catch (error) {
    console.error('[ConflictDetector] Error re-evaluando conflictos:', error);
    throw error;
  }
}

function compararItemConOtros(item, otros) {
  const conflictosDelItem = [];
  const conflictosAjenos = {};

  const agregarConflictoIncremental = (idItem, idOtro, tipo) => {
    if (!conflictosDelItem.some(c => c.id === idOtro && c.tipo === tipo)) {
      conflictosDelItem.push({ id: idOtro, tipo });
    }
    if (!conflictosAjenos[idOtro]) conflictosAjenos[idOtro] = [];
    if (!conflictosAjenos[idOtro].some(c => c.id === idItem && c.tipo === tipo)) {
      conflictosAjenos[idOtro].push({ id: idItem, tipo });
    }
  };

  const agregarConflictoEspecialIncremental = (tipo) => {
    if (!conflictosDelItem.some(c => c.tipo === tipo)) {
      conflictosDelItem.push({ id: null, tipo });
    }
  };

  const norm = (h) => {
    if (!h) return '';
    const str = String(h).substring(0, 5);
    const [hh, mm] = str.split(':');
    return `${parseInt(hh)}:${mm}`;
  };

  const profsItem = new Set();
  if (item.profesor_1_id != null) profsItem.add(Number(item.profesor_1_id));
  if (item.profesor_2_id != null) profsItem.add(Number(item.profesor_2_id));

  for (const otro of otros) {
    if (
      item.dia_semana === otro.dia_semana &&
      norm(item.hora_inicio) === norm(otro.hora_inicio) &&
      item.horario === otro.horario &&
      item.codigo !== otro.codigo
    ) {
      const sem1 = extraerSemestres(item.especialidades_semestres);
      const sem2 = extraerSemestres(otro.especialidades_semestres);
      const comunes = sem1.filter(s => sem2.includes(s));
      if (comunes.length > 0) {
        agregarConflictoIncremental(item.hora_reg_id, otro.hora_reg_id, 'semestre');
      }
    }

    if (item.tipo_hora !== 'AYUDANTIA' && otro.tipo_hora !== 'AYUDANTIA' &&
        item.hora_programable_id !== otro.hora_programable_id &&
        item.dia_semana === otro.dia_semana &&
        norm(item.hora_inicio) === norm(otro.hora_inicio)) {
      const profsOtro = new Set();
      if (otro.profesor_1_id != null) profsOtro.add(Number(otro.profesor_1_id));
      if (otro.profesor_2_id != null) profsOtro.add(Number(otro.profesor_2_id));
      if (profsItem.size > 0 && profsOtro.size > 0) {
        for (const pid of profsItem) {
          if (profsOtro.has(pid)) {
            agregarConflictoIncremental(item.hora_reg_id, otro.hora_reg_id, 'profesor');
            break;
          }
        }
      }
    }

    if (item.hora_programable_id !== otro.hora_programable_id &&
        item.dia_semana === otro.dia_semana &&
        norm(item.hora_inicio) === norm(otro.hora_inicio) &&
        item.sala_especial && otro.sala_especial &&
        item.sala_especial === otro.sala_especial) {
      agregarConflictoIncremental(item.hora_reg_id, otro.hora_reg_id, 'sala_especial');
    }
  }

  if (tieneConflictoDisponibilidad(item)) {
    agregarConflictoEspecialIncremental('disponibilidad');
  }

  return { conflictosDelItem, conflictosAjenos };
}

async function limpiarConflictosDeItem(horaRegId) {
  const item = await pool.query(
    `SELECT dashboard_id FROM horas_registradas WHERE id = $1`,
    [horaRegId]
  );
  if (item.rows.length === 0) return { success: true, mensaje: 'item no existe' };

  const dashboardId = item.rows[0].dashboard_id;

  const result = await pool.query(
    `SELECT id, conflictos FROM horas_registradas WHERE dashboard_id = $1`,
    [dashboardId]
  );

  for (const row of result.rows) {
    const conflictos = Array.isArray(row.conflictos) ? row.conflictos : [];
    const filtrados = conflictos.filter(c => {
      const cid = typeof c === 'object' ? c.id : c;
      return Number(cid) !== Number(horaRegId);
    });

    if (filtrados.length !== conflictos.length) {
      await pool.query(
        `UPDATE horas_registradas SET conflictos = $1::json WHERE id = $2`,
        [JSON.stringify(filtrados), row.id]
      );
    }
  }

  return { success: true, mensaje: `referencias a ${horaRegId} limpiadas` };
}

async function reevaluarConflictosNuevoItem(horaRegId) {
  const itemResult = await pool.query(
    `SELECT
      hr.id as hora_reg_id,
      hr.hora_programable_id,
      hr.dia_semana,
      hr.hora_inicio,
      hr.hora_fin,
      hr.horario,
      hp.codigo,
      hp.seccion,
      hp.titulo,
      hp.tipo_hora,
      hp.especialidades_semestres,
      hp.disponibilidad,
      hp.profesor_1_id,
      hp.profesor_2_id,
      hp.sala_especial,
      hr.dashboard_id
     FROM horas_registradas hr
     JOIN horas_programables hp ON hr.hora_programable_id = hp.id
     WHERE hr.id = $1`,
    [horaRegId]
  );

  if (itemResult.rows.length === 0) {
    return { success: false, mensaje: 'item no encontrado' };
  }

  const item = itemResult.rows[0];
  const dashboardId = item.dashboard_id;

  const otrosResult = await pool.query(
    `SELECT
      hr.id as hora_reg_id,
      hr.hora_programable_id,
      hr.dia_semana,
      hr.hora_inicio,
      hr.hora_fin,
      hr.horario,
      hp.codigo,
      hp.seccion,
      hp.titulo,
      hp.tipo_hora,
      hp.especialidades_semestres,
      hp.disponibilidad,
      hp.profesor_1_id,
      hp.profesor_2_id,
      hp.sala_especial
     FROM horas_registradas hr
     JOIN horas_programables hp ON hr.hora_programable_id = hp.id
     WHERE hr.dashboard_id = $1 AND hr.id != $2`,
    [dashboardId, horaRegId]
  );

  const otros = otrosResult.rows;
  const { conflictosDelItem, conflictosAjenos } = compararItemConOtros(item, otros);

  await pool.query(
    `UPDATE horas_registradas SET conflictos = $1::json WHERE id = $2`,
    [JSON.stringify(conflictosDelItem), horaRegId]
  );

  for (const [otroId, nuevosConflictos] of Object.entries(conflictosAjenos)) {
    const existentes = await pool.query(
      `SELECT conflictos FROM horas_registradas WHERE id = $1`,
      [otroId]
    );
    if (existentes.rows.length === 0) continue;

    const actuales = Array.isArray(existentes.rows[0].conflictos) ? existentes.rows[0].conflictos : [];
    const combinados = [...actuales, ...nuevosConflictos];

    const unicos = [];
    const visto = new Set();
    for (const c of combinados) {
      const key = `${c.id}|${c.tipo}`;
      if (!visto.has(key)) {
        visto.add(key);
        unicos.push(c);
      }
    }

    await pool.query(
      `UPDATE horas_registradas SET conflictos = $1::json WHERE id = $2`,
      [JSON.stringify(unicos), otroId]
    );
  }

  return {
    success: true,
    itemId: horaRegId,
    conflictos: conflictosDelItem,
    otrosAfectados: Object.keys(conflictosAjenos).map(Number)
  };
}

async function reevaluarConflictosItemMovido(horaRegId) {
  await limpiarConflictosDeItem(horaRegId);
  return await reevaluarConflictosNuevoItem(horaRegId);
}

export {
  reevaluarConflictosDashboard,
  reevaluarConflictosNuevoItem,
  reevaluarConflictosItemMovido,
  limpiarConflictosDeItem
};
