import { ValidationEngine } from './ValidationEngine.js';
import { estrategiasPredeterminadas } from './strategies/index.js';

const engine = new ValidationEngine(estrategiasPredeterminadas);

export async function ejecutarValidaciones(horaProgramableId, dashboardId, horario, dia, horaInicio) {
  return engine.ejecutar({ horaProgramableId, dashboardId, horario, dia, horaInicio });
}

export { estrategiasPredeterminadas };
export { ValidationEngine };
