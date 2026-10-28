const express = require('express');
const router = express.Router();
const dailyIncomeController = require('../controllers/dailyIncomeController');
const { authenticate, authorize } = require('../middleware/auth');
const { scheduleSynchronization } = require('../services/businessDayScheduler');

router.use(authenticate, scheduleSynchronization);
router.post('/', authorize(['recorder', 'manager']), dailyIncomeController.recordDailyIncome);
router.get('/', authorize(['recorder', 'manager', 'auditor']), dailyIncomeController.getIncomesByDay);
router.put('/:id', authorize(['recorder', 'manager', 'auditor']), dailyIncomeController.updateDailyIncome);

module.exports = router;
