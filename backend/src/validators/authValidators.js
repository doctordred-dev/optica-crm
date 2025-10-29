const Joi = require('joi');

// Валидация регистрации
const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Введите корректный email адрес',
      'any.required': 'Email обязателен'
    }),
  
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Пароль должен содержать минимум 6 символов',
      'string.max': 'Пароль не может быть длиннее 128 символов',
      'any.required': 'Пароль обязателен'
    }),
  
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Имя должно содержать минимум 2 символа',
      'string.max': 'Имя не может быть длиннее 50 символов',
      'any.required': 'Имя обязательно'
    }),
  
  role: Joi.string()
    .valid('admin', 'manager', 'master', 'viewer')
    .default('viewer')
    .messages({
      'any.only': 'Роль должна быть: admin, manager, master или viewer'
    })
});

// Валидация входа в систему
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Введите корректный email адрес',
      'any.required': 'Email обязателен'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Пароль обязателен'
    })
});

// Валидация обновления токена
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token обязателен'
    })
});

// Валидация изменения пароля
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Текущий пароль обязателен'
    }),
  
  newPassword: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Новый пароль должен содержать минимум 6 символов',
      'string.max': 'Новый пароль не может быть длиннее 128 символов',
      'any.required': 'Новый пароль обязателен'
    })
});

// Middleware для валидации
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Показать все ошибки сразу
      stripUnknown: true // Удалить неизвестные поля
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Ошибка валидации данных',
        details: errors
      });
    }

    // Заменяем req.body на валидированные данные
    req.body = value;
    next();
  };
};

// Экспорт валидаторов
const validateRegister = validate(registerSchema);
const validateLogin = validate(loginSchema);
const validateRefreshToken = validate(refreshTokenSchema);
const validateChangePassword = validate(changePasswordSchema);

module.exports = {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateChangePassword,
  // Экспорт схем для использования в других местах
  schemas: {
    registerSchema,
    loginSchema,
    refreshTokenSchema,
    changePasswordSchema
  }
};
