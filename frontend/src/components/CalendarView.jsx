import { useState, useMemo } from 'react';
import { HORARIOS } from '../constants/horarios';
import { pruebasRegistradasService } from '../services/api';
import { getPostitStyle } from '../utils/colorUtils';
import { PruebasSidebar } from './PruebasSidebar';
import '../styles/CalendarView.css';

export function CalendarView({ 
  fechaInicio, 
  fechaFin, 
  horasRegistradas = [], 
  horariosProgramables = [],
  pruebasRegistradas = [],
  pruebasProgramables = [],
  dashboardId,
  onPruebasChanged = () => {},
  filtroEspecialidad = 'TODOS',
  filtroSemestre = 'TODOS',
  onFiltroEspecialidadChange = () => {},
  onFiltroSemestreChange = () => {},
  filtrarPrueba = () => true,
  feriados = [],
  onToggleFeriado = () => {}
}) {
  const [modoVisualizacion, setModoVisualizacion] = useState('cascada');
  const [semestreActual, setSemestreActual] = useState(0);

  // Si no hay fechas de rango, mostrar mensaje
  if (!fechaInicio || !fechaFin) {
    return (
      <div className="calendar-container">
        <div className="calendar-view">
          <div className="empty-calendar-message">
            <p>⚠️ Este dashboard no tiene un rango de fechas definido.</p>
            <p>Por favor edita el dashboard para establecer las fechas de inicio y fin.</p>
          </div>
        </div>
      </div>
    );
  }

  const fechaInicioDate = new Date(fechaInicio);
  const fechaFinDate = new Date(fechaFin);
  
  const [fechaActual, setFechaActual] = useState(new Date(fechaInicio));

  // Generar array de días del mes actual
  const diasDelMes = useMemo(() => {
    const year = fechaActual.getFullYear();
    const month = fechaActual.getMonth();
    const primerDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0);
    const diasEnMes = ultimoDia.getDate();
    const primerDiaDelMes = primerDia.getDay();
    const dias = [];
    for (let i = 0; i < primerDiaDelMes; i++) dias.push(null);
    for (let i = 1; i <= diasEnMes; i++) dias.push(new Date(year, month, i));
    return dias;
  }, [fechaActual]);

  // Obtener pruebas registradas para un día específico
  const getPruebasDelDia = (fecha) => {
    if (!fecha) return [];
    const fechaStr = fecha.toISOString().split('T')[0];
    return pruebasRegistradas.filter(p => {
      if (!p.fecha) return false;
      const pruebaFechaStr = new Date(p.fecha).toISOString().split('T')[0];
      return pruebaFechaStr === fechaStr;
    });
  };

  // Función helper para obtener el programable de una prueba
  const getPruebaProgramable = (pruebaProgId) => {
    return pruebasProgramables.find(pp => pp.id === pruebaProgId);
  };

  // Navegación mensual
  const puedeNavAnterior = () => {
    const anteriorMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1);
    return anteriorMes.getFullYear() > fechaInicioDate.getFullYear() || 
           (anteriorMes.getFullYear() === fechaInicioDate.getFullYear() && anteriorMes.getMonth() >= fechaInicioDate.getMonth());
  };

  const puedeNavSiguiente = () => {
    const siguienteMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1);
    return siguienteMes.getFullYear() < fechaFinDate.getFullYear() || 
           (siguienteMes.getFullYear() === fechaFinDate.getFullYear() && siguienteMes.getMonth() <= fechaFinDate.getMonth());
  };

  const puedeNavHoy = () => {
    const today = new Date();
    return today >= fechaInicioDate && today <= fechaFinDate;
  };

  const mesAnterior = () => {
    const nuevoMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1);
    if (nuevoMes.getFullYear() > fechaInicioDate.getFullYear() || 
        (nuevoMes.getFullYear() === fechaInicioDate.getFullYear() && nuevoMes.getMonth() >= fechaInicioDate.getMonth())) {
      setFechaActual(nuevoMes);
    }
  };

  const mesSiguiente = () => {
    const nuevoMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1);
    if (nuevoMes.getFullYear() < fechaFinDate.getFullYear() || 
        (nuevoMes.getFullYear() === fechaFinDate.getFullYear() && nuevoMes.getMonth() <= fechaFinDate.getMonth())) {
      setFechaActual(nuevoMes);
    }
  };

  const hoy = () => {
    const today = new Date();
    if (today >= fechaInicioDate && today <= fechaFinDate) {
      setFechaActual(today);
    }
  };

  const nombreMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  // ── Filtro por semestre (misma lógica que TimeTable) ──
  function filterForSemester(semestreId) {
    return (p) => {
      if (!filtrarPrueba(p)) return false;
      if (!p || !p.especialidades_semestres) return false;
      let esp = p.especialidades_semestres;
      if (typeof esp === 'string') {
        try { esp = JSON.parse(esp); } catch(err) { return false; }
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

  // ── Detección de día no coincidente (frontend) ──
  const getDayMismatchWarning = (prueba) => {
    const prog = getPruebaProgramable(prueba.prueba_programable_id);
    if (!prog) return null;
    const tipo = (prog.tipo_prueba || '').toUpperCase();
    if (!['CLASE', 'AYUDANTIA', 'LAB/TALLER'].includes(tipo)) return null;

    let bloques = prog.bloques_horario;
    if (!bloques) return null;
    if (typeof bloques === 'string') {
      try { bloques = JSON.parse(bloques); } catch(e) { return null; }
    }
    if (!Array.isArray(bloques) || bloques.length === 0) return null;

    const diasHorario = [...new Set(bloques.map(b => b.dia).filter(Boolean))];
    if (diasHorario.length === 0) return null;

    const diasSemanaFull = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const fechaPrueba = new Date(prueba.fecha);
    const diaPrueba = diasSemanaFull[fechaPrueba.getDay()];

    if (!diasHorario.includes(diaPrueba)) {
      return `📅 Día no coincide: ${tipo} es ${diasHorario.join('/')} pero prueba en ${diaPrueba}`;
    }
    return null;
  };

  // ── Helper de formato de tiempo ──
  const formatTime = (t) => {
    if (!t) return null;
    const s = typeof t === 'string' ? t.substring(0, 5) : t;
    const [h, m] = String(s).split(':');
    return `${parseInt(h)}:${m}`;
  };

  // ── Render del calendario para un semestre ──
  const renderCalendar = (semestre) => {
    const semestreFilter = filterForSemester(semestre.id);

    return (
      <div className="calendar-view">
        <h3 className="calendar-semester-title" style={{ borderBottomColor: semestre.color }}>
          {semestre.nombre}
        </h3>

        <div className="calendar-grid">
          <div className="weekdays">
            {diasSemana.map(dia => (
              <div key={dia} className="weekday">{dia}</div>
            ))}
          </div>

          <div className="days-grid">
            {diasDelMes.map((fecha, index) => {
              if (!fecha) {
                return <div key={`empty-${index}`} className="day empty"></div>;
              }

              const todasPruebasDelDia = getPruebasDelDia(fecha);
              // Filtrar pruebas para este semestre
              const pruebasDelDia = todasPruebasDelDia.filter(pr => {
                const prog = getPruebaProgramable(pr.prueba_programable_id);
                if (!prog) return false;
                return semestreFilter(prog);
              });

              const esHoy = (
                fecha.getDate() === new Date().getDate() &&
                fecha.getMonth() === new Date().getMonth() &&
                fecha.getFullYear() === new Date().getFullYear()
              );
              const estaEnRango = fecha >= fechaInicioDate && fecha <= fechaFinDate;
              const estaFueraDeRango = !estaEnRango;
              const fechaStr = fecha.toISOString().split('T')[0];
              const esFeriado = feriados.includes(fechaStr);

              return (
                <div
                  key={fechaStr}
                  className={`day ${esHoy ? 'today' : ''} ${estaEnRango ? 'in-range' : 'out-of-range'} ${pruebasDelDia.length > 0 ? 'has-pruebas' : ''} ${esFeriado ? 'feriado' : ''}`}
                  onDragOver={(e) => {
                    if (!estaEnRango) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={async (e) => {
                    if (!estaEnRango) return;
                    e.preventDefault();
                    
                    let data = null;
                    try { 
                      data = e.dataTransfer.getData('application/json'); 
                      if (data) data = JSON.parse(data);
                    } catch (err) { 
                      console.error('Error parsing drag data:', err);
                      return;
                    }
                    
                    if (!data) return;
                    
                    // Si es una prueba desde el sidebar
                    if (data.source === 'sidebar' && data.prueba) {
                      const prueba = data.prueba;
                      const fechaStr = fecha.toISOString().split('T')[0];
                      
                      try {
                        await pruebasRegistradasService.crear(
                          prueba.id,
                          dashboardId,
                          fechaStr,
                          data.horaInicio || null,
                          data.horaFin || null
                        );
                        onPruebasChanged();
                      } catch (err) {
                        console.error('Error creando prueba:', err);
                        alert(`Error: ${err.message}`);
                      }
                    }
                    
                    // Si es una prueba moviéndose entre celdas
                    if (data.type === 'prueba-registrada') {
                      const fechaStr = fecha.toISOString().split('T')[0];
                      
                      try {
                        await pruebasRegistradasService.actualizar(
                          data.id,
                          fechaStr,
                          data.horaInicio || null,
                          data.horaFin || null
                        );
                        onPruebasChanged();
                      } catch (err) {
                        console.error('Error moviendo prueba:', err);
                        alert(`Error: ${err.message}`);
                      }
                    }
                  }}
                >
                  {estaEnRango && (
                    <button
                      className={`feriado-toggle ${esFeriado ? 'active' : ''}`}
                      title={esFeriado ? 'Quitar feriado' : 'Marcar como feriado'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFeriado(fechaStr);
                      }}
                    >
                      {esFeriado ? '🔴' : '⚪'}
                    </button>
                  )}
                  <div className={`day-number ${estaFueraDeRango ? 'disabled' : ''}`}>{fecha.getDate()}</div>
                  <div className="day-name">
                    {['D', 'L', 'M', 'X', 'J', 'V', 'S'][fecha.getDay()]}
                  </div>
                  {esFeriado && (
                    <div className="feriado-label">FERIADO</div>
                  )}
                  {estaEnRango && pruebasDelDia.length > 0 && (
                    <div className="pruebas-container">
                      {pruebasDelDia.map(prueba => {
                        const prog = getPruebaProgramable(prueba.prueba_programable_id);
                        const tieneConflicto = Array.isArray(prueba.conflictos) && prueba.conflictos.length > 0;
                        const hasDayMismatch = Array.isArray(prueba.conflictos) && prueba.conflictos.includes(-2);
                        const dayMismatchMsg = getDayMismatchWarning(prueba);
                        const colorStyle = prog 
                          ? getPostitStyle(prog.especialidades_semestres, tieneConflicto)
                          : {};
                        
                        const horaInicioStr = formatTime(prueba.hora_inicio);
                        const horaFinStr = formatTime(prueba.hora_fin);
                        const tieneHorario = horaInicioStr && horaFinStr;
                        
                        // Construir tooltip
                        let tooltip = `${prog?.titulo || 'Sin título'} - Sección ${prog?.seccion || '?'} - ${prog?.tipo_prueba || ''}`;
                        if (tieneHorario) tooltip += ` (${horaInicioStr}-${horaFinStr})`;
                        if (dayMismatchMsg) tooltip += `\n${dayMismatchMsg}`;
                        
                        return (
                          <div 
                            key={prueba.id} 
                            className={`prueba-tag ${tieneConflicto ? 'conflicting' : ''} ${hasDayMismatch ? 'day-mismatch' : ''} tipo-${prog?.tipo_prueba?.toLowerCase().replace('/', '-')}`}
                            draggable={true}
                            style={colorStyle}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('application/json', JSON.stringify({
                                type: 'prueba-registrada',
                                id: prueba.id,
                                horaInicio: prueba.hora_inicio ? formatTime(prueba.hora_inicio) : null,
                                horaFin: prueba.hora_fin ? formatTime(prueba.hora_fin) : null
                              }));
                            }}
                            title={tooltip}
                          >
                            <div className="prueba-info">
                              <span className="prueba-codigo">{prog?.codigo || 'N/A'}-{prog?.seccion || '?'}</span>
                              <span className="prueba-titulo">{prog?.titulo || 'Sin título'}</span>
                              <span className="prueba-tipo">{prog?.tipo_prueba || ''}</span>
                              {tieneHorario && (
                                <span className="prueba-horario">{horaInicioStr}-{horaFinStr}</span>
                              )}
                              {hasDayMismatch && (
                                <span className="prueba-day-warning">📅 Día ≠ horario</span>
                              )}
                            </div>
                            <button
                              className="prueba-remove-btn"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!window.confirm('¿Eliminar esta prueba?')) return;
                                
                                try {
                                  await pruebasRegistradasService.eliminar(prueba.id);
                                  onPruebasChanged();
                                } catch (err) {
                                  console.error('Error eliminando prueba:', err);
                                  alert(`Error: ${err.message}`);
                                }
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Render calendario + sidebar para un semestre ──
  const renderCalendarWithSidebar = (semestre) => (
    <div key={semestre.id} className="calendar-with-sidebar">
      {renderCalendar(semestre)}
      <div className="calendar-sidebar-container">
        <PruebasSidebar
          pruebas={pruebasProgramables}
          pruebasRegistradas={pruebasRegistradas}
          filterFn={filterForSemester(semestre.id)}
          dashboardId={dashboardId}
          filtroEspecialidad={filtroEspecialidad}
          filtroSemestre={filtroSemestre}
          onFiltroEspecialidadChange={onFiltroEspecialidadChange}
          onFiltroSemestreChange={onFiltroSemestreChange}
        />
      </div>
    </div>
  );

  return (
    <div className="calendar-container">
      {/* Navegación mensual compartida */}
      <div className="calendar-header">
        <button onClick={mesAnterior} className="nav-btn" disabled={!puedeNavAnterior()}>← Anterior</button>
        <div className="month-year">
          <h2>{nombreMeses[fechaActual.getMonth()]} {fechaActual.getFullYear()}</h2>
          {fechaInicio && fechaFin && (
            <p className="date-range">
              Rango: {new Date(fechaInicio).toLocaleDateString()} - {new Date(fechaFin).toLocaleDateString()}
            </p>
          )}
        </div>
        <button onClick={mesSiguiente} className="nav-btn" disabled={!puedeNavSiguiente()}>Siguiente →</button>
        <button onClick={hoy} className="today-btn" disabled={!puedeNavHoy()}>Hoy</button>
      </div>

      {/* Controles de vista */}
      <div className="calendar-controls">
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

      {/* Grids del calendario */}
      {modoVisualizacion === 'cascada' ? (
        <div className="calendar-cascade">
          {HORARIOS.semestres.map((semestre) => renderCalendarWithSidebar(semestre))}
        </div>
      ) : (
        <div className="calendar-paginated">
          {renderCalendarWithSidebar(HORARIOS.semestres[semestreActual])}
        </div>
      )}

      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-color today-legend"></div>
          <span>Hoy</span>
        </div>
        <div className="legend-item">
          <div className="legend-color pruebas-legend"></div>
          <span>Con Pruebas Registradas</span>
        </div>
        <div className="legend-item">
          <div className="legend-color day-mismatch-legend"></div>
          <span>Día ≠ Horario</span>
        </div>
        <div className="legend-item">
          <div className="legend-color feriado-legend"></div>
          <span>Feriado</span>
        </div>
        <div className="legend-item">
          <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
            Los días atenuados están fuera del rango de fechas. Clic en ⚪ para marcar feriado.
          </p>
        </div>
      </div>
    </div>
  );
}
