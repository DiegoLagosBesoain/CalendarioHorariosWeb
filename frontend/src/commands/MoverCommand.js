class MoverCommand {
  constructor(api, horaRegId, oldDia, oldBloqueIndex, newDia, newBloqueIndex) {
    this.api = api;
    this.horaRegId = horaRegId;
    this.oldDia = oldDia;
    this.oldBloqueIndex = oldBloqueIndex;
    this.newDia = newDia;
    this.newBloqueIndex = newBloqueIndex;
  }

  async execute() {
    await this.api.actualizar(this.horaRegId, this.newDia, this.newBloqueIndex);
  }

  async undo() {
    try {
      await this.api.actualizar(this.horaRegId, this.oldDia, this.oldBloqueIndex);
    } catch (err) {
      if (err.message && err.message.includes('no encontrada')) return;
      throw err;
    }
  }
}

export default MoverCommand;
