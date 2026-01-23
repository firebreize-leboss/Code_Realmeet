// supabase/functions/send-push/index.ts
// Edge Function pour envoyer des notifications push via Expo

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushPayload {
  user_id: string
  title: string
  body: string
  data?: {
    type: 'message' | 'friend_request' | 'activity'
    conversationId?: string
    requestId?: string
    activityId?: string
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payload: PushPayload = await req.json()
    const { user_id, title, body, data } = payload

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, title, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Récupérer le token push de l'utilisateur
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('expo_push_token, notifications_enabled')
      .eq('id', user_id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!profile.notifications_enabled || !profile.expo_push_token) {
      console.log('Notifications disabled or no token for user:', user_id)
      return new Response(
        JSON.stringify({ success: false, reason: 'Notifications disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Envoyer la notification via Expo Push API
    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: profile.expo_push_token,
        sound: 'default',
        title,
        body,
        data: data || {},
        priority: 'high',
        channelId: 'default',
      }),
    })

    const pushResult = await pushResponse.json()
    console.log('Expo Push API response:', pushResult)

    // Vérifier si le token est invalide
    if (pushResult.data?.[0]?.status === 'error') {
      const errorType = pushResult.data[0].details?.error
      
      // Token invalide ou expiré -> le supprimer
      if (errorType === 'DeviceNotRegistered' || errorType === 'InvalidCredentials') {
        await supabase
          .from('profiles')
          .update({ expo_push_token: null, notifications_enabled: false })
          .eq('id', user_id)
        
        console.log('Invalid token removed for user:', user_id)
      }
    }

    return new Response(
      JSON.stringify({ success: true, result: pushResult }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-push function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})