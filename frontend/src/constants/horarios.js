// Configuración de horarios bloques de 50 minutos
export const HORARIOS = {
  inicioDia: 8.5, // 8:30
  minutosPorBloque: 50,
  minutosDescanso: 10,
  bloques: [
    { inicio: "8:30", fin: "9:20", tipo: "disponible", colorFila: "#c8e6c9" },
    { inicio: "9:30", fin: "10:20", tipo: "disponible", colorFila: "#ffe8cc" },
    { inicio: "10:30", fin: "11:20", tipo: "disponible", colorFila: "#c8e6c9" },
    { inicio: "11:30", fin: "12:20", tipo: "disponible", colorFila: "#ffe8cc" },
    { inicio: "12:30", fin: "13:20", tipo: "pivote", colorFila: "#e8d5f5" },
    { inicio: "13:30", fin: "14:20", tipo: "disponible", colorFila: "#c8e6c9" },
    { inicio: "14:30", fin: "15:20", tipo: "disponible", colorFila: "#ffe8cc" },
    { inicio: "15:30", fin: "16:20", tipo: "disponible", colorFila: "#c8e6c9" },
    { inicio: "16:30", fin: "17:20", tipo: "disponible", colorFila: "#ffe8cc" },
    { inicio: "17:30", fin: "18:20", tipo: "disponible", colorFila: "#c8e6c9" },
    { inicio: "18:30", fin: "19:20", tipo: "disponible", colorFila: "#ffe8cc" },
    { inicio: "19:30", fin: "20:20", tipo: "disponible", colorFila: "#c8e6c9" }
  ],
  dias: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
  semestres: [
    { id: 'plan_comun', nombre: 'Plan Común', color: '#667eea' },
    { id: '5to_6to', nombre: '5to y 6to', color: '#764ba2' },
    { id: '7mo_8vo', nombre: '7mo y 8vo', color: '#f093fb' },
    { id: '9no_10_11', nombre: '9no 10mo y 11mvo', color: '#4facfe' }
  ],
  modoVisualizacion: 'cascada' // 'cascada' o 'paginado'
};

export const diaNumeroPorNombre = {
  'Lunes': 1,
  'Martes': 2,
  'Miércoles': 3,
  'Jueves': 4,
  'Viernes': 5
};
