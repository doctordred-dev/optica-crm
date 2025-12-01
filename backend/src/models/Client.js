const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Имя клиента обязательно'],
    trim: true,
    maxlength: [100, 'Имя не может быть длиннее 100 символов']
  },
  phone: {
    type: String,
    required: [true, 'Телефон обязателен'],
    unique: true,
    match: [
      /^\+380\d{9}$/,
      'Телефон должен быть в формате +380XXXXXXXXX'
    ]
  },
  age: {
    type: Number,
    min: [0, 'Возраст не может быть отрицательным'],
    max: [150, 'Возраст не может быть больше 150 лет']
  },
  birthDate: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value <= new Date();
      },
      message: 'Дата рождения не может быть в будущем'
    }
  },
  comments: {
    type: String,
    maxlength: [500, 'Комментарий не может быть длиннее 500 символов']
  },
  source: {
    type: String,
    enum: {
      values: [
        'реклама', 
        'рекомендация', 
        'интернет', 
        'социальные_сети', 
        'прохожий', 
        'постоянный_клиент',
        'МКЛ',
        'другое'
      ],
      message: 'Неверный источник привлечения'
    },
    default: 'другое'
  },
  defaultDiscount: {
    type: Number,
    min: [0, 'Скидка не может быть отрицательной'],
    max: [100, 'Скидка не может быть больше 100%'],
    default: 0
  },
  // Заказы будут получены через виртуальное поле
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
clientSchema.index({ phone: 1 });
clientSchema.index({ name: 'text' });
clientSchema.index({ createdAt: -1 });

// Виртуальное поле для форматированного телефона
clientSchema.virtual('formattedPhone').get(function() {
  if (!this.phone) return '';
  // +380123456789 -> +38 (012) 345-67-89
  const phone = this.phone;
  return `${phone.slice(0, 3)} (${phone.slice(3, 6)}) ${phone.slice(6, 9)}-${phone.slice(9, 11)}-${phone.slice(11)}`;
});

// Виртуальное поле для возраста из даты рождения
clientSchema.virtual('calculatedAge').get(function() {
  if (!this.birthDate) return this.age;
  
  const today = new Date();
  const birthDate = new Date(this.birthDate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Метод для получения статистики клиента
clientSchema.methods.getStats = async function() {
  try {
    const Order = mongoose.model('Order');
    
    const stats = await Order.aggregate([
      { $match: { clientId: this._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalPrice' },
          avgOrderValue: { $avg: '$totalPrice' },
          lastOrderDate: { $max: '$createdAt' }
        }
      }
    ]);
    
    return stats[0] || {
      totalOrders: 0,
      totalSpent: 0,
      avgOrderValue: 0,
      lastOrderDate: null
    };
  } catch (error) {
    // Если модель Order еще не зарегистрирована, возвращаем пустую статистику
    return {
      totalOrders: 0,
      totalSpent: 0,
      avgOrderValue: 0,
      lastOrderDate: null
    };
  }
};

// Middleware для нормализации телефона перед сохранением
clientSchema.pre('save', function(next) {
  if (this.isModified('phone')) {
    // Удаляем все символы кроме цифр и +
    let phone = this.phone.replace(/[^\d+]/g, '');
    
    // Если начинается с 380, добавляем +
    if (phone.startsWith('380')) {
      phone = '+' + phone;
    }
    // Если начинается с 0, заменяем на +380
    else if (phone.startsWith('0')) {
      phone = '+38' + phone;
    }
    // Если начинается с 8, заменяем на +380
    else if (phone.startsWith('8')) {
      phone = '+38' + phone.substring(1);
    }
    
    this.phone = phone;
  }
  next();
});

// Настройки JSON вывода
clientSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Client', clientSchema);
