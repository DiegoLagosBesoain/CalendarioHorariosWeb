import UndoManager from './UndoManager';
import CrearCommand from './CrearCommand';
import MoverCommand from './MoverCommand';
import EliminarCommand from './EliminarCommand';

const undoManager = new UndoManager();

export { undoManager, CrearCommand, MoverCommand, EliminarCommand };
