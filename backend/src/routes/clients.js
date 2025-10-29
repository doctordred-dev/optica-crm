const express = require('express');
const router = express.Router();

const {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  searchByPhone,
  getClientOrders
} = require('../controllers/clientsController');

const {
  validateCreateClient,
  validateUpdateClient,
  validateSearchQuery,
  validateIdParam,
  validatePhoneParam
} = require('../validators/clientValidators');

const {
  authenticate,
  authorize,
  logUserAction,
  extractClientIP
} = require('../middleware/auth');

// Применяем middleware ко всем роутам
router.use(extractClientIP);
router.use(authenticate);

// @route   GET /api/clients
// @desc    Получить всех клиентов с поиском и пагинацией
// @access  Private (manager+)
router.get('/',
  authorize('admin', 'manager'),
  validateSearchQuery,
  getClients
);

// @route   GET /api/clients/search/phone/:phone
// @desc    Поиск клиента по номеру телефона
// @access  Private (manager+)
router.get('/search/phone/:phone',
  authorize('admin', 'manager'),
  validatePhoneParam,
  searchByPhone
);

// @route   POST /api/clients
// @desc    Создать нового клиента
// @access  Private (manager+)
router.post('/',
  authorize('admin', 'manager'),
  validateCreateClient,
  logUserAction('create_client', 'client'),
  createClient
);

// @route   GET /api/clients/:id
// @desc    Получить клиента по ID
// @access  Private (manager+)
router.get('/:id',
  authorize('admin', 'manager'),
  validateIdParam,
  getClient
);

// @route   GET /api/clients/:id/orders
// @desc    Получить заказы клиента
// @access  Private (manager+)
router.get('/:id/orders',
  authorize('admin', 'manager'),
  validateIdParam,
  getClientOrders
);

// @route   PUT /api/clients/:id
// @desc    Обновить клиента
// @access  Private (manager+)
router.put('/:id',
  authorize('admin', 'manager'),
  validateIdParam,
  validateUpdateClient,
  logUserAction('update_client', 'client'),
  updateClient
);

// @route   DELETE /api/clients/:id
// @desc    Удалить клиента
// @access  Private (admin only)
router.delete('/:id',
  authorize('admin'),
  validateIdParam,
  logUserAction('delete_client', 'client'),
  deleteClient
);

module.exports = router;
