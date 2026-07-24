class UndoManager {
  constructor(maxSize = 50) {
    this.stack = [];
    this.maxSize = maxSize;
  }

  async execute(command) {
    await command.execute();
    this.stack.push(command);
    if (this.stack.length > this.maxSize) this.stack.shift();
  }

  async undo() {
    if (this.stack.length === 0) return;
    const command = this.stack.pop();
    await command.undo();
  }

  get canUndo() {
    return this.stack.length > 0;
  }

  clear() {
    this.stack = [];
  }
}

export default UndoManager;
