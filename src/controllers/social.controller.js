const { createSupabaseServiceRoleClient } = require('../lib/supabaseServiceRole');
const {
  followSchema,
  createPostSchema,
  createRepostSchema,
  createReviewSchema,
  updateProfileSchema,
  createPostCommentSchema,
} = require('../schemas/social.schema');

// Returns true when the error is "table not yet migrated" (schema cache miss)
function _isMissingTable(error) {
  if (!error) return false;
  const msg = [error.message, error.details, error.hint].filter(Boolean).join(' ');
  return (
    msg.includes('schema cache')
    || msg.includes('Could not find')
    || msg.includes('does not exist')
  );
}

async function _optionalUserIdFromReq(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    const { createSupabaseClientWithJwt } = require('../lib/supabaseUserClient');
    const userClient = createSupabaseClientWithJwt(token);
    const { data: { user } } = await userClient.auth.getUser();
    return user?.id ?? null;
  } catch (_) {
    return null;
  }
}

/** Enriquece `{ post }` de cada entrada con conteos / flags del visor (explore y fallbacks). */
async function _mergeEngagementForPosts(req, entries) {
  const me = req.user?.id;
  if (!me || !Array.isArray(entries) || !entries.length) return;
  const ids = [...new Set(entries.map((e) => e.post?.id).filter(Boolean))];
  if (!ids.length) return;
  const { data, error } = await req.supabase.rpc('post_engagement_batch', {
    p_viewer: me,
    p_post_ids: ids,
  });
  if (error || !Array.isArray(data)) return;
  const map = new Map(data.map((row) => [row.post_id, row]));
  for (const e of entries) {
    const pid = e.post?.id;
    if (!pid || !e.post) continue;
    const row = map.get(pid);
    if (!row) continue;
    e.post = {
      ...e.post,
      like_count: row.like_count,
      comment_count: row.comment_count,
      viewer_has_liked: row.viewer_has_liked,
      repost_count: row.repost_count,
      viewer_has_reposted: row.viewer_has_reposted,
    };
  }
}

// ─── Public profile ──────────────────────────────────────────────────────────

async function getProfile(req, res) {
  try {
    const { id } = req.params;
    const service = createSupabaseServiceRoleClient();

    const { data: profile, error: profileErr } = await service
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .eq('id', id)
      .maybeSingle();

    // bio & location require migration 001_social_module.sql — fetch separately so missing columns don't crash the endpoint
    let bio = null;
    let location = null;
    try {
      const { data: extra } = await service
        .from('profiles')
        .select('bio, location')
        .eq('id', id)
        .maybeSingle();
      if (extra) {
        bio = extra.bio ?? null;
        location = extra.location ?? null;
      }
    } catch (_) { /* columns not yet migrated */ }

    if (profileErr) return res.status(400).json({ error: profileErr.message });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Follower / following counts — requires migration (tables may not exist yet)
    let followersCount = 0;
    let followingCount = 0;
    let isFollowing = false;
    try {
      const [f1, f2] = await Promise.all([
        service.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
        service.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
      ]);
      followersCount = f1.count ?? 0;
      followingCount = f2.count ?? 0;

      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length).trim();
        if (token) {
          const { createSupabaseClientWithJwt } = require('../lib/supabaseUserClient');
          const userClient = createSupabaseClientWithJwt(token);
          const { data: { user } } = await userClient.auth.getUser();
          if (user) {
            const { data: follow } = await service
              .from('follows')
              .select('id')
              .eq('follower_id', user.id)
              .eq('following_id', id)
              .maybeSingle();
            isFollowing = !!follow;
          }
        }
      }
    } catch (_) { /* follows table not yet migrated */ }

    let vetData = null;
    if (profile.role === 'vet') {
      // vet_services always exists; reviews/posts require migration
      const { data: vetService } = await service
        .from('vet_services')
        .select('specialty, years_experience')
        .eq('profile_id', id)
        .maybeSingle();

      const { count: completedAppts } = await service
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('vet_id', id)
        .eq('status', 'completed');

      const { data: uniquePetsData } = await service
        .from('appointments')
        .select('pet_id')
        .eq('vet_id', id)
        .eq('status', 'completed');

      const uniquePets = new Set((uniquePetsData ?? []).map((a) => a.pet_id)).size;

      // reviews & posts require migration
      let avgRating = null;
      let ratingCount = 0;
      let postsCount = 0;
      try {
        const { data: ratingData } = await service.from('reviews').select('rating').eq('reviewee_id', id);
        const ratings = (ratingData ?? []).map((r) => r.rating);
        ratingCount = ratings.length;
        avgRating = ratings.length
          ? parseFloat((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
          : null;
      } catch (_) { /* reviews table not yet migrated */ }

      try {
        const { count } = await service.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', id);
        postsCount = count ?? 0;
      } catch (_) { /* posts table not yet migrated */ }

      vetData = {
        specialty: vetService?.specialty ?? null,
        years_experience: vetService?.years_experience ?? null,
        avg_rating: avgRating,
        rating_count: ratingCount,
        completed_appointments: completedAppts ?? 0,
        unique_pets: uniquePets,
        posts_count: postsCount,
      };
    }

    return res.json({
      id: profile.id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      bio: bio,
      location: location,
      role: profile.role,
      followers_count: followersCount ?? 0,
      following_count: followingCount ?? 0,
      is_following: isFollowing,
      vet: vetData,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
}

// ─── Follows ─────────────────────────────────────────────────────────────────

async function followUser(req, res) {
  try {
    const parsed = followSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const { following_id } = parsed.data;
    const followerId = req.user.id;

    if (followerId === following_id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const { error } = await req.supabase
      .from('follows')
      .insert({ follower_id: followerId, following_id });

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Already following' });
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to follow user', details: err.message });
  }
}

async function unfollowUser(req, res) {
  try {
    const { following_id } = req.params;
    const followerId = req.user.id;

    const { error } = await req.supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', following_id);

    if (error) return res.status(400).json({ error: error.message });

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to unfollow user', details: err.message });
  }
}

// ─── Posts ───────────────────────────────────────────────────────────────────

async function getFeed(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit ?? '20', 10)));
    const offset = (page - 1) * limit;
    const me = req.user.id;

    const { data: rpcData, error: rpcErr } = await req.supabase.rpc('social_feed_items', {
      p_viewer: me,
      p_limit: limit,
      p_offset: offset,
    });

    if (!rpcErr && Array.isArray(rpcData)) {
      const posts = rpcData.map((row) => _normalizeFeedRpcRow(row.item ?? row));
      return res.json({ posts, page, has_more: posts.length === limit });
    }

    // Fallback sin RPC / migración antigua
    const { data: followData } = await req.supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', me);

    const followingIds = (followData ?? []).map((f) => f.following_id);
    const authorIds = [...new Set([me, ...followingIds])];

    const { data, error } = await req.supabase
      .from('posts')
      .select('id, body, image_urls, created_at, author:profiles!posts_author_id_fkey(id, full_name, avatar_url)')
      .in('author_id', authorIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (_isMissingTable(error)) return res.json({ posts: [], page, has_more: false });
      return res.status(400).json({ error: error.message });
    }

    const posts = (data ?? []).map((p) => ({
      feed_kind: 'post',
      created_at: p.created_at,
      post: _mapPost(p),
    }));
    await _mergeEngagementForPosts(req, posts);
    return res.json({ posts, page, has_more: posts.length === limit });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch feed', details: err.message });
  }
}

async function createPost(req, res) {
  try {
    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const { body, image_urls } = parsed.data;

    const { data, error } = await req.supabase
      .from('posts')
      .insert({ author_id: req.user.id, body, image_urls })
      .select('id, body, image_urls, created_at, author:profiles!posts_author_id_fkey(id, full_name, avatar_url)')
      .single();

    if (error) {
      if (_isMissingTable(error)) {
        return res.status(503).json({
          error:
            'La tabla de publicaciones aún no está en la base de datos. Aplica la migración social en Supabase (vetgo_social_module).',
        });
      }
      return res.status(400).json({ error: error.message });
    }

    const row = {
      feed_kind: 'post',
      created_at: data.created_at,
      post: _mapPost(data),
    };
    await _mergeEngagementForPosts(req, [row]);
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create post', details: err.message });
  }
}

async function createRepost(req, res) {
  try {
    const parsed = createRepostSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const originalPostId = req.params.id;
    const { data: exists, error: existsErr } = await req.supabase
      .from('posts')
      .select('id')
      .eq('id', originalPostId)
      .maybeSingle();

    if (existsErr && !_isMissingTable(existsErr)) return res.status(400).json({ error: existsErr.message });
    if (!exists) return res.status(404).json({ error: 'Post not found' });

    const { data: inserted, error } = await req.supabase
      .from('post_reposts')
      .insert({
        reposter_id: req.user.id,
        original_post_id: originalPostId,
        quote_body: parsed.data.quote_body ?? null,
      })
      .select('id, quote_body, created_at')
      .single();

    if (error) {
      if (_isMissingTable(error)) {
        return res.status(503).json({ error: 'Reposts no disponibles. Aplica la migración post_reposts.' });
      }
      if (error.code === '23505') return res.status(409).json({ error: 'Ya reposteaste esta publicación' });
      return res.status(400).json({ error: error.message });
    }

    const service = createSupabaseServiceRoleClient();
    const [{ data: reposter }, { data: original }] = await Promise.all([
      service.from('profiles').select('id, full_name, avatar_url').eq('id', req.user.id).maybeSingle(),
      service
        .from('posts')
        .select('id, body, image_urls, created_at, author:profiles!posts_author_id_fkey(id, full_name, avatar_url)')
        .eq('id', originalPostId)
        .maybeSingle(),
    ]);

    const payload = {
      feed_kind: 'repost',
      created_at: inserted.created_at,
      repost_id: inserted.id,
      quote_body: inserted.quote_body ?? null,
      reposter: reposter ?? null,
      post: original ? _mapPost(original) : null,
    };
    if (payload.post) {
      await _mergeEngagementForPosts(req, [payload]);
    }
    return res.status(201).json(payload);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create repost', details: err.message });
  }
}

async function getUserPosts(req, res) {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit ?? '20', 10)));
    const offset = (page - 1) * limit;

    const viewerId = await _optionalUserIdFromReq(req);

    const service = createSupabaseServiceRoleClient();
    const { data: rpcData, error: rpcErr } = await service.rpc('social_profile_feed_items', {
      p_profile: id,
      p_limit: limit,
      p_offset: offset,
      p_viewer: viewerId,
    });

    if (!rpcErr && Array.isArray(rpcData)) {
      const posts = rpcData.map((row) => _normalizeFeedRpcRow(row.item ?? row));
      return res.json({ posts, page, has_more: posts.length === limit });
    }

    const { data, error } = await service
      .from('posts')
      .select('id, body, image_urls, created_at, author:profiles!posts_author_id_fkey(id, full_name, avatar_url)')
      .eq('author_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (_isMissingTable(error)) return res.json({ posts: [], page, has_more: false });
      return res.status(400).json({ error: error.message });
    }

    const posts = (data ?? []).map((p) => ({
      feed_kind: 'post',
      created_at: p.created_at,
      post: _mapPost(p),
    }));
    const reqLike = { ...req, user: viewerId ? { id: viewerId } : req.user };
    await _mergeEngagementForPosts(reqLike, posts);
    return res.json({ posts, page, has_more: posts.length === limit });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user posts', details: err.message });
  }
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

async function createReview(req, res) {
  try {
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const { reviewee_id, appointment_id, rating, comment } = parsed.data;
    const reviewerId = req.user.id;

    // Verify appointment belongs to reviewer and vet is the reviewee
    const { data: appt } = await req.supabase
      .from('appointments')
      .select('owner_id, vet_id, status')
      .eq('id', appointment_id)
      .maybeSingle();

    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    if (appt.owner_id !== reviewerId) return res.status(403).json({ error: 'Not your appointment' });
    if (appt.vet_id !== reviewee_id) return res.status(400).json({ error: 'Vet mismatch' });
    if (appt.status !== 'completed') return res.status(400).json({ error: 'Appointment not completed' });

    const { data, error } = await req.supabase
      .from('reviews')
      .insert({ reviewer_id: reviewerId, reviewee_id, appointment_id, rating, comment: comment ?? null })
      .select('id, rating, comment, created_at')
      .single();

    if (error) {
      if (_isMissingTable(error)) return res.status(503).json({ error: 'Reviews not available yet' });
      if (error.code === '23505') return res.status(409).json({ error: 'Already reviewed this appointment' });
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create review', details: err.message });
  }
}

async function getProfileReviews(req, res) {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit ?? '20', 10)));
    const offset = (page - 1) * limit;

    const service = createSupabaseServiceRoleClient();
    const { data, error } = await service
      .from('reviews')
      .select('id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, avatar_url)')
      .eq('reviewee_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (_isMissingTable(error)) return res.json({ reviews: [], page, has_more: false });
      return res.status(400).json({ error: error.message });
    }

    const reviews = (data ?? []).map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment ?? null,
      created_at: r.created_at,
      reviewer: r.reviewer ?? null,
    }));

    return res.json({ reviews, page, has_more: reviews.length === limit });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch reviews', details: err.message });
  }
}

// ─── Profile update ───────────────────────────────────────────────────────────

async function updateProfile(req, res) {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const { bio, location, years_experience } = parsed.data;
    const userId = req.user.id;

    const profileUpdate = {};
    if (bio !== undefined) profileUpdate.bio = bio;
    if (location !== undefined) profileUpdate.location = location;

    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await req.supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId);
      if (error) return res.status(400).json({ error: error.message });
    }

    if (years_experience !== undefined) {
      const { error } = await req.supabase
        .from('vet_services')
        .update({ years_experience })
        .eq('profile_id', userId);
      if (error) return res.status(400).json({ error: error.message });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
}

// ─── Discover ────────────────────────────────────────────────────────────────

async function getSuggestions(req, res) {
  try {
    const limit = Math.min(20, parseInt(req.query.limit ?? '10', 10));
    const me = req.user.id;

    // Quién ya sigo (falls back to empty if follows table missing)
    let excludeIds = [me];
    try {
      const { data: followData } = await req.supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', me);
      excludeIds = [me, ...(followData ?? []).map((f) => f.following_id)];
    } catch (_) { /* follows not yet migrated */ }

    const service = createSupabaseServiceRoleClient();
    const { data, error } = await service
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .limit(limit);

    if (error) return res.status(400).json({ error: error.message });

    return res.json({ suggestions: data ?? [] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch suggestions', details: err.message });
  }
}

async function getExplorePosts(req, res) {
  try {
    const limit = Math.min(20, parseInt(req.query.limit ?? '5', 10));
    const me = req.user.id;

    let excludeIds = [me];
    try {
      const { data: followData } = await req.supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', me);
      excludeIds = [me, ...(followData ?? []).map((f) => f.following_id)];
    } catch (_) { /* follows not yet migrated */ }

    const service = createSupabaseServiceRoleClient();
    const { data, error } = await service
      .from('posts')
      .select('id, body, image_urls, created_at, author:profiles!posts_author_id_fkey(id, full_name, avatar_url)')
      .not('author_id', 'in', `(${excludeIds.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (_isMissingTable(error)) return res.json({ posts: [] });
      return res.status(400).json({ error: error.message });
    }

    const posts = (data ?? []).map((p) => ({
      feed_kind: 'post',
      created_at: p.created_at,
      post: _mapPost(p),
    }));
    await _mergeEngagementForPosts(req, posts);
    return res.json({ posts });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch explore posts', details: err.message });
  }
}

// ─── Post likes / comments ───────────────────────────────────────────────────

async function togglePostLike(req, res) {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const { data: existsRow, error: existsErr } = await req.supabase
      .from('posts')
      .select('id')
      .eq('id', postId)
      .maybeSingle();

    if (existsErr && !_isMissingTable(existsErr)) return res.status(400).json({ error: existsErr.message });
    if (!existsRow) return res.status(404).json({ error: 'Post not found' });

    const { data: existing } = await req.supabase
      .from('post_likes')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error: delErr } = await req.supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);
      if (delErr) {
        if (_isMissingTable(delErr)) return res.status(503).json({ error: 'Me gusta no disponibles aún.' });
        return res.status(400).json({ error: delErr.message });
      }
    } else {
      const { error: insErr } = await req.supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: userId });
      if (insErr) {
        if (_isMissingTable(insErr)) return res.status(503).json({ error: 'Me gusta no disponibles aún.' });
        return res.status(400).json({ error: insErr.message });
      }
    }

    const { data: batch } = await req.supabase.rpc('post_engagement_batch', {
      p_viewer: userId,
      p_post_ids: [postId],
    });
    const row = Array.isArray(batch) ? batch[0] : null;

    return res.json({
      liked: row?.viewer_has_liked ?? false,
      like_count: row?.like_count ?? 0,
      viewer_has_liked: row?.viewer_has_liked ?? false,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to toggle like', details: err.message });
  }
}

async function getPostComments(req, res) {
  try {
    const postId = req.params.id;
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit ?? '30', 10)));
    const offset = (page - 1) * limit;

    const { data, error } = await req.supabase
      .from('post_comments')
      .select(`
        id,
        body,
        created_at,
        author:profiles!post_comments_author_id_fkey(id, full_name, avatar_url)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      if (_isMissingTable(error)) return res.json({ comments: [], page, has_more: false });
      return res.status(400).json({ error: error.message });
    }

    const comments = (data ?? []).map((c) => ({
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      author: c.author ?? null,
    }));

    return res.json({ comments, page, has_more: comments.length === limit });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch comments', details: err.message });
  }
}

async function createPostComment(req, res) {
  try {
    const parsed = createPostCommentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const postId = req.params.id;
    const { data: existsRow, error: existsErr } = await req.supabase
      .from('posts')
      .select('id')
      .eq('id', postId)
      .maybeSingle();

    if (existsErr && !_isMissingTable(existsErr)) return res.status(400).json({ error: existsErr.message });
    if (!existsRow) return res.status(404).json({ error: 'Post not found' });

    const { data, error } = await req.supabase
      .from('post_comments')
      .insert({ post_id: postId, author_id: req.user.id, body: parsed.data.body })
      .select(`
        id,
        body,
        created_at,
        author:profiles!post_comments_author_id_fkey(id, full_name, avatar_url)
      `)
      .single();

    if (error) {
      if (_isMissingTable(error)) return res.status(503).json({ error: 'Comentarios no disponibles aún.' });
      return res.status(400).json({ error: error.message });
    }

    const { data: batch } = await req.supabase.rpc('post_engagement_batch', {
      p_viewer: req.user.id,
      p_post_ids: [postId],
    });
    const commentCount = Array.isArray(batch) && batch[0] ? batch[0].comment_count : null;

    return res.status(201).json({
      comment: {
        id: data.id,
        body: data.body,
        created_at: data.created_at,
        author: data.author ?? null,
      },
      comment_count: commentCount,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create comment', details: err.message });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _mapPost(p) {
  return {
    id: p.id,
    body: p.body,
    image_urls: p.image_urls ?? [],
    created_at: p.created_at,
    author: p.author ?? null,
    like_count: p.like_count ?? 0,
    comment_count: p.comment_count ?? 0,
    viewer_has_liked: p.viewer_has_liked ?? false,
    repost_count: p.repost_count ?? 0,
    viewer_has_reposted: p.viewer_has_reposted ?? false,
  };
}

/** Normaliza fila JSON del RPC (feed unificado). */
function _normalizeFeedRpcRow(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const o = raw;
  if (o.feed_kind === 'post' && o.post) {
    return {
      feed_kind: 'post',
      created_at: o.created_at,
      post: _mapPost(_coercePostRow(o.post)),
    };
  }
  if (o.feed_kind === 'repost' && o.post) {
    return {
      feed_kind: 'repost',
      created_at: o.created_at,
      repost_id: o.repost_id,
      quote_body: o.quote_body ?? null,
      reposter: o.reposter ?? null,
      post: _mapPost(_coercePostRow(o.post)),
    };
  }
  return o;
}

function _coercePostRow(post) {
  if (!post || typeof post !== 'object') return post;
  return {
    id: post.id,
    body: post.body,
    image_urls: Array.isArray(post.image_urls) ? post.image_urls : [],
    created_at: post.created_at,
    author: post.author ?? null,
    like_count: post.like_count ?? 0,
    comment_count: post.comment_count ?? 0,
    viewer_has_liked: post.viewer_has_liked ?? false,
    repost_count: post.repost_count ?? 0,
    viewer_has_reposted: post.viewer_has_reposted ?? false,
  };
}

module.exports = {
  getProfile,
  followUser,
  unfollowUser,
  getFeed,
  createPost,
  createRepost,
  getUserPosts,
  createReview,
  getProfileReviews,
  updateProfile,
  getSuggestions,
  getExplorePosts,
  togglePostLike,
  getPostComments,
  createPostComment,
};
