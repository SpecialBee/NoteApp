// Deletes the calling user's own auth account. Must run with the service-role key (the anon
// key can't delete auth users), so this can't live in the client — it's a Supabase Edge
// Function instead. Deploy via the Supabase Dashboard: Edge Functions -> New Function ->
// name it "delete-account" -> paste this file's contents.
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// the Edge Functions runtime — no manual secrets setup needed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  // verify the caller's JWT (anon-scoped client, so it only proves who's asking — no admin power)
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: '유효하지 않은 세션입니다.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // delete the account with the service-role client — cascades to notes/checklist_items
  // automatically via their `on delete cascade` foreign key to auth.users
  const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
