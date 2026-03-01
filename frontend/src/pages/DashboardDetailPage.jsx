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
import { PruebasSidebar } from '../components/PruebasSidebar';
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
  
  // Estados para filtros
  const [filtroHorario, setFiltroHorario] = useState('plan_comun'); // plan_comun, 5to_6to, 7mo_mas
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('TODOS'); // ICI, IOC, ICE, ICC, ICA, ICQ, TODOS
  const [filtroSemestre, setFiltroSemestre] = useState('TODOS'); // 1-11, TODOS

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
      
      console.log('Horarios cargados:', respuesta.horarios);
      console.log('Pruebas cargadas:', respuestaPruebas.pruebas);
    } catch (err) {
      setError(err.message);
      console.error('Error cargando datos:', err);
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

  const handleLimpiarDatos = async () => {
    if (!window.confirm('¿Seguro que deseas eliminar todos los horarios programables?')) {
      return;
    }

    try {
      setCargandoDatos(true);
      await sheetsService.limpiarHorariosProgramables();
      setHorariosProgramables([]);
      setMostrarHorarios(false);
      console.log('Datos limpiados');
    } catch (err) {
      setError(err.message);
      console.error('Error limpiando datos:', err);
    } finally {
      setCargandoDatos(false);
    }
  };

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
        {horariosProgramables.length > 0 && (
          <>
            <button 
              className="delete-data-btn" 
              onClick={handleLimpiarDatos}
              disabled={cargandoDatos}
            >
              Limpiar Datos
            </button>
            <button 
              className="send-data-btn" 
              onClick={handleEnviarDatos}
              disabled={cargandoDatos}
            >
              {cargandoDatos ? 'Procesando...' : 'Enviar Datos'}
            </button>
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
            />
          </main>
        ) : (
          <div className="calendario-layout">
            <main className="calendario-main">
              <CalendarView
                fechaInicio={dashboard?.fecha_inicio}
                fechaFin={dashboard?.fecha_fin}
                horasRegistradas={horasRegistradas}
                horariosProgramables={horariosProgramables}
                pruebasRegistradas={pruebasRegistradas}
                pruebasProgramables={pruebasProgramables}
                dashboardId={dashboardId}
                onPruebasChanged={cargarPruebasRegistradas}
              />
            </main>
            <aside className="calendario-sidebar">
              <PruebasSidebar 
                pruebas={pruebasProgramables}
                dashboardId={dashboardId}
              />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
