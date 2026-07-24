export class ValidationEngine {
  constructor(estrategias) {
    this.estrategias = estrategias;
  }

  async ejecutar(contexto) {
    const warnings = [];
    const errors = [];
    const conflictIds = [];

    for (const estrategia of this.estrategias) {
      try {
        const resultado = await estrategia.validar(contexto);

        if (!resultado.isValid && resultado.warning) {
          warnings.push(resultado.warning);
        }
        if (resultado.conflictingHoraRegId) {
          conflictIds.push(resultado.conflictingHoraRegId);
        }
        if (resultado.error) {
          errors.push(resultado.error);
        }
        if (resultado.warning && resultado.isValid) {
          warnings.push(resultado.warning);
        }
      } catch (err) {
        console.error(`[ValidationEngine] Error en estrategia "${estrategia.nombre}":`, err);
      }
    }

    return {
      hasWarnings: warnings.length > 0,
      warnings,
      hasErrors: errors.length > 0,
      errors,
      isValid: errors.length === 0,
      conflictIds,
    };
  }
}
