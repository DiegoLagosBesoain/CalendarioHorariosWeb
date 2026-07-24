import { describe, it, expect } from 'vitest';
import {
  BLOQUES,
  BLOQUES_MAP,
  ORDEN_HORARIOS,
  DIAS,
  DIAS_NUMERO,
  DIAS_NUMERO_A_NOMBRE,
  HORARIOS_PROTEGIDOS,
} from '../src/constants/horarios.js';

describe('BLOQUES', () => {
  it('tiene 12 bloques', () => {
    expect(BLOQUES).toHaveLength(12);
  });
  it('cada bloque tiene inicio y fin', () => {
    BLOQUES.forEach(b => {
      expect(b).toHaveProperty('inicio');
      expect(b).toHaveProperty('fin');
    });
  });
  it('primer bloque es 8:30-9:20', () => {
    expect(BLOQUES[0]).toEqual({ inicio: '8:30', fin: '9:20' });
  });
});

describe('BLOQUES_MAP', () => {
  it('mapea 8:30 a 8:30-9:20', () => {
    expect(BLOQUES_MAP['8:30']).toBe('8:30-9:20');
  });
  it('tiene 12 entradas', () => {
    expect(Object.keys(BLOQUES_MAP)).toHaveLength(12);
  });
});

describe('ORDEN_HORARIOS', () => {
  it('tiene 4 horarios en orden correcto', () => {
    expect(ORDEN_HORARIOS).toEqual(['plan_comun', '5to_6to', '7mo_8vo', '9no_10_11']);
  });
});

describe('DIAS', () => {
  it('tiene 5 dias', () => {
    expect(DIAS).toHaveLength(5);
    expect(DIAS).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
  });
});

describe('DIAS_NUMERO', () => {
  it('mapea Lunes->1, Viernes->5', () => {
    expect(DIAS_NUMERO['Lunes']).toBe(1);
    expect(DIAS_NUMERO['Viernes']).toBe(5);
  });
});

describe('DIAS_NUMERO_A_NOMBRE', () => {
  it('mapea 1->Lunes, 5->Viernes', () => {
    expect(DIAS_NUMERO_A_NOMBRE[1]).toBe('Lunes');
    expect(DIAS_NUMERO_A_NOMBRE[5]).toBe('Viernes');
  });
});

describe('HORARIOS_PROTEGIDOS', () => {
  it('Martes tiene 17:30 y 18:30', () => {
    expect(HORARIOS_PROTEGIDOS['Martes']).toEqual(['17:30', '18:30']);
  });
  it('Viernes tiene 10:30, 11:30, 12:30', () => {
    expect(HORARIOS_PROTEGIDOS['Viernes']).toEqual(['10:30', '11:30', '12:30']);
  });
});
