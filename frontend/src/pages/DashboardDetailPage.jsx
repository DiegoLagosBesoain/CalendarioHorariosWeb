import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardService, sheetsService, horasRegistradasService } from '../services/api';
import { TimeTable } from '../components/TimeTable';
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

  useEffect(() => {
    loadDashboard();
  }, [dashboardId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      // Obtener información del dashboard
      // TODO: Crear endpoint GET /api/dashboards/:id
      const dashboards = await dashboardService.getDashboards(user.id);
      const found = dashboards.find(d => d.id === parseInt(dashboardId));
      
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
      
      console.log('Horarios cargados:', respuesta.horarios);
    } catch (err) {
      setError(err.message);
      console.error('Error cargando datos:', err);
    } finally {
      setCargandoDatos(false);
    }
  };

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
        </div>
      </header>

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
        <main className="dashboard-detail-main">
          <TimeTable dashboardId={parseInt(dashboardId)} horasRegistradas={horasRegistradas} horariosProgramables={horariosProgramables} />
        </main>
      </div>
    </div>
  );
}
