const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');

// Managers and auditors have access to financial trends and charts.
router.get('/trends', authenticate, authorize(['manager', 'auditor']), analyticsController.getFinancialTrends);
router.get('/discrepancies', authenticate, authorize(['manager', 'auditor']), analyticsController.getDiscrepancyMetrics);

module.exports = router;
