const { Router } = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const {
  getProfile,
  followUser,
  unfollowUser,
  getFeed,
  createPost,
  getUserPosts,
  createReview,
  getProfileReviews,
  updateProfile,
} = require('../controllers/social.controller');

const router = Router();

// Public profile (optional auth for is_following)
router.get('/profiles/:id', getProfile);

// Profile update (own)
router.patch('/profiles/me', requireAuth, updateProfile);

// Follows
router.post('/follows', requireAuth, followUser);
router.delete('/follows/:following_id', requireAuth, unfollowUser);

// Posts
router.get('/posts', requireAuth, getFeed);
router.post('/posts', requireAuth, createPost);
router.get('/profiles/:id/posts', getUserPosts);

// Reviews
router.post('/reviews', requireAuth, createReview);
router.get('/profiles/:id/reviews', getProfileReviews);

module.exports = router;
