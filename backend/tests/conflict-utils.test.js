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

    expect(pares).toContainEqual({ especialidad: 'ICI', semestre: 5 });
    expect(pares).toContainEqual({ especialidad: 'PLAN COMUN', semestre: 2 });
    expect(pares).toContainEqual({ especialidad: 'PLAN COMUN', semestre: 3 });
  });

  it('lee el formato array y normaliza "5to"', () => {
    const pares = extraerParesEspecialidadSemestre([
      { nombre: 'ice', semestre: '5to' },
    ]);

    expect(pares).toEqual([{ especialidad: 'ICE', semestre: 5 }]);
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
    expect(resultado.paresComunes).toContainEqual({ especialidad: 'ICE', semestre: 5 });
  });

  it('Plan Común no choca con carreras distintas', () => {
    const resultado = conflictosDeSemestre(
      { 'PLAN COMUN': 4 },
      { ICI: 4 }
    );

    expect(resultado.hayConflicto).toBe(false);
  });

  it('Plan Común choca con Plan Común', () => {
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
});
