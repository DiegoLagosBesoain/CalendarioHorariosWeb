import fs from "fs";
import path from "path";
import pool from "./pool.js";

const sqlPath = path.resolve("sql/init.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

async function resetDB() {
  try {
    await pool.query("BEGIN");

    await pool.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
        LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    await pool.query(sql);

    await pool.query("COMMIT");
    console.log("♻️ Base de datos reiniciada");
    process.exit(0);
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Error reseteando DB", err);
    process.exit(1);
  }
}

resetDB();