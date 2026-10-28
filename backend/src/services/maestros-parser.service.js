import { normalizarSemestreToken } from '../utils/horario-utils.js';

const ESPECIALIDADES_VALIDAS = ["PLAN COMUN", "PLAN_COMUN", "ICA", "ICQ", "ICI", "IOC", "ICE", "ICC"];

export function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function esMandante(v) {
  const s = normalizarTexto(v ?? '');
  return s === 'SI';
}

export function buscarColumna(curso, ...patrones) {
  for (const patron of patrones) {
    if (curso[patron] !== undefined) {
      return curso[patron];
    }
  }

  const normalizarClave = (valor) =>
    normalizarTexto(valor).replace(/[\s\n_]+/g, '');

  // Coincidencia normalizada exacta: ignora mayúsculas, tildes, espacios y
  // guiones bajos (ej. "CLASES A PROGRAMAR" encuentra "Clases A PROGRAMAR").
  for (const patron of patrones) {
    const patronNorm = normalizarClave(patron);
    for (const key of Object.keys(curso)) {
      if (normalizarClave(key) === patronNorm) {
        return curso[key];
      }
    }
  }

  // Coincidencia parcial con el primer patrón (compatibilidad)
  const patronNorm = normalizarClave(patrones[0]);
  for (const key of Object.keys(curso)) {
    const keyNorm = normalizarClave(key);
    if (keyNorm.includes(patronNorm) || patronNorm.includes(keyNorm)) {
      return curso[key];
    }
  }

  return undefined;
}

export function primerValorNoVacio(...valores) {
  for (const v of valores) {
    if (v != null && v !== '') return v;
  }
  return null;
}

const ALIAS_RUT_PROFESOR_LAB = [
  'RUT PROFESOR LABT',
  'RUT_PROFESOR_LABT',
  'RUT PROF LABT',
  'RUT LABT',
];

const ALIAS_NOMBRE_PROFESOR_LAB = [
  'NOMBRE PROFESOR LABT',
  'NOMBRE_PROFESOR_LABT',
  'PROFESOR LABT',
  'PROF LABT',
];

export function extraerProfesorLab(curso) {
  const rut = String(buscarColumna(curso, ...ALIAS_RUT_PROFESOR_LAB) ?? '').trim();
  if (!rut) return null;

  const nombre = String(buscarColumna(curso, ...ALIAS_NOMBRE_PROFESOR_LAB) ?? '').trim();
  return { rut, nombre: nombre || null };
}

export function elegirProfesoresHora(tipoHora, { prof1Id = null, prof2Id = null, profLabId = null } = {}) {
  if (tipoHora === 'LAB/TALLER' && profLabId != null) {
    return { profesor1Id: profLabId, profesor2Id: null };
  }

  return { profesor1Id: prof1Id ?? null, profesor2Id: prof2Id ?? null };
}

export function limpiarSala(v) {
  if (v == null) return null;
  const texto = String(v).trim();
  if (!texto) return null;
  // Errores de planilla u otros marcadores que no son salas reales
  if (/^(#N\/A|#REF!|#VALUE!|#DIV\/0!|N\/A|-|—)$/i.test(texto)) return null;
  return texto;
}

export function limpiarNumeroSemestre(semestre) {
  if (semestre == null) return null;
  if (typeof semestre === 'number') return Math.floor(semestre);
  const num = parseInt(String(semestre).replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? null : num;
}

export function extraerEspecialidades(curso) {
  const especialidades = {};

  for (const key of Object.keys(curso)) {
    const keyNorm = normalizarTexto(key).replace(/[\s\n]+/g, '');
    let especialidad = null;

    for (const valida of ESPECIALIDADES_VALIDAS) {
      const vNorm = valida.replace(/[\s\n]+/g, '');
      if (keyNorm.includes(vNorm) || vNorm.includes(keyNorm)) {
        especialidad = valida;
        break;
      }
    }

    if (especialidad) {
      const valor = curso[key];
      if (valor != null && String(valor).trim() !== '') {
        const semestre = normalizarSemestreToken(valor);
        if (semestre !== null && parseInt(semestre, 10) > 0) {
          especialidades[especialidad] = semestre;
        }
      }
    }
  }

  return especialidades;
}

const PREFIJO_HORARIO_DICTADO = /^(CLASE|CLAS|AYUDANTIA|AYUD|LABORATORIO|LAB|TALLER)\b/i;

export function extraerDisponibilidad(curso) {
  const disponibilidad = {};

  const dias = [
    { nombre: 'Lunes', colKey: 'BLOQUES_DIA_1', columna: 'LUNES' },
    { nombre: 'Martes', colKey: 'BLOQUES_DIA_2', columna: 'MARTES' },
    { nombre: 'Miércoles', colKey: 'BLOQUES_DIA_3', columna: 'MIERCOLES' },
    { nombre: 'Jueves', colKey: 'BLOQUES_DIA_4', columna: 'JUEVES' },
    { nombre: 'Viernes', colKey: 'BLOQUES_DIA_5', columna: 'VIERNES' },
  ];

  for (const { nombre, colKey, columna } of dias) {
    const valor = buscarColumna(curso, colKey, columna);

    if (valor == null || String(valor).trim() === '') {
      continue;
    }

    const bloques = String(valor)
      .split(',')
      .map(b => b.trim())
      .filter(b => b.length > 0 && !PREFIJO_HORARIO_DICTADO.test(b));

    if (bloques.length > 0) {
      disponibilidad[nombre] = bloques;
    }
  }

  return disponibilidad;
}
