import dotenv from "dotenv";
dotenv.config();

const APPSCRIPT_URL = process.env.APPSCRIPT_URL;
const API_KEY = process.env.APPSCRIPT_KEY;

if (!APPSCRIPT_URL) {
  console.error('[APPSCRIPT] APPSCRIPT_URL no está definida en .env');
}

export async function callAppScript(action, params = {}) {
  const url = new URL(APPSCRIPT_URL);

  url.searchParams.append("action", action);
  url.searchParams.append("key", API_KEY);

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.append(k, v);
  }

  const response = await fetch(url.toString());
  const text = await response.text();

  return text;
}

/**
 * Enviar diccionario de horarios a Google Sheets
 * Realiza un POST request a Google Apps Script con el JSON del diccionario
 */
export async function enviarDiccionarioASheets(diccionario) {
  try {
    const url = new URL(APPSCRIPT_URL);
    url.searchParams.append("action", "sheet.escribir");
    url.searchParams.append("key", API_KEY);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diccionario)
    });

    if (!response.ok) {
      throw new Error(`Google Sheets error: ${response.statusText}`);
    }

    const resultado = await response.json();
    return resultado;
  } catch (err) {
    throw new Error(`Error enviando diccionario a Google Sheets: ${err.message}`);
  }
}

/**
 * Enviar diccionario de pruebas/fechas a Google Sheets
 */
export async function enviarPruebasASheets(diccionario) {
  try {
    const url = new URL(APPSCRIPT_URL);
    url.searchParams.append("action", "pruebas.fechas");
    url.searchParams.append("key", API_KEY);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diccionario)
    });

    if (!response.ok) {
      throw new Error(`Google Sheets error: ${response.statusText}`);
    }

    const resultado = await response.json();
    return resultado;
  } catch (err) {
    throw new Error(`Error enviando pruebas a Google Sheets: ${err.message}`);
  }
}