const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/incomes', authenticate, authorize(['manager', 'auditor']), reportController.getDailyIncomeReport);
router.get('/expenses', authenticate, authorize(['manager', 'auditor']), reportController.getDailyExpenseReport);
router.get('/closings', authenticate, authorize(['manager', 'auditor']), reportController.getDailyClosingReport);
router.get('/three-day-audits', authenticate, authorize(['manager', 'auditor']), reportController.getThreeDayAuditReport);
router.get('/audit-trail', authenticate, authorize(['manager']), reportController.getAuditTrailReport);

module.exports = router;
