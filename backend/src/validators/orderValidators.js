const Joi = require('joi');

// Схема для рецепта глаза
const eyeSchema = Joi.object({
  sphere: Joi.number().min(-30).max(30).allow(null, ''),
  cylinder: Joi.number().min(-10).max(10).allow(null, ''),
  axis: Joi.number().min(0).max(180).allow(null, ''),
  addition: Joi.number().min(0).max(5).allow(null, '')
}).allow(null);

// Схема для рецепта
const prescriptionSchema = Joi.object({
  rightEye: eyeSchema,
  leftEye: eyeSchema,
  pd: Joi.number().min(50).max(80).allow(null, ''),
  purpose: Joi.string().valid(
    'для дали', 
    'для близи', 
    'для постоянного ношения', 
    'для компьютера', 
    'другое'
  ).allow('', null).default('для постоянного ношения')
}).allow(null);

// Схема для оправы
const frameSchema = Joi.object({
  brand: Joi.string().max(50).allow(''),
  model: Joi.string().max(50).allow(''),
  material: Joi.string().valid(
    'пластик', 
    'металл', 
    'титан', 
    'комбинированный', 
    'другое'
  ).allow(''),
  color: Joi.string().max(30).allow(''),
  size: Joi.string().max(20).allow(''),
  price: Joi.number().min(0).allow(null)
}).allow(null);

// Схема для линз
const lensesSchema = Joi.object({
  brand: Joi.string().max(50).allow(''),
  model: Joi.string().max(50).allow(''),
  type: Joi.string().valid(
    'однофокальные', 
    'прогрессивные', 
    'бифокальные', 
    'другое'
  ).allow(''),
  material: Joi.string().valid(
    'пластик', 
    'поликарбонат', 
    'стекло', 
    'тривекс', 
    'другое'
  ).allow(''),
  coating: Joi.array().items(
    Joi.string().valid(
      'фотохром', 
      'UV-защита', 
      'антиблик', 
      'антистатик', 
      'гидрофобное', 
      'другое'
    )
  ),
  index: Joi.number().min(1.0).max(2.0).allow(null),
  price: Joi.number().min(0).allow(null)
}).allow(null);

// Валидация создания заказа
const createOrderSchema = Joi.object({
  clientId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Неверный формат ID клиента',
      'any.required': 'ID клиента обязателен'
    }),

  employeeId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Неверный формат ID сотрудника'
    }),

  orderDate: Joi.date().default(() => new Date()),

  deliveryDate: Joi.date()
    .greater('now')
    .allow(null)
    .messages({
      'date.greater': 'Дата выдачи должна быть в будущем'
    }),

  productType: Joi.string()
    .valid('линзы', 'оправа', 'очки', 'МКЛ', 'аксессуары')
    .required()
    .messages({
      'any.only': 'Тип изделия должен быть: линзы, оправа, очки, МКЛ или аксессуары',
      'any.required': 'Тип изделия обязателен'
    }),

  frame: frameSchema,
  lenses: lensesSchema,
  prescription: prescriptionSchema,

  totalPrice: Joi.number()
    .min(0)
    .required()
    .messages({
      'number.min': 'Стоимость не может быть отрицательной',
      'any.required': 'Общая стоимость обязательна'
    }),

  discount: Joi.number()
    .min(0)
    .max(100)
    .default(0)
    .messages({
      'number.min': 'Скидка не может быть отрицательной',
      'number.max': 'Скидка не может быть больше 100%'
    }),

  prepayment: Joi.number()
    .min(0)
    .default(0)
    .messages({
      'number.min': 'Предоплата не может быть отрицательной'
    }),

  paymentMethod: Joi.string()
    .valid('наличные', 'безналичные', 'смешанная')
    .default('наличные')
    .messages({
      'any.only': 'Способ оплаты должен быть: наличные, безналичные или смешанная'
    }),

  status: Joi.string()
    .valid('черновик', 'в_работе', 'готов', 'выдан', 'отменен')
    .default('черновик')
    .messages({
      'any.only': 'Статус должен быть: черновик, в_работе, готов, выдан или отменен'
    }),

  masterComments: Joi.string()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'Комментарий мастера не может быть длиннее 1000 символов'
    }),

  orderComments: Joi.string()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'Комментарий к заказу не может быть длиннее 1000 символов'
    })
});

// Валидация обновления заказа
const updateOrderSchema = Joi.object({
  employeeId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Неверный формат ID сотрудника'
    }),

  deliveryDate: Joi.date()
    .allow(null)
    .messages({
      'date.base': 'Неверный формат даты выдачи'
    }),

  productType: Joi.string()
    .valid('линзы', 'оправа', 'очки', 'МКЛ', 'аксессуары')
    .messages({
      'any.only': 'Тип изделия должен быть: линзы, оправа, очки, МКЛ или аксессуары'
    }),

  frame: frameSchema,
  lenses: lensesSchema,
  prescription: prescriptionSchema,

  totalPrice: Joi.number()
    .min(0)
    .messages({
      'number.min': 'Стоимость не может быть отрицательной'
    }),

  discount: Joi.number()
    .min(0)
    .max(100)
    .messages({
      'number.min': 'Скидка не может быть отрицательной',
      'number.max': 'Скидка не может быть больше 100%'
    }),

  prepayment: Joi.number()
    .min(0)
    .messages({
      'number.min': 'Предоплата не может быть отрицательной'
    }),

  paymentMethod: Joi.string()
    .valid('наличные', 'безналичные', 'смешанная')
    .messages({
      'any.only': 'Способ оплаты должен быть: наличные, безналичные или смешанная'
    }),

  status: Joi.string()
    .valid('черновик', 'в_работе', 'готов', 'выдан', 'отменен')
    .messages({
      'any.only': 'Статус должен быть: черновик, в_работе, готов, выдан или отменен'
    }),

  masterComments: Joi.string()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'Комментарий мастера не может быть длиннее 1000 символов'
    }),

  orderComments: Joi.string()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'Комментарий к заказу не может быть длиннее 1000 символов'
    })
}).min(1).messages({
  'object.min': 'Необходимо указать хотя бы одно поле для обновления'
});

// Валидация изменения статуса
const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid('черновик', 'в_работе', 'готов', 'выдан', 'отменен')
    .required()
    .messages({
      'any.only': 'Статус должен быть: черновик, в_работе, готов, выдан или отменен',
      'any.required': 'Статус обязателен'
    })
});

// Валидация параметров поиска заказов
const searchOrdersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(100).allow('').messages({
    'string.max': 'Поисковый запрос не может быть длиннее 100 символов'
  }),
  status: Joi.string().valid(
    'черновик', 
    'в_работе', 
    'готов', 
    'выдан', 
    'отменен'
  ).allow(''),
  clientId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(''),
  employeeId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(''),
  startDate: Joi.date().allow(''),
  endDate: Joi.date().allow(''),
  sortBy: Joi.string().valid(
    'createdAt', 
    'orderDate', 
    'deliveryDate', 
    'totalPrice', 
    'status'
  ).default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
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

// Middleware для валидации
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = source === 'params' ? req.params : 
                          source === 'query' ? req.query : req.body;

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: source === 'query'
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
const validateCreateOrder = validate(createOrderSchema);
const validateUpdateOrder = validate(updateOrderSchema);
const validateUpdateStatus = validate(updateStatusSchema);
const validateSearchOrders = validate(searchOrdersSchema, 'query');
const validateIdParam = validate(idParamSchema, 'params');

module.exports = {
  validateCreateOrder,
  validateUpdateOrder,
  validateUpdateStatus,
  validateSearchOrders,
  validateIdParam,
  // Экспорт схем для использования в других местах
  schemas: {
    createOrderSchema,
    updateOrderSchema,
    updateStatusSchema,
    searchOrdersSchema,
    idParamSchema
  }
};
