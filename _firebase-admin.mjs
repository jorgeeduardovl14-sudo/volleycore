import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function serviceAccountCredential() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) {
    let parsed;
    try {
      const json = Buffer.from(b64.trim(), "base64").toString("utf8");
      parsed = JSON.parse(json);
    } catch (error) {
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_B64: ${error.message}`);
    }
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is missing required service-account fields.");
    }
    return cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    });
  }

  return cert({
    projectId: env("FIREBASE_PROJECT_ID"),
    clientEmail: env("FIREBASE_CLIENT_EMAIL"),
    privateKey: env("FIREBASE_PRIVATE_KEY")
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n"),
  });
}

export function getAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: serviceAccountCredential() });
  }
  return { auth: getAuth(), db: getFirestore(), FieldValue, Timestamp };
}

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function safeOrigin(request, supplied) {
  const candidates = [supplied, request.headers.get("origin"), process.env.URL].filter(Boolean);
  for (const raw of candidates) {
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:") continue;
      if (u.hostname.endsWith(".netlify.app") || (process.env.URL && u.origin === new URL(process.env.URL).origin)) return u.origin;
    } catch {}
  }
  if (process.env.URL) return new URL(process.env.URL).origin;
  throw new Error("No safe return origin available.");
}

export async function verifyFirebaseUser(request) {
  const authz = request.headers.get("authorization") || "";
  if (!authz.startsWith("Bearer ")) throw new Error("Missing Firebase ID token.");
  const token = authz.slice(7);
  const { auth } = getAdmin();
  return auth.verifyIdToken(token);
}
