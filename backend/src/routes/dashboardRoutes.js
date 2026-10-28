const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');
const { scheduleSynchronization } = require('../services/businessDayScheduler');

router.get('/summary', authenticate, scheduleSynchronization, authorize(['recorder', 'auditor', 'manager']), dashboardController.getDashboardSummary);

module.exports = router;
