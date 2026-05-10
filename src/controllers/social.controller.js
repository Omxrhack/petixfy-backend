const { createSupabaseServiceRoleClient } = require('../lib/supabaseServiceRole');
const { followSchema, createPostSchema, createReviewSchema, updateProfileSchema } = require('../schemas/social.schema');

// ─── Public profile ──────────────────────────────────────────────────────────

async function getProfile(req, res) {
  try {
    const { id } = req.params;
    const service = createSupabaseServiceRoleClient();

    const { data: profile, error: profileErr } = await service
      .from('profiles')
      .select('id, full_name, avatar_url, bio, location, role')
      .eq('id', id)
      .maybeSingle();

    if (profileErr) return res.status(400).json({ error: profileErr.message });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Follower / following counts
    const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
      service.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
      service.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
    ]);

    // Optional: is the caller following this profile?
    let isFollowing = false;
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

    let vetData = null;
    if (profile.role === 'vet') {
      const [
        { data: vetService },
        { count: completedAppts },
        { data: ratingData },
        { data: uniquePetsData },
        { count: postsCount },
      ] = await Promise.all([
        service
          .from('vet_services')
          .select('specialty, years_experience')
          .eq('profile_id', id)
          .maybeSingle(),
        service
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('vet_id', id)
          .eq('status', 'completed'),
        service.from('reviews').select('rating').eq('reviewee_id', id),
        service.from('appointments').select('pet_id').eq('vet_id', id).eq('status', 'completed'),
        service.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', id),
      ]);

      const ratings = (ratingData ?? []).map((r) => r.rating);
      const avgRating = ratings.length
        ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
        : null;

      const uniquePets = new Set((uniquePetsData ?? []).map((a) => a.pet_id)).size;

      vetData = {
        specialty: vetService?.specialty ?? null,
        years_experience: vetService?.years_experience ?? null,
        avg_rating: avgRating ? parseFloat(avgRating) : null,
        rating_count: ratings.length,
        completed_appointments: completedAppts ?? 0,
        unique_pets: uniquePets,
        posts_count: postsCount ?? 0,
      };
    }

    return res.json({
      id: profile.id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio ?? null,
      location: profile.location ?? null,
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

    // Get IDs of people I follow
    const { data: followData } = await req.supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', me);

    const followingIds = (followData ?? []).map((f) => f.following_id);
    // Include own posts in feed
    const authorIds = [...new Set([me, ...followingIds])];

    const { data, error } = await req.supabase
      .from('posts')
      .select('id, body, image_urls, created_at, author:profiles!posts_author_id_fkey(id, full_name, avatar_url)')
      .in('author_id', authorIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(400).json({ error: error.message });

    const posts = (data ?? []).map(_mapPost);
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

    if (error) return res.status(400).json({ error: error.message });

    return res.status(201).json(_mapPost(data));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create post', details: err.message });
  }
}

async function getUserPosts(req, res) {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit ?? '20', 10)));
    const offset = (page - 1) * limit;

    const service = createSupabaseServiceRoleClient();
    const { data, error } = await service
      .from('posts')
      .select('id, body, image_urls, created_at, author:profiles!posts_author_id_fkey(id, full_name, avatar_url)')
      .eq('author_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(400).json({ error: error.message });

    const posts = (data ?? []).map(_mapPost);
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

    if (error) return res.status(400).json({ error: error.message });

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _mapPost(p) {
  return {
    id: p.id,
    body: p.body,
    image_urls: p.image_urls ?? [],
    created_at: p.created_at,
    author: p.author ?? null,
  };
}

module.exports = {
  getProfile,
  followUser,
  unfollowUser,
  getFeed,
  createPost,
  getUserPosts,
  createReview,
  getProfileReviews,
  updateProfile,
};
