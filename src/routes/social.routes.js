const { Router } = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const {
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
} = require('../controllers/social.controller');

const router = Router();

// Discover — must be before /profiles/:id to avoid param collision
router.get('/profiles/suggestions', requireAuth, getSuggestions);
router.get('/posts/explore',        requireAuth, getExplorePosts);

// Public profile (optional auth for is_following)
router.get('/profiles/:id', getProfile);

// Profile update (own)
router.patch('/profiles/me', requireAuth, updateProfile);

// Follows
router.post('/follows', requireAuth, followUser);
router.delete('/follows/:following_id', requireAuth, unfollowUser);

// Posts — /posts/:id/repost antes que rutas ambiguas
router.get('/posts', requireAuth, getFeed);
router.post('/posts', requireAuth, createPost);
router.post('/posts/:id/repost', requireAuth, createRepost);
router.get('/profiles/:id/posts', getUserPosts);

// Reviews
router.post('/reviews', requireAuth, createReview);
router.get('/profiles/:id/reviews', getProfileReviews);

module.exports = router;
