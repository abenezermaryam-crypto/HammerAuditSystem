const express = require('express');
const router = express.Router();
const businessDayController = require('../controllers/businessDayController');
const { authenticate, authorize } = require('../middleware/auth');
const { scheduleSynchronization } = require('../services/businessDayScheduler');

router.use(authenticate, scheduleSynchronization);
router.get('/current', authorize(['recorder', 'auditor', 'manager']), businessDayController.getCurrentDay);
router.get('/', authorize(['recorder', 'auditor', 'manager']), businessDayController.getBusinessDays);
router.post('/open', authorize(['manager']), businessDayController.openBusinessDay);

module.exports = router;
