const { User, ActionLog } = require('../models');
const { generateTokenPair, verifyToken } = require('../utils/jwt');
const logger = require('../utils/logger');

// @desc    Регистрация нового пользователя
// @route   POST /api/auth/register
// @access  Private (только админы)
const register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Проверяем, существует ли пользователь
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Пользователь с таким email уже существует'
      });
    }

    // Создаем пользователя
    const user = await User.create({
      email,
      password,
      name,
      role: role || 'viewer'
    });

    // Логируем создание пользователя
    await ActionLog.createLog({
      userId: req.user?._id,
      action: 'other', // Используем 'other' так как 'create_user' нет в enum
      entityType: 'user',
      entityId: user._id,
      details: {
        newValues: { email, name, role: user.role },
        metadata: { action: 'create_user' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Новый пользователь зарегистрирован: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Пользователь успешно зарегистрирован',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          roleRu: user.roleRu
        }
      }
    });

  } catch (error) {
    logger.error('Ошибка регистрации:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при регистрации'
    });
  }
};

// @desc    Вход в систему
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Валидация входных данных
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email и пароль обязательны'
      });
    }

    // Ищем пользователя с паролем
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      await ActionLog.createLog({
        userId: null,
        action: 'failed_login',
        entityType: 'user',
        details: {
          errorMessage: 'Пользователь не найден',
          metadata: { email },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        },
        success: false
      });

      return res.status(401).json({
        success: false,
        error: 'Неверные учетные данные'
      });
    }

    // Проверяем активность аккаунта
    if (!user.isActive) {
      await ActionLog.createLog({
        userId: user._id,
        action: 'failed_login',
        entityType: 'user',
        details: {
          errorMessage: 'Аккаунт деактивирован',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        },
        success: false
      });

      return res.status(401).json({
        success: false,
        error: 'Аккаунт деактивирован'
      });
    }

    // Проверяем пароль
    const isPasswordMatch = await user.matchPassword(password);
    
    if (!isPasswordMatch) {
      await ActionLog.createLog({
        userId: user._id,
        action: 'failed_login',
        entityType: 'user',
        details: {
          errorMessage: 'Неверный пароль',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        },
        success: false
      });

      return res.status(401).json({
        success: false,
        error: 'Неверные учетные данные'
      });
    }

    // Обновляем время последнего входа
    await user.updateLastLogin();

    // Генерируем токены
    const tokens = generateTokenPair(user);

    // Логируем успешный вход
    await ActionLog.createLog({
      userId: user._id,
      action: 'login',
      entityType: 'user',
      details: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Пользователь вошел в систему: ${email}`);

    res.json({
      success: true,
      message: 'Успешный вход в систему',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          roleRu: user.roleRu,
          lastLogin: user.lastLogin
        },
        tokens
      }
    });

  } catch (error) {
    logger.error('Ошибка входа в систему:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера при входе в систему'
    });
  }
};

// @desc    Обновление токена доступа
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token обязателен'
      });
    }

    // Верифицируем refresh token
    const decoded = verifyToken(refreshToken, true);
    
    // Получаем пользователя
    const user = await User.findById(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Недействительный refresh token'
      });
    }

    // Генерируем новую пару токенов
    const tokens = generateTokenPair(user);

    res.json({
      success: true,
      message: 'Токены обновлены',
      data: { tokens }
    });

  } catch (error) {
    logger.error('Ошибка обновления токена:', error);
    res.status(401).json({
      success: false,
      error: 'Недействительный refresh token'
    });
  }
};

// @desc    Получение информации о текущем пользователе
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          roleRu: user.roleRu,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    logger.error('Ошибка получения профиля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера'
    });
  }
};

// @desc    Выход из системы
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    // Логируем выход из системы
    await ActionLog.createLog({
      userId: req.user._id,
      action: 'logout',
      entityType: 'user',
      details: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Пользователь вышел из системы: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Успешный выход из системы'
    });

  } catch (error) {
    logger.error('Ошибка выхода из системы:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера'
    });
  }
};

// @desc    Изменение пароля
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Текущий и новый пароли обязательны'
      });
    }

    // Получаем пользователя с паролем
    const user = await User.findById(req.user._id).select('+password');

    // Проверяем текущий пароль
    const isCurrentPasswordMatch = await user.matchPassword(currentPassword);
    
    if (!isCurrentPasswordMatch) {
      return res.status(400).json({
        success: false,
        error: 'Неверный текущий пароль'
      });
    }

    // Обновляем пароль
    user.password = newPassword;
    await user.save();

    // Логируем изменение пароля
    await ActionLog.createLog({
      userId: user._id,
      action: 'other',
      entityType: 'user',
      details: {
        metadata: { action: 'change_password' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    logger.info(`Пользователь изменил пароль: ${user.email}`);

    res.json({
      success: true,
      message: 'Пароль успешно изменен'
    });

  } catch (error) {
    logger.error('Ошибка изменения пароля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера'
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getMe,
  logout,
  changePassword
};
