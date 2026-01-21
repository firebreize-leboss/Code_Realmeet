import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id
    console.log('Deleting account for user:', userId)

    // 1. Supprimer fichiers Storage
    for (const bucket of ['avatars', 'chat-images', 'voice-messages']) {
      try {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list(userId)
        if (files?.length) {
          await supabaseAdmin.storage.from(bucket).remove(files.map(f => `${userId}/${f.name}`))
        }
      } catch (e) { console.log(`Storage ${bucket}:`, e) }
    }

    // 2. Anonymiser messages
    await supabaseAdmin.from('messages').update({
      content: '[Message supprimé]',
      media_url: null,
      deleted_at: new Date().toISOString(),
    }).eq('sender_id', userId)

    // 3. Nettoyer les tables liées
    await supabaseAdmin.from('slot_participants').delete().eq('user_id', userId)
    await supabaseAdmin.from('friend_requests').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    await supabaseAdmin.from('friendships').delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    await supabaseAdmin.from('blocked_users').delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
    await supabaseAdmin.from('reports').delete().eq('reporter_id', userId)
    await supabaseAdmin.from('conversation_participants').delete().eq('user_id', userId)

    // 4. Supprimer l'utilisateur auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (deleteError) {
      console.error('Delete error:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete account', details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Account deleted:', userId)
    return new Response(
      JSON.stringify({ deleted: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})