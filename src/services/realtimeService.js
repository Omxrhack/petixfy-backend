const { createClient } = require('@supabase/supabase-js');

let supabaseRealtimeClient = null;
let emergenciesChannel = null;

function createRealtimeClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.warn('[realtime] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing, listener skipped');
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function startRealtimeListeners() {
  if (emergenciesChannel) {
    return;
  }

  supabaseRealtimeClient = createRealtimeClient();
  if (!supabaseRealtimeClient) {
    return;
  }

  emergenciesChannel = supabaseRealtimeClient
    .channel('emergencies-insert-listener')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'emergencies' },
      (payload) => {
        const row = payload.new || {};
        console.log(
          JSON.stringify({
            type: 'realtime.emergency.insert',
            event: payload.eventType,
            schema: payload.schema,
            table: payload.table,
            id: row.id,
            pet_id: row.pet_id,
            created_at: row.created_at,
            received_at: new Date().toISOString(),
          }),
        );
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[realtime] emergencies listener subscribed');
      }
    });
}

async function stopRealtimeListeners() {
  if (!supabaseRealtimeClient || !emergenciesChannel) {
    return;
  }

  await supabaseRealtimeClient.removeChannel(emergenciesChannel);
  emergenciesChannel = null;
}

module.exports = { startRealtimeListeners, stopRealtimeListeners };
