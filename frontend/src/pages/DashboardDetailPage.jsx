import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  dashboardService, 
  sheetsService, 
  horasRegistradasService,
  pruebasProgramablesService,
  pruebasRegistradasService
} from '../services/api';
import { TimeTable } from '../components/TimeTable';
import { CalendarView } from '../components/CalendarView';
import '../styles/DashboardDetail.css';

export function DashboardDetailPage() {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [horasRegistradas, setHorasRegistradas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [horariosProgramables, setHorariosProgramables] = useState([]);
  const [mostrarHorarios, setMostrarHorarios] = useState(false);
  const [expandirTabla, setExpandirTabla] = useState(false);
  const [vistaActual, setVistaActual] = useState('horarios'); // 'horarios' o 'calendario'
  const [pruebasProgramables, setPruebasProgramables] = useState([]);
  const [pruebasRegistradas, setPruebasRegistradas] = useState([]);
  const [feriados, setFeriados] = useState([]);
  
  // Estados para filtros
  const [filtroHorario, setFiltroHorario] = useState('plan_comun'); // plan_comun, 5to_6to, 7mo_mas
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('TODOS'); // ICI, IOC, ICE, ICC, ICA, ICQ, TODOS
  const [filtroSemestre, setFiltroSemestre] = useState('TODOS'); // 1-11, TODOS
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadDashboard();
  }, [dashboardId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      // Obtener información del dashboard usando el endpoint directo
      const found = await dashboardService.getDashboard(parseInt(dashboardId));
      
      if (!found) {
        setError('Dashboard no encontrado');
        return;
      }
      
      setDashboard(found);
      // Parsear feriados del dashboard
      let feriadosList = found.feriados || [];
      if (typeof feriadosList === 'string') {
        try { feriadosList = JSON.parse(feriadosList); } catch (e) { feriadosList = []; }
      }
      setFeriados(feriadosList);
      // TODO: Cargo de horas registradas cuando esté disponible
      setHorasRegistradas([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCargarDatos = async () => {
    try {
      setCargandoDatos(true);
      setError('');
      
      // Cargar maestros y procesar en el backend
      await sheetsService.loadMaestros();
      
      // Obtener los horarios programables creados
      const respuesta = await sheetsService.getHorariosProgramables();
      setHorariosProgramables(respuesta.horarios);
      setMostrarHorarios(true);
      
      // Obtener las pruebas programables creadas
      const respuestaPruebas = await pruebasProgramablesService.obtenerPruebasProgramables();
      setPruebasProgramables(respuestaPruebas.pruebas || []);
      
      // Incrementar refreshKey para que TimeTable recargue horas registradas con conflictos actualizados
      setRefreshKey(prev => prev + 1);

      // Recargar pruebas registradas con conflictos actualizados
      await cargarPruebasRegistradas();

      console.log('Horarios cargados:', respuesta.horarios);
      console.log('Pruebas cargadas:', respuestaPruebas.pruebas);
    } catch (err) {
      setError(err.message);
      console.error('Error cargando datos:', err);
    } finally {
      setCargandoDatos(false);
    }
  };

  const handleUsarRespaldo = async () => {
    try {
      setCargandoDatos(true);
      setError('');

      const respuesta = await sheetsService.usarRespaldo(dashboardId);

      setHorariosProgramables(respuesta.horarios || []);
      setPruebasProgramables(respuesta.pruebas || []);
      setMostrarHorarios(true);

      // Forzar recarga de horas registradas en la grilla
      setRefreshKey(prev => prev + 1);
      await cargarPruebasRegistradas();

      const resumen = respuesta.resumen || {};
      const advertencias = Array.isArray(resumen.advertencias) ? resumen.advertencias : [];

      if (advertencias.length > 0) {
        console.warn('Advertencias al usar respaldo:', advertencias);
      }

      let mensaje = 'Respaldo aplicado correctamente';
      mensaje += `\nHoras restauradas: ${resumen.horasRestauradas ?? 0}`;
      mensaje += `\nPruebas restauradas: ${resumen.pruebasRestauradas ?? 0}`;
      mensaje += `\nConflictos horas: ${resumen.conflictosHoras ?? 0}`;
      mensaje += `\nConflictos pruebas: ${resumen.conflictosPruebas ?? 0}`;
      if (advertencias.length > 0) {
        mensaje += `\nAdvertencias: ${advertencias.length} (revisa la consola)`;
      }

      alert(mensaje);
    } catch (err) {
      setError(err.message);
      console.error('Error usando respaldo:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setCargandoDatos(false);
    }
  };

  const cargarPruebasRegistradas = async () => {
    try {
      const { pruebasRegistradas: prs } = await pruebasRegistradasService.obtenerPorDashboard(dashboardId);
      setPruebasRegistradas(prs || []);
    } catch (err) {
      console.error('Error cargando pruebas registradas:', err);
    }
  };
  
  /**
   * Función para filtrar horarios según especialidad y semestre
   */
  const filtrarHorario = (horario) => {
    if (!horario.especialidades_semestres) return false;
    
    let esp = horario.especialidades_semestres;
    if (typeof esp === 'string') {
      try {
        esp = JSON.parse(esp);
      } catch (e) {
        return false;
      }
    }
    
    // Si es "TODOS", mostrar todos los horarios
    if (filtroEspecialidad === 'TODOS' && filtroSemestre === 'TODOS') {
      return true;
    }
    
    // Extraer las especialidades y semestres del horario
    let especialidadesDelHorario = [];
    
    if (Array.isArray(esp)) {
      especialidadesDelHorario = esp;
    } else if (typeof esp === 'object') {
      // Formato: {ICA: 9, IOC: 9} o {ICA: [9, 10]}
      especialidadesDelHorario = Object.entries(esp).flatMap(([nombre, semestres]) => {
        const sems = Array.isArray(semestres) ? semestres : [semestres];
        return sems.map(sem => ({ nombre, semestre: sem }));
      });
    }
    
    // Filtrar según criterios
    for (const item of especialidadesDelHorario) {
      const nombreEsp = item.nombre || item;
      const semestreNum = typeof item === 'object' ? item.semestre : item;
      
      // Limpiar semestre (remover letras)
      let semestreLimpio = semestreNum;
      if (typeof semestreNum === 'string') {
        semestreLimpio = parseInt(semestreNum.replace(/[^0-9]/g, ''), 10);
      }
      if (typeof semestreLimpio === 'number') {
        semestreLimpio = Math.floor(semestreLimpio);
      }
      
      // Verificar si cumple con el filtro de especialidad
      const cumpleEspecialidad = filtroEspecialidad === 'TODOS' || 
        nombreEsp === filtroEspecialidad ||
        nombreEsp === 'Plan Común' ||
        nombreEsp === 'plan_comun';
      
      // Verificar si cumple con el filtro de semestre
      const cumpleSemestre = filtroSemestre === 'TODOS' || 
        semestreLimpio === parseInt(filtroSemestre);
      
      if (cumpleEspecialidad && cumpleSemestre) {
        return true;
      }
    }
    
    return false;
  };

  useEffect(() => {
    if (dashboardId) {
      cargarPruebasRegistradas();
    }
  }, [dashboardId]);

  const handleEnviarDatos = async () => {
    try {
      setCargandoDatos(true);
      setError('');
      
      // Enviar el diccionario de horas registradas a Google Sheets
      const resultado = await horasRegistradasService.enviarDiccionarioAGoogleSheets(dashboardId);
      
      // Mostrar en consola
      console.log('Respuesta de Google Sheets:');
      console.log(resultado);
      
      alert('Datos enviados correctamente a Google Sheets');
    } catch (err) {
      setError(err.message);
      console.error('Error al enviar datos:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setCargandoDatos(false);
    }
  };

  const handleEnviarPruebas = async () => {
    const diccionario = {};

    const ABREV_TIPO = {
      'CLASE': 'CLAS',
      'AYUDANTIA': 'AYUD',
      'EXAMEN': 'EXAM',
      'TARDE': 'TARDE',
      'LAB/TALLER': 'LAB/TALLER'
    };

    for (const prueba of pruebasRegistradas) {
      const tipo = (prueba.tipo_prueba || '').toUpperCase();

      const clave = `${prueba.codigo}${prueba.seccion}`;
      if (!diccionario[clave]) {
        diccionario[clave] = [];
      }

      const formatTime = (t) => {
        if (!t) return null;
        const s = String(t).substring(0, 5);
        const [h, m] = s.split(':');
        return `${parseInt(h)}:${m}`;
      };

      const horaInicio = formatTime(prueba.hora_inicio);
      const horaFin = formatTime(prueba.hora_fin);
      const horario = horaInicio && horaFin ? `${horaInicio}-${horaFin}` : null;

      diccionario[clave].push({
        fecha: new Date(prueba.fecha).toISOString().split('T')[0],
        horario,
        tipo: ABREV_TIPO[tipo] || tipo
      });
    }

    console.log('JSON Pruebas para enviar:', JSON.stringify(diccionario, null, 2));

    try {
      setCargandoDatos(true);
      setError('');
      const resultado = await pruebasRegistradasService.enviarPruebasAGoogleSheets(dashboardId, diccionario);
      console.log('Respuesta de Google Sheets (pruebas):', resultado);
      alert('Pruebas enviadas correctamente a Google Sheets');
    } catch (err) {
      setError(err.message);
      console.error('Error al enviar pruebas:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setCargandoDatos(false);
    }
  };

  const handleActualizarCalendario = async () => {
    try {
      setCargandoDatos(true);
      setError('');
      
      // Actualizar el calendario de pruebas basado en horas registradas
      const respuesta = await pruebasProgramablesService.actualizarCalendario(dashboardId);
      
      // Actualizar las pruebas programables en el estado
      setPruebasProgramables(respuesta.pruebas || []);
      
      // Si se eliminaron pruebas registradas con bloques obsoletos, recargar
      const eliminadas = respuesta.eliminadas || [];
      if (eliminadas.length > 0) {
        await cargarPruebasRegistradas();
      }
      
      // Construir mensaje del popup
      let msg = respuesta.mensaje;
      if (eliminadas.length > 0) {
        msg += `\n\nSe eliminaron ${eliminadas.length} prueba(s) registrada(s) cuyo bloque ya no existe:`;
        eliminadas.forEach(e => {
          const fechaStr = new Date(e.fecha).toLocaleDateString();
          msg += `\n  • ${e.codigo}-${e.seccion} ${e.tipo_prueba} (${e.hora_inicio}-${e.hora_fin}) del ${fechaStr}`;
        });
      }
      
      console.log('Calendario actualizado:', respuesta);
      alert(msg);
    } catch (err) {
      setError(err.message);
      console.error('Error al actualizar calendario:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setCargandoDatos(false);
    }
  };

  if (loading) {
    return <div className="loading">Cargando dashboard...</div>;
  }

  if (error) {
    return (
      <div className="dashboard-detail-container">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/dashboards')}>Volver a dashboards</button>
      </div>
    );
  }

  return (
    <div className="dashboard-detail-container">
      <header className="dashboard-detail-header">
        <div>
          <button className="back-btn" onClick={() => navigate('/dashboards')}>
            ← Volver
          </button>
          <h1>{dashboard?.nombre}</h1>
          <p>Creado: {new Date(dashboard?.created_at).toLocaleDateString()}</p>
          {dashboard?.fecha_inicio && dashboard?.fecha_fin && (
            <p className="date-range">Rango: {new Date(dashboard.fecha_inicio).toLocaleDateString()} - {new Date(dashboard.fecha_fin).toLocaleDateString()}</p>
          )}
        </div>
      </header>

      <div className="view-toggle">
        <button
          className={`toggle-btn ${vistaActual === 'horarios' ? 'active' : ''}`}
          onClick={() => setVistaActual('horarios')}
        >
          📅 Horarios
        </button>
        <button
          className={`toggle-btn ${vistaActual === 'calendario' ? 'active' : ''}`}
          onClick={() => setVistaActual('calendario')}
        >
          📆 Calendario
        </button>
      </div>

      <div className="dashboard-controls">
        <button 
          className="load-data-btn" 
          onClick={handleCargarDatos}
          disabled={cargandoDatos}
        >
          {cargandoDatos ? 'Cargando datos...' : 'Cargar Datos'}
        </button>
        <button 
          className="use-backup-btn" 
          onClick={handleUsarRespaldo}
          disabled={cargandoDatos}
        >
          {cargandoDatos ? 'Procesando...' : 'Usar Respaldo'}
        </button>
        {horariosProgramables.length > 0 && (
          <>
            <button 
              className="send-data-btn" 
              onClick={handleEnviarDatos}
              disabled={cargandoDatos}
            >
              {cargandoDatos ? 'Procesando...' : 'Enviar Datos'}
            </button>
            <button 
              className="update-calendar-btn" 
              onClick={handleActualizarCalendario}
              disabled={cargandoDatos}
            >
              {cargandoDatos ? 'Procesando...' : 'Actualizar Calendario'}
            </button>
            {pruebasRegistradas.length > 0 && (
              <button 
                className="send-pruebas-btn" 
                onClick={handleEnviarPruebas}
                disabled={cargandoDatos}
              >
                {cargandoDatos ? 'Enviando...' : 'Enviar Pruebas'}
              </button>
            )}
          </>
        )}
      </div>

      {mostrarHorarios && horariosProgramables.length > 0 && (
        <div className="horarios-programables-section">
          <div className="horarios-programables-header">
            <h2>Horarios Programables Cargados ({horariosProgramables.length})</h2>
            <button 
              className="toggle-tabla-btn"
              onClick={() => setExpandirTabla(!expandirTabla)}
            >
              {expandirTabla ? '▼ Contraer' : '▶ Expandir'}
            </button>
          </div>
          {expandirTabla && (
            <div className="horarios-tabla">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Sección</th>
                    <th>Tipo</th>
                    <th>Título</th>
                    <th>Horas</th>
                    <th>Especialidades</th>
                    <th>Profesores</th>
                    <th>Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {horariosProgramables.map((horario) => (
                    <tr key={horario.id}>
                      <td className="codigo">{horario.codigo}</td>
                      <td className="seccion">{horario.seccion}</td>
                      <td className="tipo">
                        <span className={`tipo-badge ${horario.tipo_hora.toLowerCase().replace('/', '-')}`}>
                          {horario.tipo_hora}
                        </span>
                      </td>
                      <td className="titulo">{horario.titulo || '-'}</td>
                      <td className="cantidad">{horario.cantidad_horas}</td>
                      <td className="especialidades">
                        {horario.especialidades_semestres
                          ? (() => {
                              const esp = typeof horario.especialidades_semestres === 'string' 
                                ? JSON.parse(horario.especialidades_semestres)
                                : horario.especialidades_semestres;
                              if (typeof esp === 'object' && Array.isArray(esp)) {
                                return esp.map((e) => e.nombre).join(', ');
                              } else if (typeof esp === 'object') {
                                return Object.keys(esp).join(', ');
                              }
                              return '-';
                            })()
                          : '-'}
                      </td>
                      <td className="profesores">
                        {horario.profesor_1_id || horario.profesor_2_id ? (
                          <span className="prof-list">
                            {horario.profesor_1_id && <span className="prof-1">P1</span>}
                            {horario.profesor_2_id && <span className="prof-2">P2</span>}
                          </span>
                        ) : (
                          <span className="sin-profesor">-</span>
                        )}
                      </td>
                      <td className="fecha">
                        {new Date(horario.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="dashboard-detail-layout">
        {vistaActual === 'horarios' ? (
          <main className="dashboard-detail-main">
            <TimeTable 
              dashboardId={parseInt(dashboardId)} 
              horasRegistradas={horasRegistradas} 
              horariosProgramables={horariosProgramables}
              filtroEspecialidad={filtroEspecialidad}
              filtroSemestre={filtroSemestre}
              onFiltroEspecialidadChange={setFiltroEspecialidad}
              onFiltroSemestreChange={setFiltroSemestre}
              filtrarHorario={filtrarHorario}
              refreshKey={refreshKey}
            />
          </main>
        ) : (
          <main className="dashboard-detail-main">
            <CalendarView
              fechaInicio={dashboard?.fecha_inicio}
              fechaFin={dashboard?.fecha_fin}
              horasRegistradas={horasRegistradas}
              horariosProgramables={horariosProgramables}
              pruebasRegistradas={pruebasRegistradas}
              pruebasProgramables={pruebasProgramables}
              dashboardId={dashboardId}
              onPruebasChanged={cargarPruebasRegistradas}
              filtroEspecialidad={filtroEspecialidad}
              filtroSemestre={filtroSemestre}
              onFiltroEspecialidadChange={setFiltroEspecialidad}
              onFiltroSemestreChange={setFiltroSemestre}
              filtrarPrueba={filtrarHorario}
              feriados={feriados}
              onToggleFeriado={async (fecha) => {
                try {
                  const updated = await dashboardService.toggleFeriado(dashboardId, fecha);
                  let feriadosList = updated.feriados || [];
                  if (typeof feriadosList === 'string') {
                    try { feriadosList = JSON.parse(feriadosList); } catch (e) { feriadosList = []; }
                  }
                  setFeriados(feriadosList);
                } catch (err) {
                  console.error('Error toggling feriado:', err);
                }
              }}
            />
          </main>
        )}
      </div>
    </div>
  );
}
