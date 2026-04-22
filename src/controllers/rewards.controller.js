/**
 * Vetgo Rewards: puntos y nivel para dueños.
 */

const TIER_ORDER = ['bronze', 'silver', 'gold'];

function tierFromPoints(points) {
  const p = Number(points) || 0;
  if (p >= 1500) return 'gold';
  if (p >= 500) return 'silver';
  return 'bronze';
}

function tierLabelDb(tier) {
  const labels = { bronze: 'Bronce', silver: 'Plata', gold: 'Oro' };
  return labels[tier] ?? tier;
}

async function getMyRewards(req, res) {
  try {
    const ownerId = req.user.id;

    let { data, error } = await req.supabase.from('rewards').select('*').eq('owner_id', ownerId).maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    if (!data) {
      const insertRow = { owner_id: ownerId, points: 0, tier: 'bronze' };
      const inserted = await req.supabase.from('rewards').insert(insertRow).select().single();
      if (inserted.error) {
        return res.status(400).json({ error: inserted.error.message, details: inserted.error });
      }
      data = inserted.data;
    }

    const tier = data.tier;
    return res.json({
      ...data,
      tier_label: tierLabelDb(tier),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load rewards', details: err.message });
  }
}

async function addRewardsPoints(req, res) {
  try {
    const { owner_id: ownerId, points: pointsRaw } = req.body;

    if (!ownerId) {
      return res.status(400).json({ error: 'owner_id is required' });
    }

    const delta = Number(pointsRaw);
    if (!Number.isFinite(delta) || delta <= 0 || !Number.isInteger(delta)) {
      return res.status(400).json({ error: 'points must be a positive integer' });
    }

    const { data: existing, error: fetchError } = await req.supabase
      .from('rewards')
      .select('owner_id, points, tier')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (fetchError) {
      return res.status(400).json({ error: fetchError.message, details: fetchError });
    }

    const nextPoints = (existing?.points ?? 0) + delta;
    const nextTier = tierFromPoints(nextPoints);

    const payload = {
      owner_id: ownerId,
      points: nextPoints,
      tier: TIER_ORDER.includes(nextTier) ? nextTier : 'bronze',
    };

    const { data, error } = await req.supabase
      .from('rewards')
      .upsert(payload, { onConflict: 'owner_id' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message, details: error });
    }

    return res.status(200).json({
      ...data,
      tier_label: tierLabelDb(data.tier),
      caller: req.rewardsCaller ?? 'unknown',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add rewards points', details: err.message });
  }
}

module.exports = { getMyRewards, addRewardsPoints };
