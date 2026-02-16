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
  const [warnings, setWarnings] = useState([]);
  const [conflictingPostits, setConflictingPostits] = useState(new Set());

  // Función para marcar conflictos basados en los datos cargados de la BD
  const marcarConflictosDelBD = (itemsAValidar) => {
    try {
      const nuevasAdvertencias = [];
      const nuevosConflicting = new Set();

      // Por cada semestre
      Object.keys(itemsAValidar).forEach(semestreId => {
        const horasDelSemestre = itemsAValidar[semestreId];

        // Revisar cada hora para ver si tiene conflictos guardados
        horasDelSemestre.forEach(pi => {
          if (pi.conflictos && Array.isArray(pi.conflictos) && pi.conflictos.length > 0) {
            // Para cada conflicto guardado
            pi.conflictos.forEach(conflictId => {
              // Buscar el postit conflictivo en todas las semestres
              horasDelSemestre.forEach(pi2 => {
                if (pi2.id === conflictId) {
                  // Ambos postits tienen conflicto
                  nuevosConflicting.add(pi.instanceId);
                  nuevosConflicting.add(pi2.instanceId);
                  
                  // Crear mensaje de conflicto
                  const msg = `⚠️ Conflicto de horario: ${pi.titulo} Sección ${pi.seccion} está tocando con ${pi2.titulo} Sección ${pi2.seccion}.`;
                  if (!nuevasAdvertencias.includes(msg)) {
                    nuevasAdvertencias.push(msg);
                  }
                }
              });
            });
          }

          // Revisar si tiene horario protegido
          if (pi.hasProtectedScheduleWarning) {
            nuevosConflicting.add(pi.instanceId);
            const nombreTipoHorario = semestreId === 'plan_comun' ? 'Plan Común' : '5to y 6to';
            const msg = `🔒 Horario Protegido: ${pi.titulo} Sección ${pi.seccion} está programado en una franja protegida de ${nombreTipoHorario}.`;
            if (!nuevasAdvertencias.includes(msg)) {
              nuevasAdvertencias.push(msg);
            }
          }
        });
      });

      setWarnings(nuevasAdvertencias);
      setConflictingPostits(nuevosConflicting);
    } catch (err) {
      console.error('Error marcando conflictos de BD:', err);
    }
  };

  // Función para validar conflictos localmente (por bloque horario)
  const validarConflictosLocal = (itemsAValidar) => {
    try {
      const nuevasAdvertencias = [];
      const nuevosConflicting = new Set();

      // Por cada semestre
      Object.keys(itemsAValidar).forEach(semestreId => {
        const horasDelSemestre = itemsAValidar[semestreId];

        // Agrupar por bloque horario (día + bloqueIndex)
        const bloques = {};
        horasDelSemestre.forEach(pi => {
          const blocKey = `${pi.dia}-${pi.bloqueIndex}`;
          if (!bloques[blocKey]) {
            bloques[blocKey] = [];
          }
          bloques[blocKey].push(pi);
        });

        // Revisar conflictos dentro de cada bloque horario
        Object.values(bloques).forEach(horasEnBloque => {
          for (let i = 0; i < horasEnBloque.length; i++) {
            for (let j = i + 1; j < horasEnBloque.length; j++) {
              const pi1 = horasEnBloque[i];
              const pi2 = horasEnBloque[j];

              // Saltar si mismo código (mismo curso, diferente sección)
              if (pi1.codigo === pi2.codigo) continue;

              // Obtener especialidades de ambos programables
              const prog1 = horariosProgramables.find(p => p.id === pi1.hora_programable_id);
              const prog2 = horariosProgramables.find(p => p.id === pi2.hora_programable_id);

              if (!prog1 || !prog2) continue;

              // Extraer semestres de especialidades
              let esp1 = prog1.especialidades_semestres;
              let esp2 = prog2.especialidades_semestres;

              if (typeof esp1 === 'string') {
                try {
                  esp1 = JSON.parse(esp1);
                } catch (e) {
                  esp1 = {};
                }
              }
              if (typeof esp2 === 'string') {
                try {
                  esp2 = JSON.parse(esp2);
                } catch (e) {
                  esp2 = {};
                }
              }

              const semestres1 = Array.isArray(esp1) ? esp1.map(e => e.semestre || e).filter(s => s) : Object.values(esp1).filter(s => s);
              const semestres2 = Array.isArray(esp2) ? esp2.map(e => e.semestre || e).filter(s => s) : Object.values(esp2).filter(s => s);

              // Buscar semestres en común
              const semestresComunes = semestres1.filter(s => semestres2.includes(s));

              if (semestresComunes.length > 0) {
                const warning = `⚠️ Conflicto de horario: ${pi1.titulo} Sección ${pi1.seccion} está tocando con ${pi2.titulo} Sección ${pi2.seccion} en el semestre ${semestresComunes.join(', ')}.`;
                nuevasAdvertencias.push(warning);
                nuevosConflicting.add(pi1.instanceId);
                nuevosConflicting.add(pi2.instanceId);
              }
            }
          }
        });
      });

      // Remover duplicados
      const advertenciasUnicas = [...new Set(nuevasAdvertencias)];
      setWarnings(advertenciasUnicas);
      setConflictingPostits(nuevosConflicting);
    } catch (err) {
      console.error('Error validando conflictos locales:', err);
    }
  };

  // Función para actualizar advertencias basado en el estado actual de placedItems
  const actualizarAdvertencias = (itemsActualizados = placedItems) => {
    validarConflictosLocal(itemsActualizados);
  };

  // Cargar horas registradas al iniciar
  useEffect(() => {
    if (dashboardId) {
      cargarHorasRegistradas();
    }
  }, [dashboardId]);

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
      
      // Marcar postits conflictivos basado en los datos cargados
      marcarConflictosDelBD(grouped);
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
                      .then(({ horaRegistrada, warnings: serverWarnings }) => {
                        const instanceId = `${prog.id}-${horaRegistrada.id}`;
                        const newPlacedItems = {
                          ...placedItems,
                          [semestre.id]: [
                            ...(placedItems[semestre.id] || []),
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
                              bloqueIndex: index,
                              conflictos: [] // Los conflictos se guardan en la BD
                            }
                          ]
                        };

                        setPlacedItems(newPlacedItems);

                        // Mostrar advertencias del servidor y recalcular conflictos
                        if (serverWarnings && serverWarnings.length > 0) {
                          setWarnings(serverWarnings);
                          // Revalidar con los nuevos datos del servidor
                          actualizarAdvertencias(newPlacedItems);
                        }
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
                          className={`placed-postit ${conflictingPostits.has(pi.instanceId) ? 'conflicting' : ''}`}
                          draggable
                          title={conflictingPostits.has(pi.instanceId) ? warnings[0] || 'Aviso de conflicto de horario' : ''}
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
