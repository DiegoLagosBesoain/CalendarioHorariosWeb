import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sheetsRoutes from "./routes/sheets.routes.js";
dotenv.config();
const app = express();
const PORT = process.env.PORT ;
app.use(cors());
app.use("/api/sheets", sheetsRoutes);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend funcionando 🚀");
});
app.get("/api/saludo", (req, res) => {
  res.json({ mensaje: "Hola desde Express 👋" });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});