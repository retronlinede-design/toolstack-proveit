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
    const snapshotData = snapshot?.data || snapshot || {};
    const today = new Date().toISOString().slice(0, 10);
    const incidentSource = Array.isArray(snapshotData?.incidentSummary) && snapshotData.incidentSummary.length > 0
      ? snapshotData.incidentSummary
      : Array.isArray(snapshotData?.recentTimeline)
        ? snapshotData.recentTimeline.filter((item: any) => String(item?.type || '').toLowerCase().includes('incident'))
        : [];
    const strategyCurrent = Array.isArray(snapshotData?.strategy?.current)
      ? snapshotData.strategy.current
      : Array.isArray(snapshotData?.strategy)
        ? snapshotData.strategy
        : [];

    const importableCase = {
      id: snapshotData?.case?.id || caseId,
      name: snapshotData?.case?.name || 'Imported Case',
      category: snapshotData?.case?.category || snapshotData?.case?.type || 'general',
      status: snapshotData?.case?.status || 'open',
      notes: snapshotData?.summary?.oneParagraph || '',
      description: '',
      tags: Array.isArray(snapshotData?.keyFacts) ? snapshotData.keyFacts : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      actionSummary: snapshotData?.actionSummary || undefined,
      caseState: snapshotData?.caseState || undefined,
      riskSummary: Array.isArray(snapshotData?.riskSummary) ? snapshotData.riskSummary : [],
      leveragePoints: Array.isArray(snapshotData?.leveragePoints) ? snapshotData.leveragePoints : [],
      activeIssues: Array.isArray(snapshotData?.activeIssues) ? snapshotData.activeIssues : [],
      recentTimeline: Array.isArray(snapshotData?.recentTimeline) ? snapshotData.recentTimeline : [],
      evidence: Array.isArray(snapshotData?.evidenceSummary)
        ? snapshotData.evidenceSummary.map((item: any) => ({
            id: item.id,
            type: 'evidence',
            title: item.title || '',
            date: today,
            description: item.summary || item.description || '',
            notes: '',
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
      incidents: incidentSource.map((item: any) => ({
            id: item.id,
            type: 'incidents',
            title: item.title || '',
            date: item.date || today,
            description: item.summary || item.description || '',
            notes: '',
            attachments: [],
            tags: [],
            linkedRecordIds: [],
            linkedIncidentIds: [],
            linkedEvidenceIds: Array.isArray(item.linkedEvidenceIds) ? item.linkedEvidenceIds : [],
            status: item.status || 'open',
            source: 'manual',
            edited: false
          })),
      tasks: Array.isArray(snapshotData?.openTasks)
        ? snapshotData.openTasks.map((item: any) => ({
            id: item.id,
            type: 'tasks',
            title: item.title || '',
            date: today,
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
      strategy: strategyCurrent.map((item: any) => {
            const strategyItem = item && typeof item === 'object' ? item : {};
            const strategyTitle = typeof item === 'string' ? item : strategyItem.title || '';
            return {
            id: strategyItem.id || crypto.randomUUID(),
            type: 'strategy',
            title: strategyTitle,
            date: strategyItem.date || today,
            description: strategyItem.summary || strategyItem.description || '',
            notes: '',
            attachments: [],
            tags: [],
            linkedRecordIds: Array.isArray(strategyItem.linkedRecordIds) ? strategyItem.linkedRecordIds : [],
            linkedIncidentIds: [],
            linkedEvidenceIds: [],
            status: strategyItem.status || 'open',
            source: 'manual',
            edited: false
          };
          }),
      documents: Array.isArray(snapshotData?.documentSummary)
        ? snapshotData.documentSummary.map((item: any) => ({
            id: item.id,
            title: item.title || '',
            category: item.category || 'other',
            documentDate: item.documentDate || '',
            source: item.source || '',
            summary: item.summary || '',
            textContent: '',
            attachments: [],
            linkedRecordIds: Array.isArray(item.linkedRecordIds) ? item.linkedRecordIds : [],
            edited: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
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
