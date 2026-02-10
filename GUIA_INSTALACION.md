# Calendario Horario - Guía de Instalación y Ejecución

## Requisitos Previos
- Node.js (v18+)
- PostgreSQL (corriendo localmente o en un servidor)
- npm o yarn

## 1. Configuración de la Base de Datos

### Crear usuario y base de datos en PostgreSQL:
```sql
CREATE USER app_user WITH PASSWORD 'app_password';
CREATE DATABASE uandes OWNER app_user;
GRANT ALL PRIVILEGES ON DATABASE uandes TO app_user;
```

### Ejecutar el script de inicialización:
```bash
cd backend
npm install
npm run db:init
```

Esto ejecutará `src/db/init.js` que cargará el esquema desde `init.sql` a la base de datos.

## 2. Configuración del Backend

### Variables de entorno (.env):
```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=uandes
DB_USER=app_user
DB_PASSWORD=app_password
GOOGLE_SHEET_ID=xxxx
APPSCRIPT_KEY=mi_clave_super_secreta
```

### Instalar dependencias:
```bash
cd backend
npm install
```

### Ejecutar servidor:
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

## 3. Configuración del Frontend

### Instalar dependencias:
```bash
cd frontend
npm install
```

### Ejecutar desarrollo:
```bash
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

## 4. Flujo de la Aplicación

### Pantalla 1: Autenticación (/auth)
- **Modo Registro**: Crea un nuevo usuario con nombre, email y contraseña
- **Modo Login**: Ingresa con email y contraseña
- El usuario se guarda en `localStorage` para mantener la sesión

### Pantalla 2: Dashboards (/dashboards)
- Lista todos los dashboards del usuario autenticado
- Crear nuevo dashboard: Ingresa nombre y presiona "Crear Dashboard"
- Editar: Presiona "Editar" para cambiar el nombre
- Eliminar: Presiona "Eliminar" (requiere confirmación)
- **Abrir**: Presiona "Abrir" o el título para ir al detalle

### Pantalla 3: Dashboard Detail (/dashboards/:dashboardId)
- Muestra 4 horarios superpuestos:
  - Plan Común (Azul)
  - 5to y 6to (Morado)
  - 7mo y 8vo (Rosa)
  - 9no 10mo y 11mvo (Azul claro)
- Estructura: Lunes a Viernes, bloques de 50 minutos desde 8:30 a 9:20, 9:30 a 10:20, etc.
- Botón "Volver" para regresar a la lista de dashboards

## 5. Endpoints del API

### Autenticación
- `POST /api/auth/register` - Registrar nuevo usuario
- `POST /api/auth/login` - Iniciar sesión

### Usuarios
- `GET /api/users/:id` - Obtener usuario por ID

### Dashboards
- `GET /api/dashboards?usuario_id=X` - Listar dashboards de un usuario
- `POST /api/dashboards` - Crear nuevo dashboard
- `PUT /api/dashboards/:id` - Actualizar dashboard
- `DELETE /api/dashboards/:id` - Eliminar dashboard

## 6. Estructura de Carpetas

```
frontend/
├── src/
│   ├── pages/           # Páginas principales
│   ├── components/      # Componentes reutilizables
│   ├── context/         # Context API (autenticación)
│   ├── services/        # Servicios API
│   ├── styles/          # Estilos CSS
│   ├── constants/       # Constantes (horarios, días, etc)
│   ├── App.jsx          # Rutas principales
│   └── main.jsx         # Entrada de la app

backend/
├── src/
│   ├── routes/          # Rutas API
│   ├── services/        # Servicios (integraciones)
│   └── db/              # Configuración de base de datos
├── init.sql             # Script de inicialización BD
├── app.js               # Configuración Express
└── index.js             # Servidor principal
```

## 7. Troubleshooting

### Error: "Cannot connect to database"
- Verifica que PostgreSQL esté corriendo
- Comprueba las credenciales en `.env`
- Asegúrate que la base de datos fue creada

### Error: "CORS error"
- El backend está configurado con CORS habilitado en todas las rutas
- Verifica que el frontend está en `http://localhost:5173`

### Sesión se pierde al recargar
- Esto es normal, el localStorage debería persistir la sesión
- Si no, verifica la consola del navegador para errores

## 8. Próximas Funcionalidades

- [ ] Agregar validación de contraseña con bcrypt
- [ ] Agregar horas programables desde formulario
- [ ] Visualizar horas registradas en los horarios
- [ ] Drag & drop para asignar horas
- [ ] Exportar horarios a PDF/Excel
