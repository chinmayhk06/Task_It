const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getProjectReport,
    getTeamReport,
    getInternReport,
    getMonthlyReport,
    getCompletedTasksReport,
    getDelayedTasksReport,
} = require('../controllers/reportController');

// All report routes are protected by JWT
router.use(protect);

router.get('/projects', getProjectReport);
router.get('/teams', getTeamReport);
router.get('/members', getInternReport);
router.get('/interns', getInternReport); // Backwards-compatible API alias
router.get('/monthly', getMonthlyReport);
router.get('/completed-tasks', getCompletedTasksReport);
router.get('/delayed-tasks', getDelayedTasksReport);

module.exports = router;
