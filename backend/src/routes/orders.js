const express = require('express');
const multer = require('multer');
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

const { scanOrderPhotos } = require('../controllers/orderScanController');

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

// Multer для сканирования бланков заказов (in-memory, до 3 файлов по 10MB)
const scanUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Непідтримуваний формат файлу. Дозволені: JPEG, PNG, WEBP, HEIC'));
    }
    cb(null, true);
  }
});

// Обёртка над multer, чтобы вернуть JSON-ошибку вместо падения/HTML-ответа
const handleScanUpload = (req, res, next) => {
  scanUpload.array('photos', 3)(req, res, (err) => {
    if (err) {
      const messages = {
        LIMIT_FILE_SIZE: 'Файл занадто великий (максимум 10MB)',
        LIMIT_FILE_COUNT: 'Забагато файлів (максимум 3)',
        LIMIT_UNEXPECTED_FILE: 'Неочікуване поле файлу'
      };
      return res.status(400).json({
        success: false,
        error: (err.code && messages[err.code]) || err.message
      });
    }
    next();
  });
};

// @route   GET /api/orders
// @desc    Получить все заказы с фильтрацией и пагинацией
// @access  Private (manager+)
router.get('/',
  authorize('admin', 'manager', 'master'),
  validateSearchOrders,
  getOrders
);

// @route   POST /api/orders/scan
// @desc    Розпізнати замовлення(я) з фото бланків (Claude Vision)
// @access  Private (manager+)
router.post('/scan',
  authorize('admin', 'manager'),
  handleScanUpload,
  logUserAction('scan_order_photos', 'order'),
  scanOrderPhotos
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
