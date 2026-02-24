// supabase/functions/form-groups-cron/index.ts
// Edge Function appelée par cron pour former automatiquement les groupes 24h avant les créneaux

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date()
    
    // Calculer la fenêtre : créneaux entre maintenant et dans 24h
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    
    // Trouver tous les créneaux qui :
    // 1. Sont dans les 24 prochaines heures
    // 2. N'ont pas encore de groupes formés
    const { data: slotsToProcess, error: slotsError } = await supabase
      .from('activity_slots')
      .select(`
        id,
        activity_id,
        date,
        time,
        max_groups,
        participants_per_group,
        groups_formed
      `)
      .eq('groups_formed', false)
      .gte('date', now.toISOString().split('T')[0])
      .lte('date', in24h.toISOString().split('T')[0])

    if (slotsError) {
      console.error('Erreur récupération créneaux:', slotsError)
      throw slotsError
    }

    console.log(`Créneaux à vérifier: ${slotsToProcess?.length || 0}`)

    const results: { slotId: string; success: boolean; groupsCreated?: number; error?: string }[] = []

    for (const slot of slotsToProcess || []) {
      try {
        // Vérifier si le créneau est bien dans les 24h
        const slotDateTime = new Date(`${slot.date}T${slot.time || '00:00'}`)
        const oneDayBefore = new Date(slotDateTime.getTime() - 24 * 60 * 60 * 1000)
        
        if (now < oneDayBefore || now >= slotDateTime) {
          // Pas encore J-1 ou créneau déjà passé
          continue
        }

        // Vérifier le nombre de participants
        const { count: participantCount } = await supabase
          .from('slot_participants')
          .select('*', { count: 'exact', head: true })
          .eq('slot_id', slot.id)
          .eq('status', 'active')

        if (!participantCount || participantCount === 0) {
          console.log(`Slot ${slot.id}: aucun participant, skip`)
          // Marquer quand même comme formé pour éviter de revérifier
          await supabase
            .from('activity_slots')
            .update({ groups_formed: true, groups_formed_at: new Date().toISOString() })
            .eq('id', slot.id)
          continue
        }

        console.log(`Slot ${slot.id}: ${participantCount} participants, formation des groupes...`)

        // Former les groupes
        const groupResult = await formGroups(supabase, slot, participantCount)
        
        results.push({
          slotId: slot.id,
          success: true,
          groupsCreated: groupResult.groupCount,
        })

      } catch (error: any) {
        console.error(`Erreur slot ${slot.id}:`, error)
        results.push({
          slotId: slot.id,
          success: false,
          error: error.message,
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('Erreur globale:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Fonction pour former les groupes d'un créneau
async function formGroups(
  supabase: any, 
  slot: any, 
  participantCount: number
): Promise<{ groupCount: number }> {
  
  const maxGroups = slot.max_groups || 1
  const participantsPerGroup = slot.participants_per_group

  // 1. Récupérer les participants avec leurs profils
  const { data: participants, error: participantsError } = await supabase
    .from('slot_participants')
    .select(`
      user_id,
      profiles:user_id (
        id,
        full_name,
        personality_tags,
        interests,
        avatar_url
      )
    `)
    .eq('slot_id', slot.id)
    .eq('status', 'active')

  if (participantsError) throw participantsError

  const participantProfiles = participants
    .map((p: any) => ({
      id: p.profiles?.id || p.user_id,
      full_name: p.profiles?.full_name || 'Participant',
      personality_tags: p.profiles?.personality_tags || [],
      interests: p.profiles?.interests || [],
      avatar_url: p.profiles?.avatar_url || '',
    }))
    .filter((p: any) => p.id)

  // 2. Calculer la distribution
  const idealGroupSize = participantsPerGroup || Math.ceil(participantProfiles.length / maxGroups)
  const actualGroupCount = Math.min(
    maxGroups,
    Math.ceil(participantProfiles.length / Math.max(idealGroupSize, 1))
  )

  // 3. Distribution simple (round-robin)
  const groups: any[][] = Array.from({ length: actualGroupCount }, () => [])
  
  participantProfiles.forEach((participant: any, index: number) => {
    const groupIndex = index % actualGroupCount
    groups[groupIndex].push(participant)
  })

  // 4. Nettoyer les anciens groupes (si existants)
  const { data: existingGroups } = await supabase
    .from('slot_groups')
    .select('id')
    .eq('slot_id', slot.id)

  if (existingGroups && existingGroups.length > 0) {
    const groupIds = existingGroups.map((g: any) => g.id)
    
    await supabase
      .from('slot_group_members')
      .delete()
      .in('group_id', groupIds)

    await supabase
      .from('slot_groups')
      .delete()
      .eq('slot_id', slot.id)
  }

  // 5. Créer les nouveaux groupes
  const groupsToInsert = groups.map((_, index) => ({
    slot_id: slot.id,
    activity_id: slot.activity_id,
    group_number: index + 1,
    group_name: `Groupe ${index + 1}`,
  }))

  const { data: createdGroups, error: groupsError } = await supabase
    .from('slot_groups')
    .insert(groupsToInsert)
    .select()

  if (groupsError) throw groupsError

  // 6. Assigner les membres
  const membersToInsert: any[] = []
  groups.forEach((group, groupIndex) => {
    const groupId = createdGroups[groupIndex].id
    group.forEach((member: any) => {
      membersToInsert.push({
        group_id: groupId,
        user_id: member.id,
        compatibility_score: 0.5,
      })
    })
  })

  await supabase.from('slot_group_members').insert(membersToInsert)

  // 7. Marquer le créneau comme formé
  await supabase
    .from('activity_slots')
    .update({
      groups_formed: true,
      groups_formed_at: new Date().toISOString(),
    })
    .eq('id', slot.id)

  // 8. Créer les conversations de groupe
  const { data: activity } = await supabase
    .from('activities')
    .select('nom, image_url')
    .eq('id', slot.activity_id)
    .single()

  for (const group of createdGroups) {
    // Créer la conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        slot_id: slot.id,
        name: `${activity?.nom || 'Activité'} - ${group.group_name}`,
        image_url: activity?.image_url || '',
        is_group: true,
      })
      .select()
      .single()

    if (convError) {
      console.error('Erreur création conversation:', convError)
      continue
    }

    // Récupérer les membres du groupe
    const { data: members } = await supabase
      .from('slot_group_members')
      .select('user_id')
      .eq('group_id', group.id)

    if (!members || members.length === 0) continue

    // Ajouter les participants
    const participantsToInsert = members.map((m: any) => ({
      conversation_id: conversation.id,
      user_id: m.user_id,
    }))

    await supabase
      .from('conversation_participants')
      .insert(participantsToInsert)

    // Mettre à jour le groupe avec l'ID de la conversation
    await supabase
      .from('slot_groups')
      .update({ conversation_id: conversation.id })
      .eq('id', group.id)

    // Message système
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: members[0].user_id,
      content: `🎉 Groupe créé automatiquement avec ${members.length} participant${members.length > 1 ? 's' : ''}. L'activité commence dans moins de 24h !`,
      message_type: 'system',
    })
  }

  return { groupCount: createdGroups.length }
}