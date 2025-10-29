const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Основная информация
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Клиент обязателен']
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Ответственный сотрудник обязателен']
  },
  orderDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  deliveryDate: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value >= this.orderDate;
      },
      message: 'Дата выдачи не может быть раньше даты заказа'
    }
  },

  // Тип изделия
  productType: {
    type: String,
    required: [true, 'Тип изделия обязателен'],
    enum: {
      values: ['линзы', 'оправа', 'очки', 'МКЛ', 'аксессуары'],
      message: 'Тип изделия должен быть: линзы, оправа, очки, МКЛ или аксессуары'
    }
  },

  // Информация об оправе
  frame: {
    brand: {
      type: String,
      trim: true,
      maxlength: [50, 'Бренд оправы не может быть длиннее 50 символов']
    },
    model: {
      type: String,
      trim: true,
      maxlength: [50, 'Модель оправы не может быть длиннее 50 символов']
    },
    material: {
      type: String,
      enum: ['пластик', 'металл', 'титан', 'комбинированный', 'другое'],
      default: 'другое'
    },
    color: {
      type: String,
      trim: true,
      maxlength: [30, 'Цвет не может быть длиннее 30 символов']
    },
    size: {
      type: String,
      trim: true,
      maxlength: [20, 'Размер не может быть длиннее 20 символов']
    },
    price: {
      type: Number,
      min: [0, 'Цена оправы не может быть отрицательной']
    }
  },

  // Информация о линзах
  lenses: {
    brand: {
      type: String,
      trim: true,
      maxlength: [50, 'Бренд линз не может быть длиннее 50 символов']
    },
    type: {
      type: String,
      enum: ['однофокальные', 'прогрессивные', 'бифокальные', 'другое'],
      default: 'однофокальные'
    },
    material: {
      type: String,
      enum: ['пластик', 'поликарбонат', 'стекло', 'тривекс', 'другое'],
      default: 'пластик'
    },
    coating: [{
      type: String,
      enum: ['фотохром', 'UV-защита', 'антиблик', 'антистатик', 'гидрофобное', 'другое']
    }],
    index: {
      type: Number,
      min: [1.0, 'Индекс преломления не может быть меньше 1.0'],
      max: [2.0, 'Индекс преломления не может быть больше 2.0']
    },
    price: {
      type: Number,
      min: [0, 'Цена линз не может быть отрицательной']
    }
  },

  // Рецепт
  prescription: {
    rightEye: {
      sphere: {
        type: Number,
        min: [-30, 'Сфера правого глаза не может быть меньше -30'],
        max: [30, 'Сфера правого глаза не может быть больше +30']
      },
      cylinder: {
        type: Number,
        min: [-10, 'Цилиндр правого глаза не может быть меньше -10'],
        max: [10, 'Цилиндр правого глаза не может быть больше +10']
      },
      axis: {
        type: Number,
        min: [0, 'Ось правого глаза не может быть меньше 0'],
        max: [180, 'Ось правого глаза не может быть больше 180']
      },
      addition: {
        type: Number,
        min: [0, 'Аддидация не может быть отрицательной'],
        max: [5, 'Аддидация не может быть больше +5']
      }
    },
    leftEye: {
      sphere: {
        type: Number,
        min: [-30, 'Сфера левого глаза не может быть меньше -30'],
        max: [30, 'Сфера левого глаза не может быть больше +30']
      },
      cylinder: {
        type: Number,
        min: [-10, 'Цилиндр левого глаза не может быть меньше -10'],
        max: [10, 'Цилиндр левого глаза не может быть больше +10']
      },
      axis: {
        type: Number,
        min: [0, 'Ось левого глаза не может быть меньше 0'],
        max: [180, 'Ось левого глаза не может быть больше 180']
      },
      addition: {
        type: Number,
        min: [0, 'Аддидация не может быть отрицательной'],
        max: [5, 'Аддидация не может быть больше +5']
      }
    },
    pd: {
      type: Number,
      min: [50, 'Межзрачковое расстояние не может быть меньше 50мм'],
      max: [80, 'Межзрачковое расстояние не может быть больше 80мм']
    },
    purpose: {
      type: String,
      enum: ['для дали', 'для близи', 'для постоянного ношения', 'для компьютера', 'другое'],
      default: 'для постоянного ношения'
    }
  },

  // Финансовая информация
  totalPrice: {
    type: Number,
    required: [true, 'Общая стоимость обязательна'],
    min: [0, 'Стоимость не может быть отрицательной']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Скидка не может быть отрицательной'],
    max: [100, 'Скидка не может быть больше 100%']
  },
  prepayment: {
    type: Number,
    default: 0,
    min: [0, 'Предоплата не может быть отрицательной']
  },
  paymentMethod: {
    type: String,
    enum: {
      values: ['наличные', 'безналичные', 'смешанная'],
      message: 'Способ оплаты должен быть: наличные, безналичные или смешанная'
    },
    default: 'наличные'
  },
  paymentStatus: {
    type: String,
    enum: {
      values: ['не_оплачен', 'частично_оплачен', 'оплачен'],
      message: 'Статус оплаты должен быть: не_оплачен, частично_оплачен или оплачен'
    },
    default: 'не_оплачен'
  },

  // Статус заказа
  status: {
    type: String,
    enum: {
      values: ['черновик', 'в_работе', 'готов', 'выдан', 'отменен'],
      message: 'Статус должен быть: черновик, в_работе, готов, выдан или отменен'
    },
    default: 'черновик'
  },

  // Комментарии
  masterComments: {
    type: String,
    maxlength: [1000, 'Комментарий мастера не может быть длиннее 1000 символов']
  },
  orderComments: {
    type: String,
    maxlength: [1000, 'Комментарий к заказу не может быть длиннее 1000 символов']
  },

  // Уведомления
  smsNotificationSent: {
    type: Boolean,
    default: false
  },
  smsNotificationDate: {
    type: Date
  },

  // Метаданные
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Индексы для быстрого поиска
orderSchema.index({ clientId: 1 });
orderSchema.index({ employeeId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderDate: -1 });
orderSchema.index({ deliveryDate: 1 });
orderSchema.index({ createdAt: -1 });

// Виртуальное поле для остатка к доплате
orderSchema.virtual('remainingPayment').get(function() {
  const discountAmount = (this.totalPrice * this.discount) / 100;
  const finalPrice = this.totalPrice - discountAmount;
  return Math.max(0, finalPrice - this.prepayment);
});

// Виртуальное поле для финальной цены с учетом скидки
orderSchema.virtual('finalPrice').get(function() {
  const discountAmount = (this.totalPrice * this.discount) / 100;
  return this.totalPrice - discountAmount;
});

// Виртуальное поле для статуса на русском
orderSchema.virtual('statusRu').get(function() {
  const statuses = {
    черновик: 'Черновик',
    в_работе: 'В работе',
    готов: 'Готов',
    выдан: 'Выдан',
    отменен: 'Отменен'
  };
  return statuses[this.status] || this.status;
});

// Middleware для автоматического расчета цены
orderSchema.pre('save', function(next) {
  // Если не указана общая стоимость, рассчитываем из компонентов
  if (!this.totalPrice && (this.frame?.price || this.lenses?.price)) {
    this.totalPrice = (this.frame?.price || 0) + (this.lenses?.price || 0);
  }
  
  // Проверяем, что предоплата не больше финальной цены
  const discountAmount = (this.totalPrice * this.discount) / 100;
  const finalPrice = this.totalPrice - discountAmount;
  
  if (this.prepayment > finalPrice) {
    this.prepayment = finalPrice;
  }
  
  // Автоматически обновляем статус оплаты
  if (this.prepayment === 0) {
    this.paymentStatus = 'не_оплачен';
  } else if (this.prepayment >= finalPrice) {
    this.paymentStatus = 'оплачен';
  } else {
    this.paymentStatus = 'частично_оплачен';
  }
  
  next();
});

// Метод для отправки SMS уведомления
orderSchema.methods.markSMSSent = function() {
  this.smsNotificationSent = true;
  this.smsNotificationDate = new Date();
  return this.save({ validateBeforeSave: false });
};

// Статический метод для получения статистики заказов
orderSchema.statics.getOrderStats = function(startDate, endDate, filters = {}) {
  const matchStage = {
    createdAt: {
      $gte: startDate,
      $lte: endDate
    },
    ...filters
  };

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalPrice' },
        avgOrderValue: { $avg: '$totalPrice' },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'выдан'] }, 1, 0] }
        }
      }
    }
  ]);
};

// Настройки JSON вывода
orderSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Order', orderSchema);
