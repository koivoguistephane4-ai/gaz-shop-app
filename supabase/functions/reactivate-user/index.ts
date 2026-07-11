// supabase/functions/reactivate-user/index.ts
// Déploiement : npx supabase functions deploy reactivate-user --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Non authentifié.' }, 401)

    const supabaseCaller = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: callerError } = await supabaseCaller.auth.getUser()
    if (callerError || !caller) return json({ error: 'Session invalide.' }, 401)

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', caller.id).single()

    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Seul un administrateur peut réactiver un compte.' }, 403)
    }

    const { user_id } = await req.json()
    if (!user_id) return json({ error: 'user_id manquant.' }, 400)

    await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: 'none' })

    const { error: updateError } = await supabaseAdmin
      .from('profiles').update({ is_active: true }).eq('id', user_id)

    if (updateError) return json({ error: updateError.message }, 400)

    return json({ success: true }, 200)

  } catch (err) {
    return json({ error: `Erreur serveur : ${err.message}` }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
