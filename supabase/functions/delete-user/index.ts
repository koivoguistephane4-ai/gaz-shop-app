// supabase/functions/delete-user/index.ts
//
// Supprime un compte (auth.users → cascade sur profiles) — réservé à l'admin.
// Déploiement : npx supabase functions deploy delete-user --no-verify-jwt

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
    if (!authHeader) {
      return json({ error: 'Non authentifié.' }, 401)
    }

    const supabaseCaller = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: callerError } = await supabaseCaller.auth.getUser()
    if (callerError || !caller) {
      return json({ error: 'Session invalide.' }, 401)
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (profileError || callerProfile?.role !== 'admin') {
      return json({ error: 'Seul un administrateur peut supprimer un compte.' }, 403)
    }

    const { user_id } = await req.json()
    if (!user_id) {
      return json({ error: 'user_id manquant.' }, 400)
    }

    if (user_id === caller.id) {
      return json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, 400)
    }

    // Sécurité : empêche de supprimer le dernier compte admin restant
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user_id)
      .single()

    if (targetProfile?.role === 'admin') {
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')

      if ((count ?? 0) <= 1) {
        return json({ error: 'Impossible de supprimer le dernier compte administrateur.' }, 400)
      }
    }

    // Vérifie s'il existe un historique lié (ventes, rapports, réappros) qui empêcherait
    // une suppression propre — dans ce cas on désactive au lieu de supprimer, pour ne
    // jamais perdre la traçabilité de qui a fait quoi.
    const [{ count: salesCount }, { count: reportsCount }, { count: restockCount }] = await Promise.all([
      supabaseAdmin.from('sale_transactions').select('*', { count: 'exact', head: true }).eq('gerant_id', user_id),
      supabaseAdmin.from('daily_reports').select('*', { count: 'exact', head: true }).eq('gerant_id', user_id),
      supabaseAdmin.from('restock_entries').select('*', { count: 'exact', head: true }).eq('created_by', user_id),
    ])

    const hasHistory = (salesCount ?? 0) > 0 || (reportsCount ?? 0) > 0 || (restockCount ?? 0) > 0

    if (hasHistory) {
      // Désactivation : le compte ne peut plus se connecter, mais l'historique reste intact
      await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: '876000h' }) // ~100 ans
      const { error: deactivateError } = await supabaseAdmin
        .from('profiles')
        .update({ is_active: false })
        .eq('id', user_id)

      if (deactivateError) {
        return json({ error: `Désactivation échouée : ${deactivateError.message}` }, 400)
      }

      return json({ success: true, deactivated: true }, 200)
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

    if (deleteError) {
      return json({ error: `Suppression échouée : ${deleteError.message}` }, 400)
    }

    return json({ success: true, deactivated: false }, 200)

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
