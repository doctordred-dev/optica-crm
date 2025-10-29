const express = require('express');
const router = express.Router();

const {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  sendSMSNotification
} = require('../controllers/ordersController');

const {
  validateCreateOrder,
  validateUpdateOrder,
  validateUpdateStatus,
  validateSearchOrders,
  validateIdParam
} = require('../validators/orderValidators');

const {
  authenticate,
  authorize,
  logUserAction,
  extractClientIP
} = require('../middleware/auth');

// Применяем middleware ко всем роутам
router.use(extractClientIP);
router.use(authenticate);

// @route   GET /api/orders
// @desc    Получить все заказы с фильтрацией и пагинацией
// @access  Private (manager+)
router.get('/',
  authorize('admin', 'manager', 'master'),
  validateSearchOrders,
  getOrders
);

// @route   POST /api/orders
// @desc    Создать новый заказ
// @access  Private (manager+)
router.post('/',
  authorize('admin', 'manager'),
  validateCreateOrder,
  logUserAction('create_order', 'order'),
  createOrder
);

// @route   GET /api/orders/:id
// @desc    Получить заказ по ID
// @access  Private (manager+)
router.get('/:id',
  authorize('admin', 'manager', 'master'),
  validateIdParam,
  getOrder
);

// @route   PUT /api/orders/:id
// @desc    Обновить заказ
// @access  Private (manager+)
router.put('/:id',
  authorize('admin', 'manager'),
  validateIdParam,
  validateUpdateOrder,
  logUserAction('update_order', 'order'),
  updateOrder
);

// @route   PUT /api/orders/:id/status
// @desc    Изменить статус заказа
// @access  Private (master+)
router.put('/:id/status',
  authorize('admin', 'manager', 'master'),
  validateIdParam,
  validateUpdateStatus,
  logUserAction('change_order_status', 'order'),
  updateOrderStatus
);

// @route   POST /api/orders/:id/notify
// @desc    Отправить SMS уведомление
// @access  Private (manager+)
router.post('/:id/notify',
  authorize('admin', 'manager'),
  validateIdParam,
  logUserAction('send_sms', 'order'),
  sendSMSNotification
);

// @route   DELETE /api/orders/:id
// @desc    Удалить заказ
// @access  Private (admin only)
router.delete('/:id',
  authorize('admin'),
  validateIdParam,
  logUserAction('delete_order', 'order'),
  deleteOrder
);

module.exports = router;
