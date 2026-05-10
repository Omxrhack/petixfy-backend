const { Router } = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { uploadPetPhotoMiddleware } = require('../middleware/uploadPetPhoto');
const {
  getProfile,
  followUser,
  unfollowUser,
  getFeed,
  uploadPostImage,
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

// Posts — subida de adjuntos (antes de rutas con :id por claridad)
router.post('/posts/upload-image', requireAuth, uploadPetPhotoMiddleware, uploadPostImage);

// Posts — rutas con :id antes del listado genérico
router.post('/posts/:id/like', requireAuth, togglePostLike);
router.get('/posts/:id/comments', requireAuth, getPostComments);
router.post('/posts/:id/comments', requireAuth, createPostComment);
router.get('/posts', requireAuth, getFeed);
router.post('/posts', requireAuth, createPost);
router.post('/posts/:id/repost', requireAuth, createRepost);
router.get('/profiles/:id/posts', getUserPosts);

// Reviews
router.post('/reviews', requireAuth, createReview);
router.get('/profiles/:id/reviews', getProfileReviews);

module.exports = router;
