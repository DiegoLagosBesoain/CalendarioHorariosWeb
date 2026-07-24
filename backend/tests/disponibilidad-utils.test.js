import { describe, it, expect } from 'vitest';
import { verificarBloqueEnDisponibilidad } from '../src/utils/disponibilidad-utils.js';

describe('verificarBloqueEnDisponibilidad', () => {
  it('retorna disponible true si el bloque esta en disponibilidad', () => {
    const disp = { Lunes: ['8:30-9:20'] };
    expect(verificarBloqueEnDisponibilidad(disp, 'Lunes', '8:30')).toEqual({ disponible: true });
  });

  it('retorna no disponible si el bloque no esta en disponibilidad', () => {
    const disp = { Lunes: ['10:30-11:20'] };
    expect(verificarBloqueEnDisponibilidad(disp, 'Lunes', '8:30')).toEqual({ disponible: false, razon: 'bloque_no_encontrado' });
  });

  it('retorna sin_disponibilidad si disponibilidad es null', () => {
    expect(verificarBloqueEnDisponibilidad(null, 'Lunes', '8:30')).toEqual({ disponible: false, razon: 'sin_disponibilidad' });
  });

  it('retorna sin_disponibilidad si disponibilidad es objeto vacio', () => {
    expect(verificarBloqueEnDisponibilidad({}, 'Lunes', '8:30')).toEqual({ disponible: false, razon: 'sin_disponibilidad' });
  });

  it('retorna sin_datos_dia si el dia no tiene datos', () => {
    const disp = { Lunes: ['8:30-9:20'] };
    expect(verificarBloqueEnDisponibilidad(disp, 'Martes', '8:30')).toEqual({ disponible: false, razon: 'sin_datos_dia' });
  });

  it('parsea string JSON', () => {
    const disp = JSON.stringify({ Lunes: ['8:30-9:20'] });
    expect(verificarBloqueEnDisponibilidad(disp, 'Lunes', '8:30')).toEqual({ disponible: true });
  });

  it('retorna disponible true para bloque desconocido', () => {
    const disp = { Lunes: ['8:30-9:20'] };
    expect(verificarBloqueEnDisponibilidad(disp, 'Lunes', '99:99')).toEqual({ disponible: true });
  });

  it('normaliza bloques con leading zero', () => {
    const disp = { Lunes: ['08:30-09:20'] };
    expect(verificarBloqueEnDisponibilidad(disp, 'Lunes', '8:30')).toEqual({ disponible: true });
  });

  it('normaliza horaInicio con leading zero', () => {
    const disp = { Lunes: ['8:30-9:20'] };
    expect(verificarBloqueEnDisponibilidad(disp, 'Lunes', '08:30')).toEqual({ disponible: true });
  });
});
