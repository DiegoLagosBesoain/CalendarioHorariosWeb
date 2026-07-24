import { ORDEN_HORARIOS } from '../constants/horarios.js';

export function normalizarHora(hora) {
  if (!hora) return hora;
  const [h, m] = hora.split(':');
  return `${parseInt(h)}:${m}`;
}

export function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function calcularHorariosDestino(especialidadesSemestres, horarioSolicitado) {
  const horarios = new Set();

  if (horarioSolicitado && ORDEN_HORARIOS.includes(horarioSolicitado)) {
    horarios.add(horarioSolicitado);
  }

  let parsed = especialidadesSemestres;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }

  const items = [];
  if (Array.isArray(parsed)) {
    parsed.forEach((item) => {
      if (item && typeof item === 'object') {
        items.push({ nombre: item.nombre, semestre: item.semestre });
      }
    });
  } else if (parsed && typeof parsed === 'object') {
    Object.entries(parsed).forEach(([nombre, val]) => {
      if (Array.isArray(val)) {
        val.forEach((semestre) => items.push({ nombre, semestre }));
      } else {
        items.push({ nombre, semestre: val });
      }
    });
  }

  items.forEach((item) => {
    const nombre = normalizarTexto(item.nombre);
    const semestre = Number(String(item.semestre ?? '').replace(/[^0-9]/g, ''));

    if (nombre === 'PLAN COMUN' || nombre === 'PLAN_COMUN') {
      horarios.add('plan_comun');
    }

    if (!Number.isNaN(semestre)) {
      if (semestre <= 4) horarios.add('plan_comun');
      if (semestre >= 5 && semestre <= 6) horarios.add('5to_6to');
      if (semestre >= 7 && semestre <= 8) horarios.add('7mo_8vo');
      if (semestre >= 9) horarios.add('9no_10_11');
    }
  });

  const ordenados = ORDEN_HORARIOS.filter((h) => horarios.has(h));
  return ordenados.length > 0 ? ordenados : ['plan_comun'];
}

export function limpiarNumeroSemestre(semestre) {
  if (semestre === null || semestre === undefined) return null;
  if (typeof semestre === 'number') return Math.floor(semestre);
  const num = parseInt(String(semestre).replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? null : num;
}
