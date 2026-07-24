import { DIAS_NUMERO, HORARIOS_PROTEGIDOS } from '../../constants/horarios.js';

export default {
  nombre: 'horario_protegido',

  validar({ horario, dia, horaInicio }) {
    try {
      const tiposAplicables = ['plan_comun', '5to_6to', '7mo_8vo'];
      if (!tiposAplicables.includes(horario)) {
        return { isValid: true };
      }

      if (!DIAS_NUMERO[dia] || !HORARIOS_PROTEGIDOS[dia]) {
        return { isValid: true };
      }

      const horasProhibidas = HORARIOS_PROTEGIDOS[dia];

      if (horasProhibidas.includes(horaInicio)) {
        const nombreTipoHorario = horario === 'plan_comun' ? 'Plan Común'
          : horario === '5to_6to' ? '5to y 6to' : '7mo y 8vo';
        return {
          isValid: true,
          warning: `🔒 Horario Protegido: Esta programación se encuentra en una franja protegida de ${nombreTipoHorario}. ${dia} a las ${horaInicio}.`,
        };
      }

      return { isValid: true };
    } catch (err) {
      console.error('Error en HorarioProtegidoValidator:', err);
      return { isValid: true };
    }
  },
};
