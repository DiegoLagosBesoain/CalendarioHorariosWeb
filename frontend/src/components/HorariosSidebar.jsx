import React, { useEffect, useState, useRef } from 'react';
import { getPostitStyle } from '../utils/colorUtils';
import '../styles/HorariosSidebar.css';

export function HorariosSidebar({ 
  horarios = [], 
  filterFn = () => true, 
  getHorasUsadas = () => 0, 
  puedeAgregar = () => true, 
  tipoHorario = null,
  filtroEspecialidad = 'TODOS',
  filtroSemestre = 'TODOS',
  onFiltroEspecialidadChange = () => {},
  onFiltroSemestreChange = () => {}
}) {
  const [columns, setColumns] = useState({
    CLASE: [],
    AYUDANTIA: [],
    'LAB/TALLER': [],
  });

  const horariosMapRef = useRef(new Map());

  useEffect(() => {
    // build map and initial grouping
    const map = new Map();
    horarios.forEach((h) => map.set(String(h.id), h));
    horariosMapRef.current = map;

    const grouped = { CLASE: [], AYUDANTIA: [], 'LAB/TALLER': [] };
    horarios
      .filter(filterFn)
      .forEach((h) => {
        const tipo = (h.tipo_hora || '').toUpperCase();
        if (tipo.includes('CLASE')) grouped.CLASE.push(h);
        else if (tipo.includes('AYUD')) grouped.AYUDANTIA.push(h);
        else grouped['LAB/TALLER'].push(h);
      });

    setColumns(grouped);
  }, [horarios, filterFn]);

  // Drag state
  const dragDataRef = useRef(null);

  function onDragStart(e, id, from) {
    dragDataRef.current = { id: String(id), from };
    try {
      e.dataTransfer.setData('application/json', JSON.stringify({ id: String(id), from }));
    } catch (err) {
      // some browsers may restrict custom types
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
      };

      const idx = next[from].findIndex((x) => String(x.id) === String(id));
      const item = idx >= 0 ? next[from].splice(idx, 1)[0] : horariosMapRef.current.get(String(id));
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
    if (!data) return;
    moveItem(data.id, data.from, to, null);
    dragDataRef.current = null;
  }

  function onDropOnItem(e, to, beforeId) {
    e.preventDefault();
    const data = dragDataRef.current;
    if (!data) return;
    moveItem(data.id, data.from, to, beforeId);
    dragDataRef.current = null;
  }

  function resetCols() {
    // Force re-run of grouping by toggling horarios (rebuild from map)
    setColumns((prev) => ({ CLASE: [...prev.CLASE], AYUDANTIA: [...prev.AYUDANTIA], 'LAB/TALLER': [...prev['LAB/TALLER']] }));
  }

  const renderPostit = (h, col) => {
    const horasUsadas = getHorasUsadas(h.id);
    const canAdd = puedeAgregar(h.id, h.cantidad_horas);
    const isFull = horasUsadas >= h.cantidad_horas;
    const distribucion = h.distribucion_horario != null ? String(h.distribucion_horario).trim() : '';
    
    // Obtener el estilo de color basado en especialidades y semestres
    const colorStyle = getPostitStyle(h.especialidades_semestres, false, tipoHorario);

    return (
      <div
        key={h.id}
        className={`postit ${isFull ? 'postit-full' : ''}`}
        draggable={!isFull}
        onDragStart={(e) => {
          if (isFull) {
            e.preventDefault();
            return;
          }
          onDragStart(e, h.id, col);
        }}
        onDragOver={onDragOver}
        onDrop={(e) => onDropOnItem(e, col, h.id)}
        style={{ 
          opacity: isFull ? 0.5 : 1, 
          cursor: isFull ? 'not-allowed' : 'grab',
          ...(isFull ? {} : colorStyle)
        }}
      >
        <div className="postit-title">{h.codigo}-{h.seccion}</div>
        <div className="postit-subtitle">{h.titulo || 'Sin título'}</div>
        <div className="postit-body">{h.tipo_hora}{distribucion ? ` • ${distribucion}` : ''}</div>
        <div className="postit-footer">
          <span className="postit-hours">{horasUsadas}/{h.cantidad_horas}h</span>
          {isFull && <span className="postit-badge">⚠️ Lleno</span>}
        </div>
      </div>
    );
  };

  return (
    <aside className="horarios-sidebar">
      <div className="sidebar-header">
        <h3>Horas Programables</h3>
        <button onClick={resetCols} className="small-btn">Reset</button>
      </div>

      <div className="filtros-section">
        <h4>Filtros</h4>
        
        <div className="filtro-group">
          <label htmlFor="filtro-especialidad">Especialidad:</label>
          <select 
            id="filtro-especialidad"
            value={filtroEspecialidad} 
            onChange={(e) => onFiltroEspecialidadChange(e.target.value)}
            className="filtro-select"
          >
            <option value="TODOS">Todos</option>
            <option value="Plan Común">Plan Común</option>
            <option value="ICI">ICI</option>
            <option value="IOC">IOC</option>
            <option value="ICE">ICE</option>
            <option value="ICC">ICC</option>
            <option value="ICA">ICA</option>
            <option value="ICQ">ICQ</option>
          </select>
        </div>

        <div className="filtro-group">
          <label htmlFor="filtro-semestre">Semestre:</label>
          <select 
            id="filtro-semestre"
            value={filtroSemestre} 
            onChange={(e) => onFiltroSemestreChange(e.target.value)}
            className="filtro-select"
          >
            <option value="TODOS">Todos</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
            <option value="9">9</option>
            <option value="10">10</option>
            <option value="11">11</option>
          </select>
        </div>

        {(filtroEspecialidad !== 'TODOS' || filtroSemestre !== 'TODOS') && (
          <button 
            className="limpiar-filtros-btn"
            onClick={() => {
              onFiltroEspecialidadChange('TODOS');
              onFiltroSemestreChange('TODOS');
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="cols">
        <div className="col" onDragOver={onDragOver} onDrop={(e) => onDropToColumn(e, 'CLASE')}>
          <div className="col-title">Clases</div>
          <div className="col-list">
            {columns.CLASE.map((h) => renderPostit(h, 'CLASE'))}
          </div>
        </div>

        <div className="col" onDragOver={onDragOver} onDrop={(e) => onDropToColumn(e, 'AYUDANTIA')}>
          <div className="col-title">Ayudantías</div>
          <div className="col-list">
            {columns.AYUDANTIA.map((h) => renderPostit(h, 'AYUDANTIA'))}
          </div>
        </div>

        <div className="col" onDragOver={onDragOver} onDrop={(e) => onDropToColumn(e, 'LAB/TALLER')}>
          <div className="col-title">Lab / Taller</div>
          <div className="col-list">
            {columns['LAB/TALLER'].map((h) => renderPostit(h, 'LAB/TALLER'))}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default HorariosSidebar;
