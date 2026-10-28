import { describe, it, expect } from 'vitest';
import {
  extraerEspecialidades,
  extraerProfesorLab,
  elegirProfesoresHora,
} from '../src/services/maestros-parser.service.js';

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

describe('extraerProfesorLab', () => {
  it('lee el rut y nombre del profesor de laboratorio', () => {
    const profesor = extraerProfesorLab({
      'RUT PROFESOR LABT': 175166858,
      'PROFESOR LABT ': 'GARCIA/DE GRACIA FLORENCIO ENRIQUE',
    });

    expect(profesor).toEqual({
      rut: '175166858',
      nombre: 'GARCIA/DE GRACIA FLORENCIO ENRIQUE',
    });
  });

  it('acepta alias con guion bajo', () => {
    const profesor = extraerProfesorLab({
      RUT_PROFESOR_LABT: '196382658',
      NOMBRE_PROFESOR_LABT: 'SOTO/MOREIRA MACARENA',
    });

    expect(profesor).toEqual({
      rut: '196382658',
      nombre: 'SOTO/MOREIRA MACARENA',
    });
  });

  it('devuelve null si no viene el rut de laboratorio', () => {
    expect(extraerProfesorLab({
      'RUT PROFESOR LABT': '',
      'PROFESOR LABT ': 'GARCIA/DE GRACIA FLORENCIO ENRIQUE',
    })).toBeNull();
    expect(extraerProfesorLab({})).toBeNull();
  });
});

describe('elegirProfesoresHora', () => {
  const profesores = { prof1Id: 10, prof2Id: 20, profLabId: 30 };

  it('usa solo al profesor de laboratorio en LAB/TALLER', () => {
    expect(elegirProfesoresHora('LAB/TALLER', profesores)).toEqual({
      profesor1Id: 30,
      profesor2Id: null,
    });
  });

  it('mantiene los profesores de clase si no hay profesor de laboratorio', () => {
    expect(elegirProfesoresHora('LAB/TALLER', { ...profesores, profLabId: null })).toEqual({
      profesor1Id: 10,
      profesor2Id: 20,
    });
  });

  it('usa los profesores de clase en CLASE y AYUDANTIA', () => {
    expect(elegirProfesoresHora('CLASE', profesores)).toEqual({
      profesor1Id: 10,
      profesor2Id: 20,
    });
    expect(elegirProfesoresHora('AYUDANTIA', profesores)).toEqual({
      profesor1Id: 10,
      profesor2Id: 20,
    });
  });
});
