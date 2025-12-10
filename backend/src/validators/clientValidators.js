const Joi = require('joi');

// Валидация создания клиента
const createClientSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Имя должно содержать минимум 2 символа',
      'string.max': 'Имя не может быть длиннее 100 символов',
      'any.required': 'Имя клиента обязательно'
    }),

  phone: Joi.string()
    .pattern(/^(\+380|380|0|8)\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Телефон должен быть в украинском формате (+380XXXXXXXXX, 0XXXXXXXXX или 8XXXXXXXXX)',
      'any.required': 'Номер телефона обязателен'
    }),

  age: Joi.number()
    .integer()
    .min(0)
    .max(150)
    .allow(null)
    .messages({
      'number.min': 'Возраст не может быть отрицательным',
      'number.max': 'Возраст не может быть больше 150 лет',
      'number.integer': 'Возраст должен быть целым числом'
    }),

  birthDate: Joi.date()
    .max('now')
    .allow(null)
    .messages({
      'date.max': 'Дата рождения не может быть в будущем'
    }),

  comments: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': 'Комментарий не может быть длиннее 500 символов'
    }),

  source: Joi.string()
    .valid(
      'реклама', 
      'рекомендация', 
      'интернет', 
      'социальные_сети', 
      'прохожий', 
      'постоянный_клиент',
      'МКЛ',
      'другое'
    )
    .default('другое')
    .messages({
      'any.only': 'Неверный источник привлечения'
    }),

  defaultDiscount: Joi.number()
    .min(0)
    .max(100)
    .default(0)
    .messages({
      'number.min': 'Скидка не может быть отрицательной',
      'number.max': 'Скидка не может быть больше 100%'
    })
});

// Валидация обновления клиента (все поля опциональные)
const updateClientSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .messages({
      'string.min': 'Имя должно содержать минимум 2 символа',
      'string.max': 'Имя не может быть длиннее 100 символов'
    }),

  phone: Joi.string()
    .pattern(/^(\+380|380|0|8)\d{9}$/)
    .messages({
      'string.pattern.base': 'Телефон должен быть в украинском формате (+380XXXXXXXXX, 0XXXXXXXXX или 8XXXXXXXXX)'
    }),

  age: Joi.number()
    .integer()
    .min(0)
    .max(150)
    .allow(null)
    .messages({
      'number.min': 'Возраст не может быть отрицательным',
      'number.max': 'Возраст не может быть больше 150 лет',
      'number.integer': 'Возраст должен быть целым числом'
    }),

  birthDate: Joi.date()
    .max('now')
    .allow(null)
    .messages({
      'date.max': 'Дата рождения не может быть в будущем'
    }),

  comments: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': 'Комментарий не может быть длиннее 500 символов'
    }),

  source: Joi.string()
    .valid(
      'реклама', 
      'рекомендация', 
      'интернет', 
      'социальные_сети', 
      'прохожий', 
      'постоянный_клиент',
      'МКЛ',
      'другое'
    )
    .messages({
      'any.only': 'Неверный источник привлечения'
    }),

  defaultDiscount: Joi.number()
    .min(0)
    .max(100)
    .messages({
      'number.min': 'Скидка не может быть отрицательной',
      'number.max': 'Скидка не может быть больше 100%'
    })
}).min(1).messages({
  'object.min': 'Необходимо указать хотя бы одно поле для обновления'
});

// Валидация параметров поиска
const searchQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.min': 'Номер страницы должен быть больше 0'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.min': 'Лимит должен быть больше 0',
      'number.max': 'Лимит не может быть больше 100'
    }),

  search: Joi.string()
    .max(100)
    .allow('')
    .messages({
      'string.max': 'Поисковый запрос не может быть длиннее 100 символов'
    }),

  source: Joi.string()
    .valid(
      'реклама', 
      'рекомендация', 
      'интернет', 
      'социальные_сети', 
      'прохожий', 
      'постоянный_клиент',
      'другое'
    )
    .allow('')
    .messages({
      'any.only': 'Неверный источник привлечения'
    }),

  sortBy: Joi.string()
    .valid('name', 'phone', 'createdAt', 'updatedAt', 'age')
    .default('createdAt')
    .messages({
      'any.only': 'Неверное поле для сортировки'
    }),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'any.only': 'Порядок сортировки должен быть asc или desc'
    })
});

// Валидация ID параметра
const idParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Неверный формат ID',
      'any.required': 'ID обязателен'
    })
});

// Валидация телефона для поиска
const phoneParamSchema = Joi.object({
  phone: Joi.string()
    .min(9)
    .max(15)
    .required()
    .messages({
      'string.min': 'Номер телефона слишком короткий',
      'string.max': 'Номер телефона слишком длинный',
      'any.required': 'Номер телефона обязателен'
    })
});

// Middleware для валидации
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = source === 'params' ? req.params : 
                          source === 'query' ? req.query : req.body;

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: source === 'query' // Разрешаем неизвестные поля в query
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

    // Заменяем данные на валидированные
    if (source === 'params') {
      req.params = value;
    } else if (source === 'query') {
      req.query = value;
    } else {
      req.body = value;
    }

    next();
  };
};

// Экспорт валидаторов
const validateCreateClient = validate(createClientSchema);
const validateUpdateClient = validate(updateClientSchema);
const validateSearchQuery = validate(searchQuerySchema, 'query');
const validateIdParam = validate(idParamSchema, 'params');
const validatePhoneParam = validate(phoneParamSchema, 'params');

module.exports = {
  validateCreateClient,
  validateUpdateClient,
  validateSearchQuery,
  validateIdParam,
  validatePhoneParam,
  // Экспорт схем для использования в других местах
  schemas: {
    createClientSchema,
    updateClientSchema,
    searchQuerySchema,
    idParamSchema,
    phoneParamSchema
  }
};
