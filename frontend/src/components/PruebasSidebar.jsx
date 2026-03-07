import React, { useEffect, useState, useRef } from 'react';
import { getPostitStyle } from '../utils/colorUtils';
import '../styles/PruebasSidebar.css';

export function PruebasSidebar({ 
  pruebas = [], 
  pruebasRegistradas = [],
  filterFn = () => true,
  onDragStartPrueba = () => {},
  dashboardId,
  filtroEspecialidad = 'TODOS',
  filtroSemestre = 'TODOS',
  onFiltroEspecialidadChange = () => {},
  onFiltroSemestreChange = () => {}
}) {
  const [columns, setColumns] = useState({
    CLASE: [],
    AYUDANTIA: [],
    'LAB/TALLER': [],
    EXAMEN: [],
    TARDE: []
  });

  // Track selected block index per prueba id
  const [selectedBlocks, setSelectedBlocks] = useState({});

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
    
    pruebas.filter(filterFn).forEach((p) => {
      const tipo = (p.tipo_prueba || '').toUpperCase();
      // Filtrar EXAMEN si tiene_examen es false
      if (tipo === 'EXAMEN' && p.tiene_examen === false) {
        return;
      }
      if (grouped[tipo]) {
        grouped[tipo].push(p);
      }
    });

    setColumns(grouped);
  }, [pruebas, filterFn]);

  // Drag state
  const dragDataRef = useRef(null);

  function onDragStart(e, id, from) {
    dragDataRef.current = { id: String(id), from, source: 'sidebar' };
    
    // Obtener la prueba del mapa
    const prueba = pruebasMapRef.current.get(String(id));
    
    // Obtener el bloque seleccionado para esta prueba
    const bloques = parseBloques(prueba?.bloques_horario);
    const selectedIdx = selectedBlocks[String(id)] || 0;
    const selectedBlock = bloques.length > 0 ? bloques[selectedIdx] : null;
    
    // Notificar al padre que se inició el drag
    onDragStartPrueba(prueba);
    
    try {
      e.dataTransfer.setData('application/json', JSON.stringify({ 
        id: String(id), 
        from, 
        source: 'sidebar',
        prueba,
        horaInicio: selectedBlock?.inicio || null,
        horaFin: selectedBlock?.fin || null,
        bloqueDia: selectedBlock?.dia || null
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

  // Parse bloques_horario safely
  const parseBloques = (bloquesRaw) => {
    if (!bloquesRaw) return [];
    let bloques = bloquesRaw;
    if (typeof bloques === 'string') {
      try { bloques = JSON.parse(bloques); } catch (e) { return []; }
    }
    return Array.isArray(bloques) ? bloques : [];
  };

  // Contar pruebas registradas por curso (codigo+seccion), excluyendo EXAMEN
  const getEvalCount = (codigo, seccion) => {
    return pruebasRegistradas.filter(pr => {
      const tipo = (pr.tipo_prueba || '').toUpperCase();
      return pr.codigo === codigo && String(pr.seccion) === String(seccion) && tipo !== 'EXAMEN';
    }).length;
  };

  // Verificar si un curso ya tiene su examen registrado
  const hasExamenRegistrado = (codigo, seccion) => {
    return pruebasRegistradas.some(pr => {
      const tipo = (pr.tipo_prueba || '').toUpperCase();
      return pr.codigo === codigo && String(pr.seccion) === String(seccion) && tipo === 'EXAMEN';
    });
  };

  // Buscar cantidad_evaluaciones del curso desde cualquier prueba hermana (mismo codigo+seccion)
  const getCantidadEvaluaciones = (codigo, seccion) => {
    const match = pruebas.find(p => 
      p.codigo === codigo && 
      String(p.seccion) === String(seccion) && 
      p.cantidad_evaluaciones != null
    );
    return match ? match.cantidad_evaluaciones : null;
  };

  // Format a block for display in dropdown
  const formatBloque = (bloque) => {
    if (bloque.dia) {
      return `${bloque.dia} ${bloque.inicio}-${bloque.fin}`;
    }
    return `${bloque.inicio}-${bloque.fin}`;
  };

  const renderPostit = (p, col) => {
    // Obtener el estilo de color basado en especialidades y semestres
    const colorStyle = getPostitStyle(p.especialidades_semestres, false);
    const bloques = parseBloques(p.bloques_horario);
    const selectedIdx = selectedBlocks[String(p.id)] || 0;

    const tipoPrueba = (p.tipo_prueba || '').toUpperCase();
    const evalCount = getEvalCount(p.codigo, p.seccion);
    // Buscar cantidad_evaluaciones en la propia prueba o en hermanas del mismo curso
    const maxEval = p.cantidad_evaluaciones != null ? p.cantidad_evaluaciones : getCantidadEvaluaciones(p.codigo, p.seccion);
    const isExamen = tipoPrueba === 'EXAMEN';
    const examenYaRegistrado = isExamen && hasExamenRegistrado(p.codigo, p.seccion);
    const limitReached = !isExamen && maxEval != null && evalCount >= maxEval;
    
    return (
      <div
        key={p.id}
        className={`prueba-postit ${limitReached || examenYaRegistrado ? 'limit-reached' : ''}`}
        draggable={!limitReached && !examenYaRegistrado}
        onDragStart={(e) => {
          if (limitReached || examenYaRegistrado) { e.preventDefault(); return; }
          onDragStart(e, p.id, col);
        }}
        onDragOver={onDragOver}
        onDrop={(e) => onDropOnItem(e, col, p.id)}
        style={colorStyle}
        title={limitReached ? `Límite alcanzado (${evalCount}/${maxEval})` : examenYaRegistrado ? 'Examen ya registrado' : ''}
      >
        <div className="prueba-postit-title">{p.codigo}-{p.seccion}</div>
        <div className="prueba-postit-subtitle">{p.titulo || 'Sin título'}</div>
        <div className="prueba-postit-body">{p.tipo_prueba}</div>
        {/* Contador de evaluaciones */}
        {maxEval != null && !isExamen && (
          <div className={`eval-counter ${limitReached ? 'full' : ''}`}>
            {evalCount}/{maxEval} eval.
          </div>
        )}
        {isExamen && (
          <div className={`eval-counter ${examenYaRegistrado ? 'full' : ''}`}>
            {examenYaRegistrado ? '1/1 examen' : '0/1 examen'}
          </div>
        )}
        {bloques.length > 0 && (
          <div className="prueba-postit-bloque">
            {bloques.length === 1 ? (
              <span className="bloque-unico">{formatBloque(bloques[0])}</span>
            ) : (
              <select
                className="bloque-select"
                value={selectedIdx}
                onChange={(e) => {
                  e.stopPropagation();
                  setSelectedBlocks(prev => ({
                    ...prev,
                    [String(p.id)]: parseInt(e.target.value)
                  }));
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {bloques.map((bloque, idx) => (
                  <option key={idx} value={idx}>
                    {formatBloque(bloque)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="pruebas-sidebar">
      <div className="sidebar-header">
        <h3>Pruebas Programables</h3>
        <button onClick={resetCols} className="small-btn">Reset</button>
      </div>

      <div className="filtros-section">
        <h4>Filtros</h4>
        
        <div className="filtro-group">
          <label htmlFor="filtro-especialidad-pruebas">Especialidad:</label>
          <select 
            id="filtro-especialidad-pruebas"
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
          <label htmlFor="filtro-semestre-pruebas">Semestre:</label>
          <select 
            id="filtro-semestre-pruebas"
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
