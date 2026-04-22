const { Router } = require('express');
const { uploadPetPhotoMiddleware } = require('../middleware/uploadPetPhoto');
const { validateSchema } = require('../middleware/validateSchema');
const { createPetSchema } = require('../schemas/pet.schema');
const { createPet, listPetsByOwner, uploadPetPhoto } = require('../controllers/pets.controller');

const router = Router();

router.post('/:id/upload-photo', uploadPetPhotoMiddleware, uploadPetPhoto);
router.post('/', validateSchema(createPetSchema), createPet);
router.get('/:ownerId', listPetsByOwner);

module.exports = router;
