const { Router } = require('express');
const { createPet, listPetsByOwner } = require('../controllers/pets.controller');

const router = Router();

router.post('/', createPet);
router.get('/:ownerId', listPetsByOwner);

module.exports = router;
