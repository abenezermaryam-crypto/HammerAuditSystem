const express = require('express');
const router = express.Router();
const discrepancyController = require('../controllers/discrepancyController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize(['recorder', 'manager', 'auditor']), discrepancyController.getDiscrepancies);
router.post('/:id/explain', authenticate, authorize(['recorder', 'manager', 'auditor']), discrepancyController.submitExplanation);
router.post('/:id/resolve', authenticate, authorize(['manager', 'auditor']), discrepancyController.resolveDiscrepancy);

module.exports = router;
