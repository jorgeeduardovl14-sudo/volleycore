import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function getAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: env("FIREBASE_PROJECT_ID"),
        clientEmail: env("FIREBASE_CLIENT_EMAIL"),
        privateKey: env("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      }),
    });
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
