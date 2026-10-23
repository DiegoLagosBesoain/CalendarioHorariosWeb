import { describe, it, expect } from 'vitest';
import { extraerEspecialidades } from '../src/services/maestros-parser.service.js';

describe('extraerEspecialidades', () => {
  it('conserva y normaliza la mencion del semestre', () => {
    const especialidades = extraerEspecialidades({
      'PLAN COMUN': '',
      ICI: '10a',
      IOC: 10,
      ICE: 'semestre 11',
      ICC: '10 analytics',
    });

    expect(especialidades).toEqual({
      ICI: '10A',
      IOC: '10',
      ICE: '11',
      ICC: '10ANALYTICS',
    });
  });

  it('omite semestres vacios o cero', () => {
    const especialidades = extraerEspecialidades({
      ICI: '',
      IOC: 0,
      ICE: null,
    });

    expect(especialidades).toEqual({});
  });
});
