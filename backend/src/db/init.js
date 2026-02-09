import fs from "fs";
import path from "path";
import pool from "./pool.js";

const sqlPath = path.resolve("sql/init.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

async function initDB() {
  try {
    await pool.query(sql);
    console.log("✅ init.sql ejecutado correctamente");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error ejecutando init.sql");
    console.error(err);
    process.exit(1);
  }
}

initDB();