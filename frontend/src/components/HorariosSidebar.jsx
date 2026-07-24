import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getPostitStyle } from '../utils/colorUtils';
import '../styles/HorariosSidebar.css';

export function HorariosSidebar({ 
  horarios = [], 
  filterFn = () => true, 
  getHorasUsadas = () => 0, 
  getGrupoUsos = () => 0, 
  tipoHorario = null,
  filtroEspecialidad = 'TODOS',
  filtroSemestre = [],
  onFiltroEspecialidadChange = () => {},
  onFiltroSemestreChange = () => {},
  onSidebarDragStart = () => {},
  onSidebarDragEnd = () => {}
}) {
  const [columns, setColumns] = useState({
    CLASE: [],
    AYUDANTIA: [],
    'LAB/TALLER': [],
  });
  const [ayudantiasSeparadas, setAyudantiasSeparadas] = useState(new Set());

  const horariosMapRef = useRef(new Map());

  // Agrupar ayudantías por código
  const agruparAyudantias = useCallback((items) => {
    const grupos = {};
    items.forEach(h => {
      if (!grupos[h.codigo]) grupos[h.codigo] = [];
      grupos[h.codigo].push(h);
    });
    const resultado = [];
    Object.entries(grupos).forEach(([codigo, secciones]) => {
      if (ayudantiasSeparadas.has(codigo) || secciones.length === 1) {
        secciones.forEach(s => resultado.push(s));
      } else {
        resultado.push({
          id: `grupo_${codigo}`,
          ids: secciones.map(s => String(s.id)),
          codigo,
          seccion: secciones.map(s => s.seccion).join(','),
          titulo: secciones[0].titulo || 'Sin título',
          tipo_hora: secciones[0].tipo_hora,
          cantidad_horas: secciones[0].cantidad_horas || 0,
          especialidades_semestres: secciones[0].especialidades_semestres,
          disponibilidad: secciones[0].disponibilidad,
          distribucion_horario: secciones[0].distribucion_horario,
          _esGrupo: true,
          _secciones: secciones.map(s => s.seccion),
        });
      }
    });
    return resultado;
  }, [ayudantiasSeparadas]);

  useEffect(() => {
    const map = new Map();
    horarios.forEach((h) => map.set(String(h.id), h));
    horariosMapRef.current = map;

    const grouped = { CLASE: [], AYUDANTIA: [], 'LAB/TALLER': [] };
    const filtrados = horarios.filter(filterFn);
    filtrados.forEach((h) => {
      const tipo = (h.tipo_hora || '').toUpperCase();
      if (tipo.includes('CLASE')) grouped.CLASE.push(h);
      else if (tipo.includes('AYUD')) grouped.AYUDANTIA.push(h);
      else grouped['LAB/TALLER'].push(h);
    });

    grouped.AYUDANTIA = agruparAyudantias(grouped.AYUDANTIA);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumns(grouped);
  }, [horarios, filterFn, agruparAyudantias]);

  const dragDataRef = useRef(null);

  function onDragStart(e, ids, from) {
    const idArray = Array.isArray(ids) ? ids : [String(ids)];
    dragDataRef.current = { ids: idArray, from };
    const payload = { ids: idArray, from, _esGrupo: idArray.length > 1 };
    try {
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
    } catch {
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    }
    e.dataTransfer.effectAllowed = 'move';

    const firstProg = horariosMapRef.current.get(idArray[0]);
    if (firstProg && firstProg.disponibilidad && Object.keys(firstProg.disponibilidad).length > 0) {
      onSidebarDragStart(firstProg.disponibilidad);
    }
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function moveItem(ids, from, to, beforeId = null) {
    setColumns((prev) => {
      const next = {
        CLASE: [...prev.CLASE],
        AYUDANTIA: [...prev.AYUDANTIA],
        'LAB/TALLER': [...prev['LAB/TALLER']],
      };

      const strIds = ids.map(String);
      const items = [];
      strIds.forEach(id => {
        const idx = next[from].findIndex((x) => String(x.id) === String(id));
        if (idx >= 0) items.push(next[from].splice(idx, 1)[0]);
      });

      strIds.forEach(id => {
        const item = horariosMapRef.current.get(String(id));
        if (item && !items.find(x => String(x.id) === String(id))) items.push(item);
      });

      if (items.length === 0) return prev;

      if (beforeId) {
        const insertIdx = next[to].findIndex((x) => String(x.id) === String(beforeId));
        if (insertIdx === -1) next[to].push(...items);
        else {
          next[to].splice(insertIdx, 0, ...items);
        }
      } else {
        next[to].push(...items);
      }

      return next;
    });
  }

  function onDropToColumn(e, to) {
    e.preventDefault();
    const data = dragDataRef.current;
    if (!data) return;
    moveItem(data.ids, data.from, to, null);
    dragDataRef.current = null;
  }

  function onDropOnItem(e, to, beforeId) {
    e.preventDefault();
    const data = dragDataRef.current;
    if (!data) return;
    moveItem(data.ids, data.from, to, beforeId);
    dragDataRef.current = null;
  }

  function resetCols() {
    setColumns((prev) => ({ CLASE: [...prev.CLASE], AYUDANTIA: [...prev.AYUDANTIA], 'LAB/TALLER': [...prev['LAB/TALLER']] }));
  }

  const renderPostit = (h, col) => {
    const isGrupo = h._esGrupo;
    const ids = isGrupo ? h.ids : [String(h.id)];
    const horasUsadas = isGrupo
      ? getGrupoUsos(h.ids)
      : getHorasUsadas(h.id);
    const isFull = horasUsadas >= h.cantidad_horas;
    const distribucion = h.distribucion_horario != null ? String(h.distribucion_horario).trim() : '';
    const colorStyle = getPostitStyle(h.especialidades_semestres, false, tipoHorario);

    return (
      <div
        key={h.id}
        className={`postit ${isFull ? 'postit-full' : ''} ${isGrupo ? 'postit-grupo' : ''}`}
        draggable={!isFull}
        onDragStart={(e) => {
          if (isFull) { e.preventDefault(); return; }
          onDragStart(e, ids, col);
        }}
        onDragEnd={onSidebarDragEnd}
        onDragOver={onDragOver}
        onDrop={(e) => onDropOnItem(e, col, h.id)}
        style={{ 
          opacity: isFull ? 0.5 : 1, 
          cursor: isFull ? 'not-allowed' : 'grab',
          ...(isFull ? {} : colorStyle)
        }}
      >
        <div className="postit-title">
          {h.codigo}
          {isGrupo && <span className="postit-seccion-badge">Secciones {h._secciones.join(',')}</span>}
          {!isGrupo && <span>-{h.seccion}</span>}
        </div>
        <div className="postit-subtitle">{h.titulo}</div>
        <div className="postit-body">{h.tipo_hora}{distribucion ? ` • ${distribucion}` : ''}</div>
        {!isFull && (h.tipo_hora || '').toUpperCase() !== 'LAB/TALLER' && (
          <div className="postit-disponibilidad">
            {h.disponibilidad && typeof h.disponibilidad === 'object' && Object.keys(h.disponibilidad).length > 0
              ? Object.entries(h.disponibilidad).map(([dia, bloques]) => (
                  <span key={dia} className="disp-badge" title={`${dia}: ${bloques.join(', ')}`}>
                    {dia.slice(0, 3)} {bloques.length}
                  </span>
                ))
              : <span className="disp-badge disp-none">Sin disponibilidad</span>
            }
          </div>
        )}
        <div className="postit-footer">
          <span className="postit-hours">{horasUsadas}/{h.cantidad_horas}h</span>
          {isFull && <span className="postit-badge">⚠️ Lleno</span>}
        </div>
        {isGrupo && (
          <button
            className="postit-separar-btn"
            onClick={(e) => {
              e.stopPropagation();
              setAyudantiasSeparadas(prev => new Set([...prev, h.codigo]));
            }}
            title="Separar secciones individualmente"
          >
            Separar
          </button>
        )}
        {ayudantiasSeparadas.has(h.codigo) && (
          <button
            className="postit-unir-btn"
            onClick={(e) => {
              e.stopPropagation();
              setAyudantiasSeparadas(prev => {
                const next = new Set(prev);
                next.delete(h.codigo);
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
          <div className="semestre-checkboxes" id="filtro-semestre">
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
