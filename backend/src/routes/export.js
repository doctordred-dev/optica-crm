const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const exportController = require('../controllers/exportController');

// Обработка preflight OPTIONS запросов для CORS
router.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// Все роуты экспорта требуют аутентификации и роли manager или выше
router.use(authenticate);
router.use(authorize('admin', 'manager'));

// @route   GET /api/export/clients
// @desc    Экспорт клиентов в CSV
// @access  Private (manager+)
router.get('/clients', exportController.exportClients);

// @route   GET /api/export/orders
// @desc    Экспорт заказов в CSV
// @access  Private (manager+)
router.get('/orders', exportController.exportOrders);

// @route   GET /api/export/sales
// @desc    Экспорт статистики продаж в CSV
// @access  Private (manager+)
router.get('/sales', exportController.exportSales);

module.exports = router;
