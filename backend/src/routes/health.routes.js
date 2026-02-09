import express from "express";
import pool from "../db/pool.js";

const router = express.Router();

router.get("/db", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "connected" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;