import express from "express";
import cors from "cors";
import sheetsRoutes from "./src/routes/sheets.routes.js";
import healthRoutes from "./src/routes/health.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import usersRoutes from "./src/routes/users.routes.js";
import dashboardsRoutes from "./src/routes/dashboards.routes.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health check
app.use("/api/health", healthRoutes);

// Autenticación
app.use("/api/auth", authRoutes);

// Usuarios
app.use("/api/users", usersRoutes);

// Dashboards
app.use("/api/dashboards", dashboardsRoutes);

// Legacy routes
app.use("/api/sheets", sheetsRoutes);

app.get("/", (req, res) => {
  res.send("Backend funcionando 🚀");
});

app.get("/api/saludo", (req, res) => {
  res.json({ mensaje: "Hola desde Express 👋" });
});

export default app;
