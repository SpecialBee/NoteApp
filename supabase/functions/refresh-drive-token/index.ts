// Mints a fresh Google Drive access token from the caller's stored refresh token. Drive access
// tokens expire in ~1hr, and the refresh token + client secret must never reach the browser, so
// this exchange has to happen server-side. Deploy via the Supabase Dashboard: Edge Functions ->
// New Function -> name it "refresh-drive-token" -> paste this file's contents.
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided automatically by the
// Edge Functions runtime. GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are NOT automatic — set them
// yourself under Edge Functions -> Secrets (same client id/secret registered in Google Cloud
// Console and Supabase Auth's Google provider).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: '인증이 필요합니다.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  // verify the caller's JWT (anon-scoped client, so it only proves who's asking — no admin power)
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(401, { error: '유효하지 않은 세션입니다.' });

  // the refresh token has no select policy for the client (see schema.sql) — only this
  // service-role client can read it back out
  const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: row, error: rowError } = await adminClient
    .from('user_drive_tokens')
    .select('refresh_token')
    .eq('user_id', user.id)
    .single();
  if (rowError || !row) return json(400, { error: '구글 드라이브가 연결되어 있지 않습니다.' });

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) return json(500, { error: '서버에 구글 클라이언트 설정이 없습니다.' });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    // a revoked/expired refresh token shows up here (e.g. user removed app access in their
    // Google account) — surface it distinctly so the client can prompt to reconnect instead of
    // just showing a generic upload failure
    return json(400, { error: tokenData.error_description || tokenData.error || '토큰 갱신 실패', needsReconnect: true });
  }

  return json(200, { access_token: tokenData.access_token, expires_in: tokenData.expires_in });
});
