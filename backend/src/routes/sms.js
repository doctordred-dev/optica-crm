const express = require('express');
const router = express.Router();

const {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  sendTestSMS,
  getBalance,
  getServiceStatus
} = require('../controllers/smsController');

const {
  authenticate,
  authorize,
  logUserAction,
  extractClientIP
} = require('../middleware/auth');

// Применяем middleware ко всем роутам
router.use(extractClientIP);
router.use(authenticate);

// @route   GET /api/sms/status
// @desc    Проверить статус SMS сервиса
// @access  Private (admin+)
router.get('/status',
  authorize('admin', 'manager'),
  getServiceStatus
);

// @route   GET /api/sms/balance
// @desc    Проверить баланс TurboSMS
// @access  Private (admin+)
router.get('/balance',
  authorize('admin', 'manager'),
  getBalance
);

// @route   POST /api/sms/test
// @desc    Отправить тестовое SMS
// @access  Private (admin+)
router.post('/test',
  authorize('admin', 'manager'),
  logUserAction('send_sms', 'other'),
  sendTestSMS
);

// @route   GET /api/sms/templates
// @desc    Получить все SMS шаблоны
// @access  Private (admin+)
router.get('/templates',
  authorize('admin', 'manager'),
  getTemplates
);

// @route   POST /api/sms/templates
// @desc    Создать SMS шаблон
// @access  Private (admin+)
router.post('/templates',
  authorize('admin', 'manager'),
  logUserAction('create_sms_template', 'sms_template'),
  createTemplate
);

// @route   PUT /api/sms/templates/:id
// @desc    Обновить SMS шаблон
// @access  Private (admin+)
router.put('/templates/:id',
  authorize('admin', 'manager'),
  logUserAction('update_sms_template', 'sms_template'),
  updateTemplate
);

// @route   DELETE /api/sms/templates/:id
// @desc    Удалить SMS шаблон
// @access  Private (admin only)
router.delete('/templates/:id',
  authorize('admin'),
  logUserAction('other', 'sms_template'),
  deleteTemplate
);

module.exports = router;
