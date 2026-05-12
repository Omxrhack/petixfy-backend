const { Router } = require('express');
const { uploadPetPhotoMiddleware } = require('../middleware/uploadPetPhoto');
const { validateSchema } = require('../middleware/validateSchema');
const { createPetSchema, updatePetSchema } = require('../schemas/pet.schema');
const {
  createPet,
  updatePet,
  deletePet,
  getPetRecord,
  listPetsByOwner,
  uploadPetPhoto,
} = require('../controllers/pets.controller');

const router = Router();

router.get('/record/:id', getPetRecord);
router.post('/:id/upload-photo', uploadPetPhotoMiddleware, uploadPetPhoto);
router.patch('/:id', validateSchema(updatePetSchema), updatePet);
router.delete('/:id', deletePet);
router.post('/', validateSchema(createPetSchema), createPet);
router.get('/:ownerId', listPetsByOwner);

module.exports = router;
