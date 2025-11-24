const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// Все роуты аналитики требуют аутентификации и роли manager или выше
router.use(authenticate);
router.use(authorize('admin', 'manager'));

// @route   GET /api/analytics/sales
// @desc    Статистика продаж
// @access  Private (manager+)
router.get('/sales', analyticsController.getSalesAnalytics);

// @route   GET /api/analytics/employees
// @desc    Статистика по сотрудникам
// @access  Private (manager+)
router.get('/employees', analyticsController.getEmployeesAnalytics);

// @route   GET /api/analytics/brands
// @desc    Популярные бренды
// @access  Private (manager+)
router.get('/brands', analyticsController.getBrandsAnalytics);

// @route   GET /api/analytics/overview
// @desc    Общая статистика (dashboard)
// @access  Private (manager+)
router.get('/overview', analyticsController.getOverview);

// @route   GET /api/analytics/clients
// @desc    Статистика по клиентам
// @access  Private (manager+)
router.get('/clients', analyticsController.getClientsAnalytics);

module.exports = router;
