// Vercel serverless function: sends a complaint PDF as an email attachment via Microsoft Graph.
// Requires env vars:
//   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET   (Azure AD app credentials, app needs Mail.Send permission)
//   MS_SENDER_EMAIL                                 (real M365 mailbox the email is sent from, e.g. qa@yourdomain.com)

export const config = { runtime: 'edge' };

// Vercel Edge runtime: process.env is available but Node types aren't loaded by Vercel's type checker.
declare const process: { env: Record<string, string | undefined> };

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getGraphToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    throw new Error('Missing Azure AD env vars.');
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

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

interface SendBody {
  to: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  pdfBase64: string;
  filename: string;
  complaintNo?: string;
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  try {
    const body = (await req.json()) as SendBody;
    const { to, cc, subject, bodyText, pdfBase64, filename } = body;

    if (!to || to.length === 0) return Response.json({ error: 'No recipient' }, { status: 400, headers: cors });
    if (!pdfBase64) return Response.json({ error: 'No PDF attachment' }, { status: 400, headers: cors });

    const { MS_SENDER_EMAIL } = process.env;
    if (!MS_SENDER_EMAIL) {
      return Response.json({ error: 'Missing MS_SENDER_EMAIL env var (mailbox to send from)' }, { status: 500, headers: cors });
    }

    const token = await getGraphToken();

    const message = {
      message: {
        subject,
        body: { contentType: 'Text', content: bodyText },
        toRecipients: to.map(addr => ({ emailAddress: { address: addr } })),
        ...(cc && cc.length > 0 ? { ccRecipients: cc.map(addr => ({ emailAddress: { address: addr } })) } : {}),
        attachments: [{
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: filename,
          contentType: 'application/pdf',
          contentBytes: pdfBase64,
        }],
      },
      saveToSentItems: true,
    };

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_SENDER_EMAIL)}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      return Response.json({ error: `Graph sendMail failed: ${res.status}`, detail: errBody }, { status: 502, headers: cors });
    }

    return Response.json({ ok: true }, { headers: cors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500, headers: cors });
  }
}
