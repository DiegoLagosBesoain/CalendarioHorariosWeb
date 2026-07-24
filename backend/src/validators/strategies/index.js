import ToquesSemestreValidator from './ToquesSemestreValidator.js';
import HorarioProtegidoValidator from './HorarioProtegidoValidator.js';
import DisponibilidadProfesorValidator from './DisponibilidadProfesorValidator.js';
import DobleAsignacionProfesorValidator from './DobleAsignacionProfesorValidator.js';
import DobleAsignacionSalaValidator from './DobleAsignacionSalaValidator.js';

export const estrategiasPredeterminadas = [
  ToquesSemestreValidator,
  HorarioProtegidoValidator,
  DisponibilidadProfesorValidator,
  DobleAsignacionProfesorValidator,
  DobleAsignacionSalaValidator,
];
