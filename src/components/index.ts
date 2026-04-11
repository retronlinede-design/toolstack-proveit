import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { caseId } = await req.json()

    if (!caseId) {
      throw new Error('caseId is required')
    }

    // Initialize Supabase client with service role key for internal access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('PROVEIT_SUPABASE_SECRET_KEY') ?? ''
    )

    // Fetch the specific case snapshot from the database
    const { data, error } = await supabaseClient
      .from('cases')
      .select('snapshot')
      .eq('id', caseId)
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Case not found')
    }

    const { snapshot } = data;

    const importableCase = {
      id: snapshot?.case?.id || caseId,
      name: snapshot?.case?.name || 'Imported Case',
      category: snapshot?.case?.type || 'general',
      status: snapshot?.case?.status || 'open',
      notes: snapshot?.summary?.oneParagraph || '',
      description: '',
      tags: Array.isArray(snapshot?.keyFacts) ? snapshot.keyFacts : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evidence: Array.isArray(snapshot?.evidenceSummary)
        ? snapshot.evidenceSummary.map((item: any) => ({
            id: item.id,
            type: 'evidence',
            title: item.title || '',
            date: new Date().toISOString().slice(0, 10),
            description: item.description || '',
            notes: item.notes || '',
            attachments: [],
            tags: [],
            linkedRecordIds: [],
            linkedIncidentIds: [],
            linkedEvidenceIds: [],
            status: item.status || 'needs_review',
            source: 'manual',
            edited: false,
            sourceType: item.sourceType || 'other',
            capturedAt: new Date().toISOString().slice(0, 10),
            importance: item.importance || 'unreviewed',
            relevance: item.relevance || 'medium',
            usedIn: [],
            reviewNotes: '',
            availability: {
              physical: { hasOriginal: false, location: '', notes: '' },
              digital: { hasDigital: false, files: [] }
            }
          }))
        : [],
      incidents: Array.isArray(snapshot?.recentIncidents)
        ? snapshot.recentIncidents.map((item: any) => ({
            id: item.id,
            type: 'incidents',
            title: item.title || '',
            date: item.date || new Date().toISOString().slice(0, 10),
            description: item.description || '',
            notes: '',
            attachments: [],
            tags: [],
            linkedRecordIds: [],
            linkedIncidentIds: [],
            linkedEvidenceIds: [],
            status: item.status || 'open',
            source: 'manual',
            edited: false
          }))
        : [],
      tasks: Array.isArray(snapshot?.openTasks)
        ? snapshot.openTasks.map((item: any) => ({
            id: item.id,
            type: 'tasks',
            title: item.title || '',
            date: new Date().toISOString().slice(0, 10),
            description: item.description || '',
            notes: '',
            attachments: [],
            tags: [],
            linkedRecordIds: [],
            linkedIncidentIds: [],
            linkedEvidenceIds: [],
            status: item.status || 'open',
            source: 'manual',
            edited: false,
            priority: item.priority || 'medium'
          }))
        : [],
      strategy: Array.isArray(snapshot?.strategy)
        ? snapshot.strategy.map((item: any) => ({
            id: item.id,
            type: 'strategy',
            title: item.title || '',
            date: new Date().toISOString().slice(0, 10),
            description: item.description || '',
            notes: '',
            attachments: [],
            tags: [],
            linkedRecordIds: [],
            linkedIncidentIds: [],
            linkedEvidenceIds: [],
            status: item.status || 'open',
            source: 'manual',
            edited: false
          }))
        : [],
    };

    const exportJson = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      app: 'proveit',
      storageKey: 'toolstack.proveit.v1',
      data: {
        cases: [importableCase],
        quickCaptures: [],
        selectedCaseId: caseId,
        activeTab: 'cases',
      },
    }

    return new Response(
      JSON.stringify(exportJson),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})