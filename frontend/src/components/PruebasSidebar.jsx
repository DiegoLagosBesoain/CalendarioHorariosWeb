import React, { useEffect, useState, useRef } from 'react';
import { getPostitStyle } from '../utils/colorUtils';
import '../styles/PruebasSidebar.css';

export function PruebasSidebar({ 
  pruebas = [], 
  onDragStartPrueba = () => {},
  dashboardId
}) {
  const [columns, setColumns] = useState({
    CLASE: [],
    AYUDANTIA: [],
    'LAB/TALLER': [],
    EXAMEN: [],
    TARDE: []
  });

  const pruebasMapRef = useRef(new Map());

  useEffect(() => {
    // build map and initial grouping
    const map = new Map();
    pruebas.forEach((p) => map.set(String(p.id), p));
    pruebasMapRef.current = map;

    const grouped = { 
      CLASE: [], 
      AYUDANTIA: [], 
      'LAB/TALLER': [],
      EXAMEN: [],
      TARDE: []
    };
    
    pruebas.forEach((p) => {
      const tipo = (p.tipo_prueba || '').toUpperCase();
      if (grouped[tipo]) {
        grouped[tipo].push(p);
      }
    });

    setColumns(grouped);
  }, [pruebas]);

  // Drag state
  const dragDataRef = useRef(null);

  function onDragStart(e, id, from) {
    dragDataRef.current = { id: String(id), from, source: 'sidebar' };
    
    // Obtener la prueba del mapa
    const prueba = pruebasMapRef.current.get(String(id));
    
    // Notificar al padre que se inició el drag
    onDragStartPrueba(prueba);
    
    try {
      e.dataTransfer.setData('application/json', JSON.stringify({ 
        id: String(id), 
        from, 
        source: 'sidebar',
        prueba 
      }));
    } catch (err) {
      e.dataTransfer.setData('text/plain', String(id));
    }
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function moveItem(id, from, to, beforeId = null) {
    setColumns((prev) => {
      const next = {
        CLASE: [...prev.CLASE],
        AYUDANTIA: [...prev.AYUDANTIA],
        'LAB/TALLER': [...prev['LAB/TALLER']],
        EXAMEN: [...prev.EXAMEN],
        TARDE: [...prev.TARDE]
      };

      const idx = next[from].findIndex((x) => String(x.id) === String(id));
      const item = idx >= 0 ? next[from].splice(idx, 1)[0] : pruebasMapRef.current.get(String(id));
      if (!item) return prev;

      if (beforeId) {
        const insertIdx = next[to].findIndex((x) => String(x.id) === String(beforeId));
        if (insertIdx === -1) next[to].push(item);
        else next[to].splice(insertIdx, 0, item);
      } else {
        next[to].push(item);
      }

      return next;
    });
  }

  function onDropToColumn(e, to) {
    e.preventDefault();
    const data = dragDataRef.current;
    if (!data || data.source !== 'sidebar') return;
    moveItem(data.id, data.from, to, null);
    dragDataRef.current = null;
  }

  function onDropOnItem(e, to, beforeId) {
    e.preventDefault();
    const data = dragDataRef.current;
    if (!data || data.source !== 'sidebar') return;
    moveItem(data.id, data.from, to, beforeId);
    dragDataRef.current = null;
  }

  function resetCols() {
    // Force re-run of grouping
    setColumns((prev) => ({ 
      CLASE: [...prev.CLASE], 
      AYUDANTIA: [...prev.AYUDANTIA], 
      'LAB/TALLER': [...prev['LAB/TALLER']],
      EXAMEN: [...prev.EXAMEN],
      TARDE: [...prev.TARDE]
    }));
  }

  const renderPostit = (p, col) => {
    // Obtener el estilo de color basado en especialidades y semestres
    const colorStyle = getPostitStyle(p.especialidades_semestres, false);
    
    return (
      <div
        key={p.id}
        className="prueba-postit"
        draggable={true}
        onDragStart={(e) => onDragStart(e, p.id, col)}
        onDragOver={onDragOver}
        onDrop={(e) => onDropOnItem(e, col, p.id)}
        style={colorStyle}
      >
        <div className="prueba-postit-title">{p.codigo}-{p.seccion}</div>
        <div className="prueba-postit-subtitle">{p.titulo || 'Sin título'}</div>
        <div className="prueba-postit-body">{p.tipo_prueba}</div>
      </div>
    );
  };

  return (
    <aside className="pruebas-sidebar">
      <div className="sidebar-header">
        <h3>Pruebas Programables</h3>
        <button onClick={resetCols} className="small-btn">Reset</button>
      </div>

      <div className="pruebas-cols">
        <div className="prueba-col" onDragOver={onDragOver} onDrop={(e) => onDropToColumn(e, 'CLASE')}>
          <div className="prueba-col-title">Clase</div>
          <div className="prueba-col-list">
            {columns.CLASE.map((p) => renderPostit(p, 'CLASE'))}
          </div>
        </div>

        <div className="prueba-col" onDragOver={onDragOver} onDrop={(e) => onDropToColumn(e, 'AYUDANTIA')}>
          <div className="prueba-col-title">Ayudantía</div>
          <div className="prueba-col-list">
            {columns.AYUDANTIA.map((p) => renderPostit(p, 'AYUDANTIA'))}
          </div>
        </div>

        <div className="prueba-col" onDragOver={onDragOver} onDrop={(e) => onDropToColumn(e, 'LAB/TALLER')}>
          <div className="prueba-col-title">Lab/Taller</div>
          <div className="prueba-col-list">
            {columns['LAB/TALLER'].map((p) => renderPostit(p, 'LAB/TALLER'))}
          </div>
        </div>

        <div className="prueba-col" onDragOver={onDragOver} onDrop={(e) => onDropToColumn(e, 'EXAMEN')}>
          <div className="prueba-col-title">Examen</div>
          <div className="prueba-col-list">
            {columns.EXAMEN.map((p) => renderPostit(p, 'EXAMEN'))}
          </div>
        </div>

        <div className="prueba-col" onDragOver={onDragOver} onDrop={(e) => onDropToColumn(e, 'TARDE')}>
          <div className="prueba-col-title">Tarde</div>
          <div className="prueba-col-list">
            {columns.TARDE.map((p) => renderPostit(p, 'TARDE'))}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default PruebasSidebar;
