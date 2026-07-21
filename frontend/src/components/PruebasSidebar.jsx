import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getPostitStyle } from '../utils/colorUtils';
import '../styles/PruebasSidebar.css';

export function PruebasSidebar({ 
  pruebas = [], 
  pruebasRegistradas = [],
  filterFn = () => true,
  onDragStartPrueba = () => {},
  filtroEspecialidad = 'TODOS',
  filtroSemestre = [],
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
  const [pruebasSeparadas, setPruebasSeparadas] = useState(new Set());
  const [selectedBlocks, setSelectedBlocks] = useState({});

  const pruebasMapRef = useRef(new Map());

  // Agrupar pruebas por codigo
  const agruparPruebas = useCallback((items) => {
    const grupos = {};
    items.forEach(p => {
      if (!grupos[p.codigo]) grupos[p.codigo] = [];
      grupos[p.codigo].push(p);
    });
    const resultado = [];
    Object.entries(grupos).forEach(([codigo, secciones]) => {
      if (pruebasSeparadas.has(codigo) || secciones.length === 1) {
        secciones.forEach(s => resultado.push(s));
      } else {
        resultado.push({
          id: `grupo_${codigo}`,
          ids: secciones.map(s => String(s.id)),
          codigo,
          seccion: secciones.map(s => s.seccion).join(','),
          titulo: secciones[0].titulo || 'Sin título',
          tipo_prueba: secciones[0].tipo_prueba,
          especialidades_semestres: secciones[0].especialidades_semestres,
          bloques_horario: secciones[0].bloques_horario,
          cantidad_evaluaciones: secciones[0].cantidad_evaluaciones,
          tiene_examen: secciones[0].tiene_examen,
          _esGrupo: true,
          _secciones: secciones.map(s => s.seccion),
        });
      }
    });
    return resultado;
  }, [pruebasSeparadas]);

  useEffect(() => {
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
      if (tipo === 'EXAMEN' && p.tiene_examen === false) return;
      if (grouped[tipo]) {
        grouped[tipo].push(p);
      }
    });

    Object.keys(grouped).forEach(tipo => {
      grouped[tipo] = agruparPruebas(grouped[tipo]);
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumns(grouped);
  }, [pruebas, filterFn, agruparPruebas]);

  const dragDataRef = useRef(null);

  function onDragStart(e, ids, from) {
    const idArray = Array.isArray(ids) ? ids : [String(ids)];
    const primeraId = idArray[0];
    dragDataRef.current = { ids: idArray, from, source: 'sidebar' };
    
    const prueba = pruebasMapRef.current.get(primeraId);
    
    const bloques = parseBloques(prueba?.bloques_horario);
    const selectedIdx = selectedBlocks[primeraId] || 0;
    const selectedBlock = bloques.length > 0 ? bloques[selectedIdx] : null;
    
    onDragStartPrueba(prueba);
    
    try {
      e.dataTransfer.setData('application/json', JSON.stringify({ 
        ids: idArray,
        from, 
        source: 'sidebar',
        prueba,
        horaInicio: selectedBlock?.inicio || null,
        horaFin: selectedBlock?.fin || null,
        bloqueDia: selectedBlock?.dia || null
      }));
    } catch {
      e.dataTransfer.setData('text/plain', JSON.stringify({ ids: idArray, from, source: 'sidebar' }));
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
    moveItem(data.ids, data.from, to, null);
    dragDataRef.current = null;
  }

  function onDropOnItem(e, to, beforeId) {
    e.preventDefault();
    const data = dragDataRef.current;
    if (!data || data.source !== 'sidebar') return;
    moveItem(data.ids, data.from, to, beforeId);
    dragDataRef.current = null;
  }

  function resetCols() {
    setColumns((prev) => ({ 
      CLASE: [...prev.CLASE], 
      AYUDANTIA: [...prev.AYUDANTIA], 
      'LAB/TALLER': [...prev['LAB/TALLER']],
      EXAMEN: [...prev.EXAMEN],
      TARDE: [...prev.TARDE]
    }));
  }

  const parseBloques = (bloquesRaw) => {
    if (!bloquesRaw) return [];
    let bloques = bloquesRaw;
    if (typeof bloques === 'string') {
      try { bloques = JSON.parse(bloques); } catch { return []; }
    }
    return Array.isArray(bloques) ? bloques : [];
  };

  const getEvalCount = (codigo, seccion) => {
    return pruebasRegistradas.filter(pr => {
      const tipo = (pr.tipo_prueba || '').toUpperCase();
      return pr.codigo === codigo && String(pr.seccion) === String(seccion) && tipo !== 'EXAMEN';
    }).length;
  };

  const hasExamenRegistrado = (codigo, seccion) => {
    return pruebasRegistradas.some(pr => {
      const tipo = (pr.tipo_prueba || '').toUpperCase();
      return pr.codigo === codigo && String(pr.seccion) === String(seccion) && tipo === 'EXAMEN';
    });
  };

  const getCantidadEvaluaciones = (codigo, seccion) => {
    const match = pruebas.find(p => 
      p.codigo === codigo && 
      String(p.seccion) === String(seccion) && 
      p.cantidad_evaluaciones != null
    );
    return match ? match.cantidad_evaluaciones : null;
  };

  const formatBloque = (bloque) => {
    if (bloque.dia) {
      return `${bloque.dia} ${bloque.inicio}-${bloque.fin}`;
    }
    return `${bloque.inicio}-${bloque.fin}`;
  };

  // Contar fechas donde TODAS las secciones de un grupo tienen registro
  const getGrupEvalCount = (grupo) => {
    const secciones = new Set(grupo._secciones);
    const fechas = {};
    pruebasRegistradas.forEach(pr => {
      const tipo = (pr.tipo_prueba || '').toUpperCase();
      if (pr.codigo !== grupo.codigo || tipo === 'EXAMEN') return;
      if (!secciones.has(pr.seccion)) return;
      if (!fechas[pr.fecha]) fechas[pr.fecha] = new Set();
      fechas[pr.fecha].add(pr.seccion);
    });
    return Object.values(fechas).filter(s => s.size >= secciones.size).length;
  };

  const renderPostit = (p, col) => {
    const isGrupo = p._esGrupo;
    const ids = isGrupo ? p.ids : [String(p.id)];
    const primeraId = ids[0];
    
    const colorStyle = getPostitStyle(p.especialidades_semestres, false);
    const bloques = parseBloques(p.bloques_horario);
    const selectedIdx = selectedBlocks[primeraId] || 0;

    const tipoPrueba = (p.tipo_prueba || '').toUpperCase();
    const evalCount = isGrupo
      ? getGrupEvalCount(p)
      : getEvalCount(p.codigo, p.seccion);
    const maxEval = isGrupo
      ? p.cantidad_evaluaciones
      : p.cantidad_evaluaciones != null ? p.cantidad_evaluaciones : getCantidadEvaluaciones(p.codigo, p.seccion);
    const isExamen = tipoPrueba === 'EXAMEN';
    const examenYaRegistrado = isExamen && (isGrupo
      ? p._secciones.some(sec => hasExamenRegistrado(p.codigo, sec))
      : hasExamenRegistrado(p.codigo, p.seccion));
    const limitReached = !isExamen && maxEval != null && evalCount >= maxEval;
    
    return (
      <div
        key={String(p.id)}
        className={`prueba-postit ${limitReached || examenYaRegistrado ? 'limit-reached' : ''} ${isGrupo ? 'prueba-postit-grupo' : ''}`}
        draggable={!limitReached && !examenYaRegistrado}
        onDragStart={(e) => {
          if (limitReached || examenYaRegistrado) { e.preventDefault(); return; }
          onDragStart(e, ids, col);
        }}
        onDragOver={onDragOver}
        onDrop={(e) => onDropOnItem(e, col, p.id)}
        style={colorStyle}
        title={limitReached ? `Límite alcanzado (${evalCount}/${maxEval})` : examenYaRegistrado ? 'Examen ya registrado' : ''}
      >
        <div className="prueba-postit-title">
          {p.codigo}
          {isGrupo && <span className="prueba-seccion-badge">Secciones {p._secciones.join(',')}</span>}
          {!isGrupo && <span>-{p.seccion}</span>}
        </div>
        <div className="prueba-postit-subtitle">{p.titulo}</div>
        <div className="prueba-postit-body">{p.tipo_prueba}</div>
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
        {bloques.length > 0 && !isGrupo && (
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
                    [primeraId]: parseInt(e.target.value)
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
        {isGrupo && (
          <button
            className="prueba-separar-btn"
            onClick={(e) => {
              e.stopPropagation();
              setPruebasSeparadas(prev => new Set([...prev, p.codigo]));
            }}
            title="Separar secciones individualmente"
          >
            Separar
          </button>
        )}
        {pruebasSeparadas.has(p.codigo) && (
          <button
            className="prueba-unir-btn"
            onClick={(e) => {
              e.stopPropagation();
              setPruebasSeparadas(prev => {
                const next = new Set(prev);
                next.delete(p.codigo);
                return next;
              });
            }}
            title="Volver a unir secciones"
          >
            Unir
          </button>
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
          <div className="semestre-checkboxes" id="filtro-semestre-pruebas">
            {[1,2,3,4,5,6,7,8,9,10,11].map(sem => (
              <label key={sem} className="semestre-checkbox-label">
                <input
                  type="checkbox"
                  checked={filtroSemestre.length === 0 || filtroSemestre.includes(String(sem))}
                  onChange={() => {
                    let nuevos;
                    if (filtroSemestre.length === 0) {
                      nuevos = [1,2,3,4,5,6,7,8,9,10,11].filter(s => s !== sem).map(String);
                    } else if (filtroSemestre.includes(String(sem))) {
                      nuevos = filtroSemestre.filter(s => s !== String(sem));
                    } else {
                      nuevos = [...filtroSemestre, String(sem)];
                    }
                    onFiltroSemestreChange(nuevos.length === 11 ? [] : nuevos);
                  }}
                />
                {sem}
              </label>
            ))}
          </div>
        </div>

        {(filtroEspecialidad !== 'TODOS' || filtroSemestre.length > 0) && (
          <button 
            className="limpiar-filtros-btn"
            onClick={() => {
              onFiltroEspecialidadChange('TODOS');
              onFiltroSemestreChange([]);
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
