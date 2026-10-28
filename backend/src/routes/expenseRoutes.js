const express = require('express');
const router = express.Router();
const dailyExpenseController = require('../controllers/dailyExpenseController');
const { authenticate, authorize } = require('../middleware/auth');
const { scheduleSynchronization } = require('../services/businessDayScheduler');

router.use(authenticate, scheduleSynchronization);
router.post('/', authorize(['recorder', 'manager']), dailyExpenseController.recordDailyExpense);
router.get('/', authorize(['recorder', 'manager', 'auditor']), dailyExpenseController.getExpensesByDay);
router.put('/:id', authorize(['recorder', 'manager', 'auditor']), dailyExpenseController.updateDailyExpense);

module.exports = router;
