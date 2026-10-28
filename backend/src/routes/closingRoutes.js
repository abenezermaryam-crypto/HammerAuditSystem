const express = require('express');
const router = express.Router();
const dailyClosingController = require('../controllers/dailyClosingController');
const { authenticate, authorize } = require('../middleware/auth');
const { scheduleSynchronization } = require('../services/businessDayScheduler');

router.use(authenticate, scheduleSynchronization);
router.get('/preview/:business_day_id', authorize(['recorder', 'manager', 'auditor']), dailyClosingController.getClosingPreview);
router.post('/close/:business_day_id', authorize(['recorder', 'manager']), dailyClosingController.performDailyClosing);

module.exports = router;
