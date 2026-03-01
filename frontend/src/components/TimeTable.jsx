import { useState, useEffect } from 'react';
import { HORARIOS } from '../constants/horarios';
import { horasRegistradasService } from '../services/api';
import { getPostitStyle, getTipoHorario } from '../utils/colorUtils';
import '../styles/TimeTable.css';
import HorariosSidebar from './HorariosSidebar';

export function TimeTable({ 
  dashboardId, 
  horasRegistradas = [], 
  horariosProgramables = [],
  filtroEspecialidad = 'TODOS',
  filtroSemestre = 'TODOS',
  onFiltroEspecialidadChange = () => {},
  onFiltroSemestreChange = () => {},
  filtrarHorario = () => true
}) {
  const [modoVisualizacion, setModoVisualizacion] = useState('cascada');
  const [semestreActual, setSemestreActual] = useState(0);
  // placedItems: { [semestreId]: [ { id (BD), instanceId, hora_programable_id, codigo, seccion, titulo, tipo_hora, cantidad_horas, dia, bloqueIndex } ] }
  const [placedItems, setPlacedItems] = useState({});
  const [cargando, setCargando] = useState(false);
  const [warningsMap, setWarningsMap] = useState({});  // { instanceId: [msg1, msg2, ...] }
  const [conflictingPostits, setConflictingPostits] = useState(new Set());

  // Mapa de bloques: inicio -> rango completo
  const BLOQUES_MAP = {
    "8:30": "8:30-9:20", "9:30": "9:30-10:20", "10:30": "10:30-11:20",
    "11:30": "11:30-12:20", "12:30": "12:30-13:20", "13:30": "13:30-14:20",
    "14:30": "14:30-15:20", "15:30": "15:30-16:20", "16:30": "16:30-17:20",
    "17:30": "17:30-18:20", "18:30": "18:30-19:20", "19:30": "19:30-20:20"
  };

  // Normalizar hora: "09:30" -> "9:30"
  const normalizarHora = (h) => {
    if (!h) return h;
    const [hh, mm] = h.split(':');
    return `${parseInt(hh)}:${mm}`;
  };

  /**
   * NUEVA función simplificada que lee conflictos desde la BD
   * Los conflictos se calculan en el backend de forma centralizada
   */
  const evaluarConflictosDesBD = (itemsAValidar) => {
    try {
      const advertenciasPorPostit = {};
      const nuevosConflicting = new Set();

      // Recopilar TODOS los items de TODOS los semestres
      const todosLosItems = [];
      Object.keys(itemsAValidar).forEach(semestreId => {
        (itemsAValidar[semestreId] || []).forEach(pi => {
          todosLosItems.push({ ...pi, semestreId });
        });
      });

      // Helper: agregar advertencia a un post-it específico
      const addWarning = (instanceId, msg) => {
        if (!advertenciasPorPostit[instanceId]) advertenciasPorPostit[instanceId] = [];
        if (!advertenciasPorPostit[instanceId].includes(msg)) advertenciasPorPostit[instanceId].push(msg);
      };

      // Procesar cada item y evaluar sus conflictos desde el campo 'conflictos' de la BD
      todosLosItems.forEach(pi => {
        // 1. Conflictos de BD (calculados por el backend)
        if (pi.conflictos && Array.isArray(pi.conflictos) && pi.conflictos.length > 0) {
          nuevosConflicting.add(pi.instanceId);
          
          // Buscar los items en conflicto para mostrar detalles
          pi.conflictos.forEach(conflictId => {
            const itemEnConflicto = todosLosItems.find(item => item.id === conflictId);
            if (itemEnConflicto) {
              addWarning(pi.instanceId, `⚠️ Conflicto con ${itemEnConflicto.titulo} Sec ${itemEnConflicto.seccion}`);
            } else {
              addWarning(pi.instanceId, `⚠️ Conflicto detectado`);
            }
          });
        }

        // 2. Horario protegido (evaluación local simple)
        if (pi.hasProtectedScheduleWarning) {
          nuevosConflicting.add(pi.instanceId);
          const nombreTipo = pi.semestreId === 'plan_comun' ? 'Plan Común' : '5to y 6to';
          addWarning(pi.instanceId, `🔒 Horario protegido de ${nombreTipo}`);
        }
      });

      setWarningsMap(advertenciasPorPostit);
      setConflictingPostits(nuevosConflicting);
    } catch (err) {
      console.error('Error evaluando conflictos:', err);
    }
  };

  // Cargar horas registradas al iniciar
  useEffect(() => {
    if (dashboardId) {
      cargarHorasRegistradas();
    }
  }, [dashboardId]);

  // Re-evaluar conflictos cuando llegan los horariosProgramables (recarga de página)
  useEffect(() => {
    if (horariosProgramables.length > 0 && Object.keys(placedItems).length > 0) {
      evaluarConflictosDesBD(placedItems);
    }
  }, [horariosProgramables]);

  // Función para determinar si un horario es protegido
  const esHorarioProtegido = (dia, horaInicio, semestreId) => {
    // Solo aplica para plan_comun y 5to_6to
    if (!['plan_comun', '5to_6to'].includes(semestreId)) {
      return false;
    }

    // Horarios protegidos por día
    const horariosProtegidos = {
      'Martes': ['17:30', '18:30'],
      'Miércoles': ['17:30', '18:30'],
      'Viernes': ['10:30', '11:30', '12:30']
    };

    const horasProhibidas = horariosProtegidos[dia] || [];
    return horasProhibidas.includes(horaInicio);
  };

  const cargarHorasRegistradas = async () => {
    try {
      setCargando(true);
      const { horasRegistradas: hrs } = await horasRegistradasService.obtenerPorDashboard(dashboardId);
      
      // Función para normalizar tiempo: "09:30" -> "9:30" (remover leading zeros)
      const normalizarTiempo = (tiempoStr) => {
        const [horas, minutos] = tiempoStr.substring(0, 5).split(':');
        return `${parseInt(horas)}:${minutos}`;
      };
      
      // Convertir horas registradas a placedItems
      const grouped = {};
      hrs.forEach(hr => {
        // Usar el campo horario de la BD si existe, si no, usar determinación por especialidades
        const semestreId = hr.horario || determinarSemestrePorEspecialidades(hr.hora_programable_id);
        
        if (!grouped[semestreId]) {
          grouped[semestreId] = [];
        }

        // Normalizar hora_inicio (PostgreSQL devuelve HH:MM:SS, necesitamos 9:30 sin leading zero)
        const horaInicio = normalizarTiempo(hr.hora_inicio);
        
        // Encontrar el bloque index basado en hora_inicio normalizada
        const bloqueIndex = HORARIOS.bloques.findIndex(b => b.inicio === horaInicio);

        grouped[semestreId].push({
          id: hr.id, // ID de la BD
          instanceId: `${hr.hora_programable_id}-${hr.id}`, // Usar ID de BD + prog ID
          hora_programable_id: hr.hora_programable_id,
          codigo: hr.codigo,
          seccion: hr.seccion,
          titulo: hr.titulo,
          tipo_hora: hr.tipo_hora,
          dia: hr.dia_semana,
          bloqueIndex: bloqueIndex >= 0 ? bloqueIndex : 0,
          conflictos: hr.conflictos || [], // Cargar conflictos desde la BD
          hasProtectedScheduleWarning: esHorarioProtegido(hr.dia_semana, horaInicio, semestreId) // Detectar horario protegido
        });
      });

      setPlacedItems(grouped);
      
      // Evaluar conflictos desde la BD
      evaluarConflictosDesBD(grouped);
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
  // Ahora también aplica los filtros de usuario (especialidad/semestre)
  function filterForSemester(semestreId) {
    return (h) => {
      // Primero aplicar el filtro de usuario
      if (!filtrarHorario(h)) return false;
      
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
                          // Recargar desde el servidor para reflejar cambios en conflictos
                          cargarHorasRegistradas();
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
                      .then(() => {
                        // Recargar desde el servidor para reflejar conflictos correctamente
                        cargarHorasRegistradas();
                      })
                      .catch(err => console.error('Error creando hora registrada:', err));
                  }}
                >
                  <div className="cell-content">
                    {(placedItems[semestre.id] || [])
                      .filter(pi => {
                        // Filtrar por día y bloque
                        if (pi.dia !== dia || pi.bloqueIndex !== index) return false;
                        
                        // Aplicar filtro de usuario
                        const prog = horariosProgramables.find(p => p.id === pi.hora_programable_id);
                        if (!prog) return true; // Si no encontramos el programable, mostrar igual
                        
                        return filtrarHorario(prog);
                      })
                      .map(pi => {
                        // Obtener el programable para conocer las especialidades_semestres
                        const prog = horariosProgramables.find(p => p.id === pi.hora_programable_id);
                        const tieneConflicto = conflictingPostits.has(pi.instanceId);
                        const colorStyle = prog 
                          ? getPostitStyle(prog.especialidades_semestres, tieneConflicto, getTipoHorario(semestre.id))
                          : {};
                        
                        return (
                        <div
                          key={pi.instanceId}
                          className={`placed-postit ${tieneConflicto ? 'conflicting' : ''}`}
                          draggable
                          title={warningsMap[pi.instanceId] ? warningsMap[pi.instanceId].join('\n') : ''}
                          style={colorStyle}
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
                                      // Recargar desde el servidor para reflejar cambios en conflictos
                                      cargarHorasRegistradas();
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
                      );
                    })}
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
          tipoHorario={getTipoHorario(semestre.id)}
          filtroEspecialidad={filtroEspecialidad}
          filtroSemestre={filtroSemestre}
          onFiltroEspecialidadChange={onFiltroEspecialidadChange}
          onFiltroSemestreChange={onFiltroSemestreChange}
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
                tipoHorario={getTipoHorario(HORARIOS.semestres[semestreActual].id)}
                filtroEspecialidad={filtroEspecialidad}
                filtroSemestre={filtroSemestre}
                onFiltroEspecialidadChange={onFiltroEspecialidadChange}
                onFiltroSemestreChange={onFiltroSemestreChange}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
