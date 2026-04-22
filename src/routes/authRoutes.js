const { Router } = require('express');
const { validateSchema } = require('../middleware/validateSchema');
const { signupSchema, loginSchema, logoutSchema } = require('../schemas/auth.schema');
const { signup, login, logout } = require('../controllers/auth.controller');

const router = Router();

router.post('/signup', validateSchema(signupSchema), signup);
router.post('/login', validateSchema(loginSchema), login);
router.post('/logout', validateSchema(logoutSchema), logout);

module.exports = router;
