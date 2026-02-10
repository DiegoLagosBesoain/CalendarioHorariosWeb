const API_URL = 'http://localhost:3000/api';

// ==================== USUARIOS ====================
export const authService = {
  async register(nombre, mail, password) {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, mail, password })
    });
    if (!res.ok) throw new Error('Error en registro');
    return res.json();
  },

  async login(mail, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mail, password })
    });
    if (!res.ok) throw new Error('Error en login');
    return res.json();
  },

  async getUser(userId) {
    const res = await fetch(`${API_URL}/users/${userId}`);
    if (!res.ok) throw new Error('Error obteniendo usuario');
    return res.json();
  }
};

// ==================== SHEETS ====================
export const sheetsService = {
  async getMaestroList() {
    const res = await fetch(`${API_URL}/sheets/master.list`);
    if (!res.ok) throw new Error('Error obteniendo maestros');
    return res.json();
  },

  async loadMaestros() {
    const res = await fetch(`${API_URL}/sheets/load-maestros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Error cargando maestros');
    return res.json();
  },

  async getHorariosProgramables() {
    const res = await fetch(`${API_URL}/sheets/horas-programables`);
    if (!res.ok) throw new Error('Error obteniendo horarios programables');
    return res.json();
  },

  async limpiarHorariosProgramables() {
    const res = await fetch(`${API_URL}/sheets/horas-programables`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error limpiando horarios');
    return res.json();
  }
};

// ==================== DASHBOARDS ====================
export const dashboardService = {
  async getDashboards(userId) {
    const res = await fetch(`${API_URL}/dashboards?usuario_id=${userId}`);
    if (!res.ok) throw new Error('Error obteniendo dashboards');
    return res.json();
  },

  async createDashboard(nombre, userId) {
    const res = await fetch(`${API_URL}/dashboards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, usuario_id: userId })
    });
    if (!res.ok) throw new Error('Error creando dashboard');
    return res.json();
  },

  async deleteDashboard(dashboardId) {
    const res = await fetch(`${API_URL}/dashboards/${dashboardId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error eliminando dashboard');
    return res.json();
  },

  async updateDashboard(dashboardId, nombre) {
    const res = await fetch(`${API_URL}/dashboards/${dashboardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre })
    });
    if (!res.ok) throw new Error('Error actualizando dashboard');
    return res.json();
  }
};

// ==================== HORAS REGISTRADAS ====================
export const horasRegistradasService = {
  async obtenerPorDashboard(dashboardId) {
    const res = await fetch(`${API_URL}/horas-registradas/${dashboardId}`);
    if (!res.ok) throw new Error('Error obteniendo horas registradas');
    return res.json();
  },

  async crear(horaProgramableId, dashboardId, dia, bloqueIndex, semestreId) {
    const res = await fetch(`${API_URL}/horas-registradas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        horaProgramableId, 
        dashboardId, 
        dia, 
        bloqueIndex,
        semestreId 
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error creando hora registrada');
    }
    return res.json();
  },

  async actualizar(id, dia, bloqueIndex) {
    const res = await fetch(`${API_URL}/horas-registradas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dia, bloqueIndex })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error actualizando hora registrada');
    }
    return res.json();
  },

  async eliminar(id) {
    const res = await fetch(`${API_URL}/horas-registradas/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error eliminando hora registrada');
    }
    return res.json();
  },

  async limpiarDashboard(dashboardId) {
    const res = await fetch(`${API_URL}/horas-registradas/dashboard/${dashboardId}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error limpiando horas registradas');
    }
    return res.json();
  }
};
