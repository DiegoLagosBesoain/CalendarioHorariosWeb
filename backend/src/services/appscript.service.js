import dotenv from "dotenv";
dotenv.config();
const APPSCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxUsU---EwNE6rl-ukONrO8tnt_84A4JI1m9Xa8OTq04GwkNBHW41Ztkr1azOD37Ttp/exec";

const API_KEY = process.env.APPSCRIPT_KEY;

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