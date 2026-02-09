import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/api';
import '../styles/Dashboards.css';

export function DashboardsPage() {
  const { user, logout } = useAuth();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newDashboardName, setNewDashboardName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadDashboards();
  }, []);

  const loadDashboards = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getDashboards(user.id);
      setDashboards(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newDashboardName.trim()) return;

    try {
      const newDashboard = await dashboardService.createDashboard(newDashboardName, user.id);
      setDashboards([...dashboards, newDashboard]);
      setNewDashboardName('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (dashboardId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este dashboard?')) return;

    try {
      await dashboardService.deleteDashboard(dashboardId);
      setDashboards(dashboards.filter(d => d.id !== dashboardId));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = async (dashboardId) => {
    if (!editName.trim()) return;

    try {
      await dashboardService.updateDashboard(dashboardId, editName);
      setDashboards(dashboards.map(d => 
        d.id === dashboardId ? { ...d, nombre: editName } : d
      ));
      setEditingId(null);
      setEditName('');
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (dashboard) => {
    setEditingId(dashboard.id);
    setEditName(dashboard.nombre);
  };

  return (
    <div className="dashboards-container">
      <header className="dashboards-header">
        <div>
          <h1>Mis Dashboards</h1>
          <p>Bienvenido, {user?.nombre}</p>
        </div>
        <button onClick={logout} className="logout-btn">Cerrar Sesión</button>
      </header>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleCreate} className="create-dashboard-form">
        <input
          type="text"
          placeholder="Nombre del nuevo dashboard"
          value={newDashboardName}
          onChange={(e) => setNewDashboardName(e.target.value)}
        />
        <button type="submit">Crear Dashboard</button>
      </form>

      {loading ? (
        <div className="loading">Cargando dashboards...</div>
      ) : dashboards.length === 0 ? (
        <div className="empty-state">
          <p>No tienes dashboards aún. ¡Crea uno para comenzar!</p>
        </div>
      ) : (
        <div className="dashboards-grid">
          {dashboards.map(dashboard => (
            <div key={dashboard.id} className="dashboard-card">
              {editingId === dashboard.id ? (
                <div className="edit-mode">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <div className="edit-actions">
                    <button onClick={() => handleEdit(dashboard.id)} className="save-btn">Guardar</button>
                    <button onClick={() => setEditingId(null)} className="cancel-btn">Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <h3>{dashboard.nombre}</h3>
                  <p className="dashboard-date">
                    Creado: {new Date(dashboard.created_at).toLocaleDateString()}
                  </p>
                  <div className="dashboard-actions">
                    <button 
                      onClick={() => startEdit(dashboard)} 
                      className="edit-btn"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDelete(dashboard.id)} 
                      className="delete-btn"
                    >
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
