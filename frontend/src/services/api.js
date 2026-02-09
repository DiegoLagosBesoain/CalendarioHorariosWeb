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
