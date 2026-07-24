class EliminarCommand {
  constructor(api, items) {
    this.api = api;
    this.items = items;
  }

  async execute() {
    for (const item of this.items) {
      await this.api.eliminar(item.id);
    }
  }

  async undo() {
    for (const item of this.items) {
      await this.api.crear(
        item.horaProgramableId,
        item.dashboardId,
        item.dia,
        item.bloqueIndex,
        item.semestreId,
        item.horario
      );
    }
  }
}

export default EliminarCommand;
