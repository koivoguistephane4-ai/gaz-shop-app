// supabase/functions/create-user/index.ts
//
// Crée un compte (auth.users + profiles) — réservé à l'admin.
// Utilise la clé service_role, jamais exposée côté client.
// Déploiement : npx supabase functions deploy create-user

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
    // Client "admin" avec la clé service_role (variables auto-fournies par Supabase)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Client "appelant", construit à partir du token JWT de la requête,
    // pour vérifier QUI appelle cette fonction avant de faire quoi que ce soit.
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

    // Vérifie que l'appelant est bien admin (via service_role, donc RLS n'intervient pas ici,
    // il faut donc vérifier manuellement — c'est le point de sécurité central de cette fonction)
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (profileError || callerProfile?.role !== 'admin') {
      return json({ error: 'Seul un administrateur peut créer un compte.' }, 403)
    }

    // Lecture et validation des données envoyées
    const body = await req.json()
    const { email, password, nom, role, boutique_id } = body

    if (!email || !password || !nom || !role) {
      return json({ error: 'Champs requis manquants : email, password, nom, role.' }, 400)
    }

    if (!['admin', 'boss', 'gerant', 'sous_depot'].includes(role)) {
      return json({ error: 'Rôle invalide.' }, 400)
    }

    if ((role === 'gerant' || role === 'sous_depot') && !boutique_id) {
      return json({ error: 'Un gérant ou un sous-dépôt doit être rattaché à une boutique.' }, 400)
    }

    if (password.length < 8) {
      return json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, 400)
    }

    // 1. Création du compte d'authentification
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // pas de mail de confirmation à faire valider
    })

    if (createError || !created.user) {
      return json({ error: `Création du compte échouée : ${createError?.message}` }, 400)
    }

    // 2. Création du profil correspondant
    const { error: insertError } = await supabaseAdmin.from('profiles').insert({
      id: created.user.id,
      email,
      nom,
      role,
      boutique_id: (role === 'gerant' || role === 'sous_depot') ? boutique_id : null,
      created_by: caller.id,
    })

    if (insertError) {
      // Rollback : on supprime le compte auth si le profil n'a pas pu être créé,
      // pour éviter un compte "fantôme" sans profil
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
      return json({ error: `Création du profil échouée : ${insertError.message}` }, 400)
    }

    // 3. Si boss, assignation optionnelle de boutiques (tableau boutique_ids)
    if (role === 'boss' && Array.isArray(body.boutique_ids) && body.boutique_ids.length > 0) {
      const rows = body.boutique_ids.map((bid: string) => ({ boss_id: created.user.id, boutique_id: bid }))
      const { error: linkError } = await supabaseAdmin.from('boss_boutiques').insert(rows)
      if (linkError) {
        return json({ warning: `Compte créé, mais assignation des boutiques échouée : ${linkError.message}`, user_id: created.user.id }, 200)
      }
    }

    // 4. Si sous-dépôt, création automatique de sa fiche sous_depots liée au compte
    if (role === 'sous_depot') {
      const { error: sousDepotError } = await supabaseAdmin.from('sous_depots').insert({
        boutique_id,
        nom,
        telephone: body.telephone || null,
        profile_id: created.user.id,
        created_by: caller.id,
      })
      if (sousDepotError) {
        return json({ warning: `Compte créé, mais fiche sous-dépôt échouée : ${sousDepotError.message}`, user_id: created.user.id }, 200)
      }
    }

    return json({ success: true, user_id: created.user.id }, 200)

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
