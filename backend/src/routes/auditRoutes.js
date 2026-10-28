const express = require('express');
const router = express.Router();
const threeDayAuditController = require('../controllers/threeDayAuditController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/eligible-days', authenticate, authorize(['auditor', 'manager']), threeDayAuditController.getEligibleAuditDays);
router.post('/preview', authenticate, authorize(['auditor', 'manager']), threeDayAuditController.previewThreeDayAudit);
router.post('/submit', authenticate, authorize(['auditor', 'manager']), threeDayAuditController.submitThreeDayAudit);
router.get('/', authenticate, authorize(['auditor', 'manager']), threeDayAuditController.getAllAudits);
router.post('/:id/sign-off', authenticate, authorize(['auditor', 'manager']), threeDayAuditController.signOffAudit);

module.exports = router;
