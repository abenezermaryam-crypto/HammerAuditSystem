const express = require('express');
const router = express.Router();
const adjustmentController = require('../controllers/adjustmentController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize(['auditor', 'manager']), adjustmentController.createAdjustment);
router.get('/', authenticate, authorize(['auditor', 'manager']), adjustmentController.getAdjustments);

module.exports = router;
