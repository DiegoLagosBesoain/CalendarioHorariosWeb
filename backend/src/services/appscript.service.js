import dotenv from "dotenv";
dotenv.config();

const APPSCRIPT_URL = process.env.APPSCRIPT_URL;
const API_KEY = process.env.APPSCRIPT_KEY;
const APPSCRIPT_TIMEOUT_MS = parseInt(process.env.APPSCRIPT_TIMEOUT_MS || "20000", 10);
const APPSCRIPT_RETRIES = parseInt(process.env.APPSCRIPT_RETRIES || "2", 10);

if (!APPSCRIPT_URL) {
  console.error('[APPSCRIPT] APPSCRIPT_URL no está definida en .env');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function construirMensajeErrorAppScript(error, url, intentos) {
  const causeCode = error?.cause?.code;
  const isTimeout = causeCode === 'UND_ERR_CONNECT_TIMEOUT' || error?.name === 'AbortError';

  let msg = `Error conectando con App Script tras ${intentos} intento(s): ${error.message}`;
  msg += ` | URL: ${url}`;

  if (isTimeout) {
    msg += ` | Timeout=${APPSCRIPT_TIMEOUT_MS}ms.`;
    msg += ' Si ejecutas el backend en WSL y desde WSL no hay salida HTTPS, prueba ejecutar el backend desde PowerShell/cmd de Windows o configura la red/proxy de WSL.';
  }

  return msg;
}

async function fetchConRetry(url, options = {}) {
  const maxIntentos = Number.isNaN(APPSCRIPT_RETRIES) ? 2 : Math.max(1, APPSCRIPT_RETRIES);
  let ultimoError = null;

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(APPSCRIPT_TIMEOUT_MS),
      });
      return response;
    } catch (err) {
      ultimoError = err;
      if (intento < maxIntentos) {
        await delay(300 * intento);
      }
    }
  }

  throw new Error(construirMensajeErrorAppScript(ultimoError, url, maxIntentos));
}

export async function callAppScript(action, params = {}) {
  const url = new URL(APPSCRIPT_URL);

  url.searchParams.append("action", action);
  url.searchParams.append("key", API_KEY);

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.append(k, v);
  }

  const response = await fetchConRetry(url.toString());
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

    const response = await fetchConRetry(url.toString(), {
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

    const response = await fetchConRetry(url.toString(), {
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