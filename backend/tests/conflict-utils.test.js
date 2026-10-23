import { describe, it, expect } from 'vitest';
import {
  extraerParesEspecialidadSemestre,
  conflictosDeSemestre,
} from '../src/services/conflict-utils.js';

describe('extraerParesEspecialidadSemestre', () => {
  it('lee el formato objeto con valores escalares y arrays', () => {
    const pares = extraerParesEspecialidadSemestre({
      ICI: 5,
      'PLAN COMUN': [2, 3],
    });

    expect(pares).toContainEqual({ especialidad: 'ICI', semestre: '5' });
    expect(pares).toContainEqual({ especialidad: 'PLAN COMUN', semestre: '2' });
    expect(pares).toContainEqual({ especialidad: 'PLAN COMUN', semestre: '3' });
  });

  it('lee el formato array', () => {
    const pares = extraerParesEspecialidadSemestre([
      { nombre: 'ice', semestre: '5' },
    ]);

    expect(pares).toEqual([{ especialidad: 'ICE', semestre: '5' }]);
  });

  it('conserva la mención del semestre', () => {
    const pares = extraerParesEspecialidadSemestre({
      ICI: '10a',
      IOC: '10analytics',
    });

    expect(pares).toContainEqual({ especialidad: 'ICI', semestre: '10A' });
    expect(pares).toContainEqual({ especialidad: 'IOC', semestre: '10ANALYTICS' });
  });

  it('devuelve vacio para datos invalidos', () => {
    expect(extraerParesEspecialidadSemestre(null)).toEqual([]);
    expect(extraerParesEspecialidadSemestre('no-json')).toEqual([]);
  });
});

describe('conflictosDeSemestre', () => {
  it('no marca carreras distintas en el mismo semestre', () => {
    const resultado = conflictosDeSemestre({ ICE: 5 }, { ICQ: 5 });
    expect(resultado.hayConflicto).toBe(false);
  });

  it('marca carreras compartidas', () => {
    const resultado = conflictosDeSemestre(
      { ICE: 5 },
      { ICE: 5, ICQ: 5 }
    );

    expect(resultado.hayConflicto).toBe(true);
    expect(resultado.paresComunes).toContainEqual({ especialidad: 'ICE', semestre: '5' });
  });

  it('plan comun no choca con carreras distintas', () => {
    const resultado = conflictosDeSemestre(
      { 'PLAN COMUN': 4 },
      { ICI: 4 }
    );

    expect(resultado.hayConflicto).toBe(false);
  });

  it('plan comun choca con plan comun', () => {
    const resultado = conflictosDeSemestre(
      { 'PLAN COMUN': 4 },
      { 'PLAN COMUN': 4 }
    );

    expect(resultado.hayConflicto).toBe(true);
  });

  it('no marca cursos del mismo semestre pero distinto nivel de carrera', () => {
    expect(conflictosDeSemestre({ ICE: 5 }, { ICE: 6 }).hayConflicto).toBe(false);
  });

  it('no marca cursos sin especialidades', () => {
    expect(conflictosDeSemestre(null, { ICI: 5 }).hayConflicto).toBe(false);
  });

  it('mantiene el choque comun vs comun', () => {
    expect(conflictosDeSemestre({ ICI: 10 }, { ICI: 10 }).hayConflicto).toBe(true);
  });

  it('distingue menciones distintas del mismo semestre', () => {
    expect(conflictosDeSemestre({ ICI: '10a' }, { ICI: '10b' }).hayConflicto).toBe(false);
    expect(conflictosDeSemestre({ ICI: '10analytics' }, { ICI: '10b' }).hayConflicto).toBe(false);
  });

  it('el curso comun choca con una mencion de su carrera', () => {
    expect(conflictosDeSemestre({ ICI: '10' }, { ICI: '10a' }).hayConflicto).toBe(true);
    expect(conflictosDeSemestre({ ICI: '10a' }, { ICI: '10' }).hayConflicto).toBe(true);
    expect(conflictosDeSemestre({ ICI: '10' }, { ICI: '10analytics' }).hayConflicto).toBe(true);
  });

  it('la misma mencion choca sin importar mayusculas', () => {
    expect(conflictosDeSemestre({ ICI: '10a' }, { ICI: '10A' }).hayConflicto).toBe(true);
    expect(conflictosDeSemestre({ ICI: '10a' }, { ICI: '10a' }).hayConflicto).toBe(true);
  });

  it('no choca con una mencion de otra carrera', () => {
    expect(conflictosDeSemestre({ ICI: '10a' }, { IOC: '10a' }).hayConflicto).toBe(false);
  });
});
