// Vercel serverless function: receives a photo upload, forwards to SharePoint via Microsoft Graph.
// Requires env vars:
//   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET   (Azure AD app credentials)
//   SHAREPOINT_HOSTNAME       e.g. yourcompany.sharepoint.com
//   SHAREPOINT_SITE_PATH      e.g. sites/qa-team           (path part of the SharePoint URL)
//   SHAREPOINT_FOLDER_PATH    e.g. Complaint Photos        (folder inside the default Documents library)

export const config = { runtime: 'nodejs' };

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB to stay under Vercel's body limit

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getGraphToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    throw new Error('Missing Azure AD env vars (MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET).');
  }

  const res = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

function sanitize(name: string): string {
  return name.replace(/[^\w.\- ]/g, '_').slice(0, 120);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const refNo = (form.get('refNo') as string | null) ?? 'untagged';

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400, headers: cors });
    }
    if (!file.type.startsWith('image/')) {
      return Response.json({ error: 'Only image files are allowed' }, { status: 400, headers: cors });
    }
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: 'File exceeds 4 MB limit' }, { status: 400, headers: cors });
    }

    const { SHAREPOINT_HOSTNAME, SHAREPOINT_SITE_PATH, SHAREPOINT_FOLDER_PATH } = process.env;
    if (!SHAREPOINT_HOSTNAME || !SHAREPOINT_SITE_PATH || !SHAREPOINT_FOLDER_PATH) {
      throw new Error('Missing SharePoint env vars.');
    }

    const token = await getGraphToken();

    // Resolve site -> drive -> upload path
    // PUT /sites/{host}:/{site-path}:/drive/root:/{folder}/{ref-no}/{filename}:/content
    const safeRef = sanitize(refNo);
    const safeName = sanitize(file.name);
    const folder = SHAREPOINT_FOLDER_PATH.replace(/^\/+|\/+$/g, '');
    const sitePath = SHAREPOINT_SITE_PATH.replace(/^\/+|\/+$/g, '');
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_HOSTNAME}:/${sitePath}:/drive/root:/${encodeURIComponent(folder)}/${encodeURIComponent(safeRef)}/${encodeURIComponent(safeName)}:/content`;

    const bytes = await file.arrayBuffer();
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: bytes,
    });

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      return Response.json(
        { error: `Graph upload failed: ${uploadRes.status}`, detail: errBody },
        { status: 502, headers: cors },
      );
    }

    const item = (await uploadRes.json()) as { id: string; name: string; webUrl: string; size: number };

    return Response.json({
      id: item.id,
      name: item.name,
      webUrl: item.webUrl,
      size: item.size,
    }, { headers: cors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500, headers: cors });
  }
}
