import { useState, useEffect } from 'react';
import { HORARIOS } from '../constants/horarios';
import { horasRegistradasService } from '../services/api';
import '../styles/TimeTable.css';
import HorariosSidebar from './HorariosSidebar';

export function TimeTable({ dashboardId, horasRegistradas = [], horariosProgramables = [] }) {
  const [modoVisualizacion, setModoVisualizacion] = useState('cascada');
  const [semestreActual, setSemestreActual] = useState(0);
  // placedItems: { [semestreId]: [ { id (BD), instanceId, hora_programable_id, codigo, seccion, titulo, tipo_hora, cantidad_horas, dia, bloqueIndex } ] }
  const [placedItems, setPlacedItems] = useState({});
  const [cargando, setCargando] = useState(false);

  // Cargar horas registradas al iniciar
  useEffect(() => {
    if (dashboardId) {
      cargarHorasRegistradas();
    }
  }, [dashboardId]);

  const cargarHorasRegistradas = async () => {
    try {
      setCargando(true);
      const { horasRegistradas: hrs } = await horasRegistradasService.obtenerPorDashboard(dashboardId);
      
      // Convertir horas registradas a placedItems
      const grouped = {};
      hrs.forEach(hr => {
        // Mapear día de la semana a semestre - esto es una aproximación
        // En una versión mejorada, deberíamos guardar el semestreId en la BD
        const semestreId = determinarSemestrePorEspecialidades(hr.hora_programable_id);
        
        if (!grouped[semestreId]) {
          grouped[semestreId] = [];
        }

        // Encontrar el bloque index basado en hora_inicio
        const bloqueIndex = HORARIOS.bloques.findIndex(b => b.inicio === hr.hora_inicio);

        grouped[semestreId].push({
          id: hr.id, // ID de la BD
          instanceId: `${hr.hora_programable_id}-${hr.id}`, // Usar ID de BD + prog ID
          hora_programable_id: hr.hora_programable_id,
          codigo: hr.codigo,
          seccion: hr.seccion,
          titulo: hr.titulo,
          tipo_hora: hr.tipo_hora,
          dia: hr.dia_semana,
          bloqueIndex: bloqueIndex >= 0 ? bloqueIndex : 0
        });
      });

      setPlacedItems(grouped);
    } catch (err) {
      console.error('Error cargando horas registradas:', err);
    } finally {
      setCargando(false);
    }
  };

  // Determinar el semestre basado en especialidades del programable
  const determinarSemestrePorEspecialidades = (horaProgId) => {
    const prog = horariosProgramables.find(h => h.id === horaProgId);
    if (!prog) return 'plan_comun';

    let esp = prog.especialidades_semestres;
    if (typeof esp === 'string') {
      try { esp = JSON.parse(esp); } catch (err) { }
    }

    if (Array.isArray(esp)) {
      // Si tiene semestres altos, asignar a ese grupo
      if (esp.some(e => [9, 10, 11].includes(Number(e.semestre)))) return '9no_10_11';
      if (esp.some(e => [7, 8].includes(Number(e.semestre)))) return '7mo_8vo';
      if (esp.some(e => [5, 6].includes(Number(e.semestre)))) return '5to_6to';
      return 'plan_comun';
    }

    return 'plan_comun';
  };

  // Calcular horas usadas de un programable en TODOS los semestres
  const getHorasUsadas = (horaProgId) => {
    let total = 0;
    Object.values(placedItems).forEach(semItems => {
      total += semItems.filter(pi => pi.hora_programable_id === horaProgId).length;
    });
    return total;
  };

  // Verificar si se puede agregar más instancias de un programable
  const puedeAgregar = (horaProgId, cantidadHoras) => {
    return getHorasUsadas(horaProgId) < cantidadHoras;
  };

  // Filtrar programables para un semestre particular
  function filterForSemester(semestreId) {
    return (h) => {
      if (!h || !h.especialidades_semestres) return false;
      let esp = h.especialidades_semestres;
      if (typeof esp === 'string') {
        try { esp = JSON.parse(esp); } catch (err) { }
      }

      if (Array.isArray(esp)) {
        if (semestreId === 'plan_comun') {
          return esp.some(e => 
            e.nombre === 'Plan Común' || 
            (e.nombre && e.nombre.toLowerCase && e.nombre.toLowerCase() === 'plan común')
          );
        }
        const targets = {
          '5to_6to': [5, 6],
          '7mo_8vo': [7, 8],
          '9no_10_11': [9, 10, 11]
        }[semestreId];
        if (!targets) return false;
        return esp.some(e => targets.includes(Number(e.semestre)));
      }

      if (typeof esp === 'object') {
        if (semestreId === 'plan_comun') {
          return Object.prototype.hasOwnProperty.call(esp, 'Plan Común') && esp['Plan Común'];
        }
        const targets = {
          '5to_6to': [5, 6],
          '7mo_8vo': [7, 8],
          '9no_10_11': [9, 10, 11]
        }[semestreId];
        if (!targets) return false;
        return Object.values(esp).some(v => targets.includes(Number(v)));
      }

      return false;
    };
  }

  const renderHorario = (semestre) => (
    <div key={semestre.id} className="timetable-view">
      <h3 className="timetable-title" style={{ borderBottomColor: semestre.color }}>
        {semestre.nombre}
      </h3>

      <div className="timetable">
        <div className="timetable-header">
          <div className="time-column"></div>
          {HORARIOS.dias.map((dia) => (
            <div key={dia} className="day-header">
              {dia}
            </div>
          ))}
        </div>

        <div className="timetable-body">
          {HORARIOS.bloques.map((bloque, index) => (
            <div
              key={index}
              className="time-row"
              style={{ backgroundColor: bloque.colorFila }}
            >
              <div className="time-label" style={{ backgroundColor: bloque.colorFila }}>
                {bloque.tipo === 'almuerzo' ? '🍽️' : ''} {bloque.inicio} - {bloque.fin}
              </div>

              {HORARIOS.dias.map((dia) => (
                <div
                  key={`${dia}-${bloque.inicio}`}
                  className="cell"
                  style={{
                    backgroundColor: bloque.colorFila,
                    borderBottomColor: bloque.tipo === 'almuerzo' ? '#b39ddb' : '#ddd'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    let data = null;
                    try { data = e.dataTransfer.getData('application/json'); } catch (err) { }
                    if (!data) data = e.dataTransfer.getData('text/plain');
                    if (!data) return;
                    try { data = JSON.parse(data); } catch (err) { }
                    
                    // Si es un placed item (movimiento dentro del horario)
                    if (data && data.type === 'placed') {
                      // Reorganizar el item a la nueva posición
                      const { id: horaRegId, instanceId, semestreId } = data;
                      if (semestreId !== semestre.id) return; // No permitir mover entre semestres
                      
                      // Actualizar en la BD
                      horasRegistradasService.actualizar(horaRegId, dia, index)
                        .then(() => {
                          setPlacedItems(prev => {
                            const current = prev[semestre.id] || [];
                            return {
                              ...prev,
                              [semestre.id]: current.map(pi =>
                                pi.instanceId === instanceId
                                  ? { ...pi, dia, bloqueIndex: index }
                                  : pi
                              )
                            };
                          });
                        })
                        .catch(err => console.error('Error actualizando hora:', err));
                      return;
                    }
                    
                    // Si es un programa nuevo desde la sidebar
                    const id = data && data.id ? data.id : data;
                    if (!id) return;
                    
                    const prog = horariosProgramables.find(h => String(h.id) === String(id));
                    if (!prog) return;

                    // Verificar si puede agregar más
                    if (!puedeAgregar(prog.id, prog.cantidad_horas)) return;

                    // Guardar en la BD
                    horasRegistradasService.crear(prog.id, dashboardId, dia, index, semestre.id)
                      .then(({ horaRegistrada }) => {
                        const instanceId = `${prog.id}-${horaRegistrada.id}`;
                        setPlacedItems(prev => {
                          const current = prev[semestre.id] || [];
                          return {
                            ...prev,
                            [semestre.id]: [
                              ...current,
                              {
                                id: horaRegistrada.id,
                                instanceId,
                                hora_programable_id: prog.id,
                                codigo: prog.codigo,
                                seccion: prog.seccion,
                                titulo: prog.titulo,
                                tipo_hora: prog.tipo_hora,
                                cantidad_horas: prog.cantidad_horas,
                                dia,
                                bloqueIndex: index
                              }
                            ]
                          };
                        });
                      })
                      .catch(err => console.error('Error creando hora registrada:', err));
                  }}
                >
                  <div className="cell-content">
                    {(placedItems[semestre.id] || [])
                      .filter(pi => pi.dia === dia && pi.bloqueIndex === index)
                      .map(pi => (
                        <div
                          key={pi.instanceId}
                          className="placed-postit"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('application/json', JSON.stringify({
                              type: 'placed',
                              instanceId: pi.instanceId,
                              semestreId: semestre.id,
                              ...pi
                            }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="postit-content">
                            <div className="postit-header">
                              <strong>{pi.codigo}-{pi.seccion}</strong>
                              <button
                                className="remove-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Eliminar de la BD
                                  horasRegistradasService.eliminar(pi.id)
                                    .then(() => {
                                      setPlacedItems(prev => ({
                                        ...prev,
                                        [semestre.id]: (prev[semestre.id] || []).filter(x => x.instanceId !== pi.instanceId)
                                      }));
                                    })
                                    .catch(err => console.error('Error eliminando hora:', err));
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="postit-title-small">{pi.titulo || '-'}</div>
                            <div className="postit-type">{pi.tipo_hora}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderHorarioWithSidebar = (semestre) => (
    <div key={semestre.id} className="timetable-with-sidebar">
      {renderHorario(semestre)}
      <div className="sidebar-container">
        <HorariosSidebar
          horarios={horariosProgramables}
          filterFn={filterForSemester(semestre.id)}
          getHorasUsadas={getHorasUsadas}
          puedeAgregar={puedeAgregar}
        />
      </div>
    </div>
  );

  return (
    <div className="timetable-container">
      <div className="timetable-controls">
        <div className="view-mode-selector">
          <button
            className={`mode-btn ${modoVisualizacion === 'cascada' ? 'active' : ''}`}
            onClick={() => setModoVisualizacion('cascada')}
          >
            📋 Cascada
          </button>
          <button
            className={`mode-btn ${modoVisualizacion === 'paginado' ? 'active' : ''}`}
            onClick={() => setModoVisualizacion('paginado')}
          >
            📄 Paginado
          </button>
        </div>

        {modoVisualizacion === 'paginado' && (
          <div className="semester-selector">
            {HORARIOS.semestres.map((semestre, index) => (
              <button
                key={semestre.id}
                className={`semester-btn ${semestreActual === index ? 'active' : ''}`}
                onClick={() => setSemestreActual(index)}
                style={{
                  borderBottomColor: semestre.color,
                  color: semestreActual === index ? semestre.color : '#999'
                }}
              >
                {semestre.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {modoVisualizacion === 'cascada' ? (
        <div className="timetable-cascade">
          {HORARIOS.semestres.map((semestre) => renderHorarioWithSidebar(semestre))}
        </div>
      ) : (
        <div className="timetable-paginated">
          <div className="timetable-with-sidebar">
            {renderHorario(HORARIOS.semestres[semestreActual])}
            <div className="sidebar-container">
              <HorariosSidebar
                horarios={horariosProgramables}
                filterFn={filterForSemester(HORARIOS.semestres[semestreActual].id)}
                getHorasUsadas={getHorasUsadas}
                puedeAgregar={puedeAgregar}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
