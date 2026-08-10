import crypto from "node:crypto";

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
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
  const allowed = new Set();

  for (const raw of [process.env.URL, process.env.DEPLOY_PRIME_URL]) {
    if (!raw) continue;
    try {
      allowed.add(new URL(raw).origin);
    } catch {}
  }

  for (const raw of [supplied, request.headers.get("origin"), process.env.URL]) {
    if (!raw) continue;

    try {
      const u = new URL(raw);

      if (u.protocol !== "https:") continue;

      if (
        u.hostname.endsWith(".netlify.app") ||
        allowed.has(u.origin)
      ) {
        return u.origin;
      }
    } catch {}
  }

  if (process.env.URL) {
    return new URL(process.env.URL).origin;
  }

  throw new Error("No safe return origin available.");
}

function serviceAccount() {
  const b64 = env("FIREBASE_SERVICE_ACCOUNT_B64");

  let parsed;

  try {
    parsed = JSON.parse(
      Buffer.from(b64.trim(), "base64").toString("utf8")
    );
  } catch (error) {
    throw new Error(
      `Invalid FIREBASE_SERVICE_ACCOUNT_B64: ${error.message}`
    );
  }

  if (
    !parsed.project_id ||
    !parsed.client_email ||
    !parsed.private_key
  ) {
    throw new Error(
      "Service-account JSON is missing project_id, client_email or private_key."
    );
  }

  return parsed;
}

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

let cachedAccessToken = null;
let cachedAccessTokenExp = 0;

export async function getServiceAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  if (
    cachedAccessToken &&
    cachedAccessTokenExp - 60 > now
  ) {
    return cachedAccessToken;
  }

  const sa = serviceAccount();

  const header = b64url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
    })
  );

  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope:
        "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const unsigned = `${header}.${claims}`;

  const signature = crypto
    .sign(
      "RSA-SHA256",
      Buffer.from(unsigned),
      sa.private_key
    )
    .toString("base64url");

  const assertion = `${unsigned}.${signature}`;

  const res = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "content-type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type:
          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        "Could not obtain Google service access token."
    );
  }

  cachedAccessToken = data.access_token;
  cachedAccessTokenExp =
    now + Number(data.expires_in || 3600);

  return cachedAccessToken;
}

export async function verifyFirebaseUser(request) {
  const authz =
    request.headers.get("authorization") || "";

  if (!authz.startsWith("Bearer ")) {
    throw new Error(
      "Missing Firebase ID token."
    );
  }

  const idToken = authz.slice(7);
  const apiKey = env("FIREBASE_WEB_API_KEY");

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
      apiKey
    )}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        idToken,
      }),
    }
  );

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok || !data.users?.length) {
    throw new Error(
      data.error?.message ||
        "Invalid Firebase ID token."
    );
  }

  const u = data.users[0];

  if (u.disabled) {
    throw new Error(
      "Firebase user is disabled."
    );
  }

  return {
    uid: u.localId,
    email: u.email || "",
    emailVerified: !!u.emailVerified,
  };
}

function projectId() {
  return serviceAccount().project_id;
}

function docName(collection, id) {
  return `projects/${projectId()}/databases/(default)/documents/${collection}/${id}`;
}

function docUrl(collection, id) {
  return `https://firestore.googleapis.com/v1/${docName(
    collection,
    id
  )}`;
}

export function decodeValue(v) {
  if (!v) return null;

  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v)
    return !!v.booleanValue;
  if ("integerValue" in v)
    return Number(v.integerValue);
  if ("doubleValue" in v)
    return Number(v.doubleValue);
  if ("timestampValue" in v)
    return v.timestampValue;

  if ("arrayValue" in v) {
    return (v.arrayValue.values || []).map(
      decodeValue
    );
  }

  if ("mapValue" in v) {
    return decodeFields(
      v.mapValue.fields || {}
    );
  }

  return null;
}

export function decodeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(
      ([k, v]) => [k, decodeValue(v)]
    )
  );
}

export function encodeValue(v) {
  if (v === null || v === undefined) {
    return {
      nullValue: null,
    };
  }

  if (typeof v === "string") {
    return {
      stringValue: v,
    };
  }

  if (typeof v === "boolean") {
    return {
      booleanValue: v,
    };
  }

  if (typeof v === "number") {
    return Number.isInteger(v)
      ? {
          integerValue: String(v),
        }
      : {
          doubleValue: v,
        };
  }

  if (Array.isArray(v)) {
    return {
      arrayValue: {
        values: v.map(encodeValue),
      },
    };
  }

  if (v instanceof Date) {
    return {
      timestampValue: v.toISOString(),
    };
  }

  if (typeof v === "object") {
    return {
      mapValue: {
        fields: encodeFields(v),
      },
    };
  }

  return {
    stringValue: String(v),
  };
}

export function encodeFields(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [
        k,
        encodeValue(v),
      ])
  );
}

export async function getDocument(
  collection,
  id
) {
  const token =
    await getServiceAccessToken();

  const res = await fetch(
    docUrl(collection, id),
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    }
  );

  if (res.status === 404) {
    return null;
  }

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error?.message ||
        `Firestore get failed (${res.status}).`
    );
  }

  return {
    id,
    ...decodeFields(data.fields || {}),
  };
}

export function updateWrite(
  collection,
  id,
  fields,
  maskFields = null,
  precondition = null
) {
  const write = {
    update: {
      name: docName(collection, id),
      fields: encodeFields(fields),
    },
  };

  const mask =
    maskFields || Object.keys(fields);

  if (mask?.length) {
    write.updateMask = {
      fieldPaths: mask,
    };
  }

  if (precondition) {
    write.currentDocument =
      precondition;
  }

  return write;
}

export function transformServerTimestampWrite(
  collection,
  id,
  field = "updatedAt"
) {
  return {
    transform: {
      document: docName(collection, id),
      fieldTransforms: [
        {
          fieldPath: field,
          setToServerValue:
            "REQUEST_TIME",
        },
      ],
    },
  };
}

export async function commitWrites(
  writes
) {
  const token =
    await getServiceAccessToken();

  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents:commit`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type":
        "application/json",
    },
    body: JSON.stringify({
      writes,
    }),
  });

  const data = await res
    .json()
    .catch(() => ({}));

  if (!res.ok) {
    const error = new Error(
      data.error?.message ||
        `Firestore commit failed (${res.status}).`
    );

    error.status = res.status;

    throw error;
  }

  return data;
}
