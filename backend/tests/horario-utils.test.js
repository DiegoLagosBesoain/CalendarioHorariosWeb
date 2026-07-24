import { describe, it, expect } from 'vitest';
import {
  normalizarHora,
  normalizarTexto,
  calcularHorariosDestino,
  limpiarNumeroSemestre,
} from '../src/utils/horario-utils.js';

describe('normalizarHora', () => {
  it('remueve leading zero de la hora', () => {
    expect(normalizarHora('09:30')).toBe('9:30');
  });
  it('mantiene hora sin leading zero', () => {
    expect(normalizarHora('8:30')).toBe('8:30');
  });
  it('retorna null/undefined sin cambios', () => {
    expect(normalizarHora(null)).toBeNull();
    expect(normalizarHora(undefined)).toBeUndefined();
  });
});

describe('normalizarTexto', () => {
  it('convierte a mayúsculas y quita acentos', () => {
    expect(normalizarTexto('Plan Común')).toBe('PLAN COMUN');
  });
  it('recorta espacios', () => {
    expect(normalizarTexto('  hola  ')).toBe('HOLA');
  });
  it('maneja null/vacio', () => {
    expect(normalizarTexto(null)).toBe('');
    expect(normalizarTexto('')).toBe('');
  });
});

describe('limpiarNumeroSemestre', () => {
  it('convierte string con numeros', () => {
    expect(limpiarNumeroSemestre('5to')).toBe(5);
    expect(limpiarNumeroSemestre('semestre 3')).toBe(3);
  });
  it('retorna null para valores invalidos', () => {
    expect(limpiarNumeroSemestre(null)).toBeNull();
    expect(limpiarNumeroSemestre(undefined)).toBeNull();
    expect(limpiarNumeroSemestre('abc')).toBeNull();
  });
  it('procesa numeros directamente', () => {
    expect(limpiarNumeroSemestre(7)).toBe(7);
    expect(limpiarNumeroSemestre(7.5)).toBe(7);
  });
});

describe('calcularHorariosDestino', () => {
  it('retorna plan_comun para semestre 1-4', () => {
    const obj = { EspecialidadA: 2 };
    expect(calcularHorariosDestino(obj)).toEqual(['plan_comun']);
  });
  it('retorna 5to_6to para semestre 5-6', () => {
    const obj = { EspecialidadA: 6 };
    expect(calcularHorariosDestino(obj)).toEqual(['5to_6to']);
  });
  it('retorna 7mo_8vo para semestre 7-8', () => {
    const obj = { EspecialidadA: 7 };
    expect(calcularHorariosDestino(obj)).toEqual(['7mo_8vo']);
  });
  it('retorna 9no_10_11 para semestre 9+', () => {
    const obj = { EspecialidadA: 10 };
    expect(calcularHorariosDestino(obj)).toEqual(['9no_10_11']);
  });
  it('incluye horarioSolicitado si es valido', () => {
    const obj = { EspecialidadA: 2 };
    expect(calcularHorariosDestino(obj, '5to_6to')).toEqual(['plan_comun', '5to_6to']);
  });
  it('ignora horarioSolicitado invalido', () => {
    const obj = { EspecialidadA: 2 };
    expect(calcularHorariosDestino(obj, 'invalido')).toEqual(['plan_comun']);
  });
  it('parsea especialidades_semestres como JSON string', () => {
    const json = JSON.stringify({ EspecialidadA: 5 });
    expect(calcularHorariosDestino(json)).toEqual(['5to_6to']);
  });
  it('retorna plan_comun como fallback si no hay datos', () => {
    expect(calcularHorariosDestino({})).toEqual(['plan_comun']);
  });
  it('procesa PLAN COMUN sin semestre', () => {
    const arr = [{ nombre: 'Plan Común' }];
    expect(calcularHorariosDestino(arr)).toEqual(['plan_comun']);
  });
  it('procesa array de objetos con nombre y semestre', () => {
    const arr = [{ nombre: 'EspecialidadA', semestre: 7 }];
    expect(calcularHorariosDestino(arr)).toEqual(['7mo_8vo']);
  });
});
