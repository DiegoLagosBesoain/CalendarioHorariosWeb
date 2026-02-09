import express from "express";
import { callAppScript } from "../services/appscript.service.js";

const router = express.Router();

router.get("/ping", async (req, res) => {
  try {
    const result = await callAppScript("ping");

    res.json({
      ok: true,
      appscript: result
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});
router.get("/master.list", async (req, res) => {
  try {
    const result = await callAppScript("master.list");

    res.json({
      ok: true,
      appscript: result
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

export default router;
