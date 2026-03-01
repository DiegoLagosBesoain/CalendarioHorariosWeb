import { useState, useMemo } from 'react';
import { pruebasRegistradasService } from '../services/api';
import { getPostitStyle } from '../utils/colorUtils';
import '../styles/CalendarView.css';

export function CalendarView({ 
  fechaInicio, 
  fechaFin, 
  horasRegistradas = [], 
  horariosProgramables = [],
  pruebasRegistradas = [],
  pruebasProgramables = [],
  dashboardId,
  onPruebasChanged = () => {}
}) {
  // Si no hay fechas de rango, mostrar mensaje
  if (!fechaInicio || !fechaFin) {
    return (
      <div className="calendar-view">
        <div className="empty-calendar-message">
          <p>⚠️ Este dashboard no tiene un rango de fechas definido.</p>
          <p>Por favor edita el dashboard para establecer las fechas de inicio y fin.</p>
        </div>
      </div>
    );
  }

  const fechaInicioDate = new Date(fechaInicio);
  const fechaFinDate = new Date(fechaFin);
  
  const [fechaActual, setFechaActual] = useState(
    new Date(fechaInicio)
  );

  // Generar array de días del mes actual
  const diasDelMes = useMemo(() => {
    const year = fechaActual.getFullYear();
    const month = fechaActual.getMonth();
    const primerDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0);
    const diasEnMes = ultimoDia.getDate();
    
    // Obtener el día de la semana del primer día (0-6, donde 0 es domingo)
    const primerDiaDelMes = primerDia.getDay();
    
    const dias = [];
    
    // Agregar espacios vacíos para los días de la semana anteriores
    for (let i = 0; i < primerDiaDelMes; i++) {
      dias.push(null);
    }
    
    // Agregar los días del mes
    for (let i = 1; i <= diasEnMes; i++) {
      dias.push(new Date(year, month, i));
    }
    
    return dias;
  }, [fechaActual]);

  // Obtener horas registradas para un día específico
  const getHorasDelDia = (fecha) => {
    if (!fecha) return [];
    
    const diasemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const nombreDia = diasemana[fecha.getDay()];
    
    return horasRegistradas.filter(h => h.dia_semana === nombreDia);
  };

  // Obtener pruebas registradas para un día específico
  const getPruebasDelDia = (fecha) => {
    if (!fecha) return [];
    
    const fechaStr = fecha.toISOString().split('T')[0]; // YYYY-MM-DD
    
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

  // Verificar si se puede navegar al mes anterior
  const puedeNavAnterior = () => {
    const anteriorMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1);
    return anteriorMes.getFullYear() > fechaInicioDate.getFullYear() || 
           (anteriorMes.getFullYear() === fechaInicioDate.getFullYear() && anteriorMes.getMonth() >= fechaInicioDate.getMonth());
  };

  // Verificar si se puede navegar al mes siguiente
  const puedeNavSiguiente = () => {
    const siguienteMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1);
    return siguienteMes.getFullYear() < fechaFinDate.getFullYear() || 
           (siguienteMes.getFullYear() === fechaFinDate.getFullYear() && siguienteMes.getMonth() <= fechaFinDate.getMonth());
  };

  // Verificar si el botón "Hoy" puede estar activo
  const puedeNavHoy = () => {
    const today = new Date();
    return today >= fechaInicioDate && today <= fechaFinDate;
  };
  const mesAnterior = () => {
    const nuevoMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1);
    // Solo navegar si el nuevo mes no es antes del mes de inicio
    if (nuevoMes.getFullYear() > fechaInicioDate.getFullYear() || 
        (nuevoMes.getFullYear() === fechaInicioDate.getFullYear() && nuevoMes.getMonth() >= fechaInicioDate.getMonth())) {
      setFechaActual(nuevoMes);
    }
  };

  // Navegar al mes siguiente
  const mesSiguiente = () => {
    const nuevoMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1);
    // Solo navegar si el nuevo mes no es después del mes de fin
    if (nuevoMes.getFullYear() < fechaFinDate.getFullYear() || 
        (nuevoMes.getFullYear() === fechaFinDate.getFullYear() && nuevoMes.getMonth() <= fechaFinDate.getMonth())) {
      setFechaActual(nuevoMes);
    }
  };

  // Navegar a hoy (solo si hoy está en el rango)
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

  return (
    <div className="calendar-view">
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

            const horasDelDia = getHorasDelDia(fecha);
            const pruebasDelDia = getPruebasDelDia(fecha);
            const esHoy = (
              fecha.getDate() === new Date().getDate() &&
              fecha.getMonth() === new Date().getMonth() &&
              fecha.getFullYear() === new Date().getFullYear()
            );
            const estaEnRango = fecha >= fechaInicioDate && fecha <= fechaFinDate;
            const estaFueraDeRango = !estaEnRango;

            return (
              <div
                key={fecha.toISOString().split('T')[0]}
                className={`day ${esHoy ? 'today' : ''} ${estaEnRango ? 'in-range' : 'out-of-range'} ${pruebasDelDia.length > 0 ? 'has-pruebas' : ''}`}
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
                    const fechaStr = fecha.toISOString().split('T')[0]; // YYYY-MM-DD
                    
                    try {
                      // Crear la prueba registrada (sin hora_inicio/fin)
                      const resultado = await pruebasRegistradasService.crear(
                        prueba.id,
                        dashboardId,
                        fechaStr
                      );
                      
                      // Notificar al padre para recargar
                      onPruebasChanged();
                    } catch (err) {
                      console.error('Error creando prueba:', err);
                      alert(`Error: ${err.message}`);
                    }
                  }
                  
                  // Si es una prueba moviéndose entre celdas
                  if (data.type === 'prueba-registrada') {
                    const fechaStr = fecha.toISOString().split('T')[0]; // YYYY-MM-DD
                    
                    try {
                      // Actualizar la prueba registrada con la nueva fecha
                      await pruebasRegistradasService.actualizar(
                        data.id,
                        fechaStr
                      );
                      
                      // Notificar al padre para recargar
                      onPruebasChanged();
                    } catch (err) {
                      console.error('Error moviendo prueba:', err);
                      alert(`Error: ${err.message}`);
                    }
                  }
                }}
              >
                <div className={`day-number ${estaFueraDeRango ? 'disabled' : ''}`}>{fecha.getDate()}</div>
                <div className="day-name">
                  {['D', 'L', 'M', 'X', 'J', 'V', 'S'][fecha.getDay()]}
                </div>
                {estaEnRango && pruebasDelDia.length > 0 && (
                  <div className="pruebas-container">
                    {pruebasDelDia.map(prueba => {
                      const prog = getPruebaProgramable(prueba.prueba_programable_id);
                      const tieneConflicto = Array.isArray(prueba.conflictos) && prueba.conflictos.length > 0;
                      const colorStyle = prog 
                        ? getPostitStyle(prog.especialidades_semestres, tieneConflicto)
                        : {};
                      
                      return (
                        <div 
                          key={prueba.id} 
                          className={`prueba-tag ${tieneConflicto ? 'conflicting' : ''} tipo-${prog?.tipo_prueba?.toLowerCase().replace('/', '-')}`}
                          draggable={true}
                          style={colorStyle}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('application/json', JSON.stringify({
                              type: 'prueba-registrada',
                              id: prueba.id
                            }));
                          }}
                          title={`${prog?.titulo || 'Sin título'} - Sección ${prog?.seccion || '?'} - ${prog?.tipo_prueba || ''}`}
                        >
                          <div className="prueba-info">
                            <span className="prueba-codigo">{prog?.codigo || 'N/A'}-{prog?.seccion || '?'}</span>
                            <span className="prueba-titulo">{prog?.titulo || 'Sin título'}</span>
                            <span className="prueba-tipo">{prog?.tipo_prueba || ''}</span>
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
          <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
            Los días atenuados están fuera del rango de fechas
          </p>
        </div>
      </div>
    </div>
  );
}
