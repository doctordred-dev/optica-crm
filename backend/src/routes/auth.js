const express = require('express');
const router = express.Router();

const {
  register,
  login,
  refreshToken,
  getMe,
  logout,
  changePassword
} = require('../controllers/authController');

const {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateChangePassword
} = require('../validators/authValidators');

const {
  authenticate,
  authorize,
  logUserAction,
  extractClientIP
} = require('../middleware/auth');

// Применяем middleware для извлечения IP ко всем роутам
router.use(extractClientIP);

// @route   POST /api/auth/register
// @desc    Регистрация нового пользователя
// @access  Private (только админы)
router.post('/register', 
  authenticate,
  authorize('admin'),
  validateRegister,
  logUserAction('other', 'user'),
  register
);

// @route   POST /api/auth/login
// @desc    Вход в систему
// @access  Public
router.post('/login',
  validateLogin,
  login
);

// @route   POST /api/auth/refresh
// @desc    Обновление токена доступа
// @access  Public
router.post('/refresh',
  validateRefreshToken,
  refreshToken
);

// @route   GET /api/auth/me
// @desc    Получение информации о текущем пользователе
// @access  Private
router.get('/me',
  authenticate,
  getMe
);

// @route   POST /api/auth/logout
// @desc    Выход из системы
// @access  Private
router.post('/logout',
  authenticate,
  logout
);

// @route   PUT /api/auth/change-password
// @desc    Изменение пароля
// @access  Private
router.put('/change-password',
  authenticate,
  validateChangePassword,
  logUserAction('other', 'user'),
  changePassword
);

module.exports = router;
