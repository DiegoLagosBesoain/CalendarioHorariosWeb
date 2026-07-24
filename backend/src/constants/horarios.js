export const BLOQUES = [
  { inicio: '8:30',  fin: '9:20' },
  { inicio: '9:30',  fin: '10:20' },
  { inicio: '10:30', fin: '11:20' },
  { inicio: '11:30', fin: '12:20' },
  { inicio: '12:30', fin: '13:20' },
  { inicio: '13:30', fin: '14:20' },
  { inicio: '14:30', fin: '15:20' },
  { inicio: '15:30', fin: '16:20' },
  { inicio: '16:30', fin: '17:20' },
  { inicio: '17:30', fin: '18:20' },
  { inicio: '18:30', fin: '19:20' },
  { inicio: '19:30', fin: '20:20' },
];

export const BLOQUES_MAP = Object.fromEntries(
  BLOQUES.map(b => [b.inicio, `${b.inicio}-${b.fin}`])
);

export const ORDEN_HORARIOS = ['plan_comun', '5to_6to', '7mo_8vo', '9no_10_11'];

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

export const DIAS_NUMERO = { Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5 };

export const DIAS_NUMERO_A_NOMBRE = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };

export const HORARIOS_PROTEGIDOS = {
  Martes:    ['17:30', '18:30'],
  Miércoles: ['17:30', '18:30'],
  Viernes:   ['10:30', '11:30', '12:30'],
};
