const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize(['manager']));
router.get('/', userController.listUsers);
router.post('/', userController.createUser);
router.patch('/me', userController.updateOwnProfile);
router.put('/:id', userController.updateUser);
router.post('/:id/approve', userController.approveUser);
router.patch('/:id/activate', userController.setUserActive);
router.delete('/:id', userController.setUserActive);

module.exports = router;
