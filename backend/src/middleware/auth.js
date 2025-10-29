const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const { User, ActionLog } = require('../models');
const logger = require('../utils/logger');

// Middleware для проверки аутентификации
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Токен доступа не предоставлен'
      });
    }

    // Верифицируем токен
    const decoded = verifyToken(token);
    
    // Получаем пользователя из БД
    const user = await User.findById(decoded.id).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Аккаунт деактивирован'
      });
    }

    // Добавляем пользователя в объект запроса
    req.user = user;
    next();

  } catch (error) {
    logger.error('Ошибка аутентификации:', error);
    
    // Логируем неудачную попытку аутентификации
    if (req.headers.authorization) {
      try {
        const token = extractTokenFromHeader(req.headers.authorization);
        const decoded = verifyToken(token, false, true); // Попытка декодировать без проверки
        
        await ActionLog.createLog({
          userId: decoded?.id,
          action: 'failed_login',
          entityType: 'user',
          details: {
            errorMessage: error.message,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          },
          success: false
        });
      } catch (logError) {
        // Игнорируем ошибки логирования
      }
    }

    return res.status(401).json({
      success: false,
      error: 'Недействительный токен доступа'
    });
  }
};

// Middleware для проверки ролей
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Необходима аутентификация'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Попытка доступа без прав: ${req.user.email} (${req.user.role}) к ${req.originalUrl}`);
      
      return res.status(403).json({
        success: false,
        error: 'Недостаточно прав для выполнения этого действия'
      });
    }

    next();
  };
};

// Middleware для проверки владельца ресурса или админа
const authorizeOwnerOrAdmin = (resourceUserIdField = 'createdBy') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Необходима аутентификация'
      });
    }

    // Админы могут делать все
    if (req.user.role === 'admin') {
      return next();
    }

    // Для других ролей проверяем владельца ресурса
    // Это будет проверено в контроллере после получения ресурса
    req.checkOwnership = {
      field: resourceUserIdField,
      userId: req.user._id
    };
    
    next();
  };
};

// Middleware для логирования действий пользователя
const logUserAction = (action, entityType) => {
  return async (req, res, next) => {
    // Сохраняем оригинальные методы
    const originalSend = res.send;
    const originalJson = res.json;

    // Переопределяем методы для перехвата ответа
    res.send = function(data) {
      logAction(req, res, action, entityType, data);
      return originalSend.call(this, data);
    };

    res.json = function(data) {
      logAction(req, res, action, entityType, data);
      return originalJson.call(this, data);
    };

    next();
  };
};

// Функция для логирования действия
const logAction = async (req, res, action, entityType, responseData) => {
  try {
    if (!req.user) return;

    const success = res.statusCode >= 200 && res.statusCode < 300;
    
    await ActionLog.createLog({
      userId: req.user._id,
      action,
      entityType,
      entityId: req.params.id || req.body._id || responseData?._id,
      details: {
        oldValues: req.oldValues, // Может быть установлено в контроллере
        newValues: req.body,
        metadata: {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        errorMessage: !success ? responseData?.error : undefined
      },
      success
    });
  } catch (error) {
    logger.error('Ошибка логирования действия:', error);
  }
};

// Middleware для извлечения IP адреса
const extractClientIP = (req, res, next) => {
  req.clientIP = req.ip || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress ||
                 (req.connection.socket ? req.connection.socket.remoteAddress : null);
  next();
};

// Опциональная аутентификация (не требует токен, но если он есть - проверяет)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id);
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // Игнорируем ошибки при опциональной аутентификации
  }
  
  next();
};

module.exports = {
  authenticate,
  authorize,
  authorizeOwnerOrAdmin,
  logUserAction,
  extractClientIP,
  optionalAuth
};
