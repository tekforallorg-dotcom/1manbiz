// Base URL for the 1man.biz web app: API routes (/api/...), the customer pay
// page (/pay/...), and receipts (/r/...). Override per environment by setting
// EXPO_PUBLIC_API_BASE_URL; otherwise falls back to the production deployment.
// Trailing slashes are stripped so callers can safely concatenate "/path".

const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;

export const API_BASE_URL = (
  fromEnv && fromEnv.trim() ? fromEnv.trim() : "https://1manbiz.vercel.app"
).replace(/\/+$/, "");
