# Backend Design - Optika CRM

## 🎯 Анализ требований

### Основные сущности:
1. **Клиенты** - хранение персональных данных и истории
2. **Заказы** - сложная структура с рецептами, описанием товаров, статусами
3. **Сотрудники** - система ролей и авторизации
4. **SMS-уведомления** - интеграция с внешними сервисами
5. **Аналитика** - отчеты и статистика

### Ключевые особенности:
- Сложные связи между сущностями
- Система ролей и прав доступа
- SMS-интеграция
- Файловое хранение (фото, документы)
- Логирование действий
- Аналитика и отчетность

## 🛠 Рекомендуемый технологический стек

### Backend Framework: **Node.js + Express.js**
**Почему:**
- Быстрая разработка REST API
- Богатая экосистема пакетов
- Хорошая поддержка MongoDB
- Легкая интеграция с SMS-сервисами
- Асинхронная обработка уведомлений

### База данных: **MongoDB + Mongoose**
**Почему:**
- Гибкая схема для сложных документов (заказы с рецептами)
- Хорошо подходит для вложенных структур
- Простое масштабирование
- Atlas для автоматических бэкапов
- Агрегационный pipeline для аналитики

### Аутентификация: **JWT + bcrypt**
**Почему:**
- Stateless авторизация
- Легкая реализация ролевой модели
- Безопасное хранение паролей

### Файловое хранение: **Multer + AWS S3 / Cloudinary**
**Почему:**
- Масштабируемость
- CDN для быстрой загрузки
- Автоматическая оптимизация изображений

### SMS-сервис: **Twilio / SMS.ru**
**Почему:**
- Надежная доставка
- Простое API
- Поддержка шаблонов

### Дополнительные библиотеки:
- **joi** - валидация данных
- **winston** - логирование
- **node-cron** - планировщик задач
- **helmet** - безопасность
- **cors** - CORS политики
- **compression** - сжатие ответов

## 🏗 Архитектура системы

### Структура проекта:
```
backend/
├── src/
│   ├── controllers/     # Контроллеры API
│   ├── models/         # Mongoose модели
│   ├── routes/         # Маршруты API
│   ├── middleware/     # Промежуточное ПО
│   ├── services/       # Бизнес-логика
│   ├── utils/          # Утилиты
│   ├── config/         # Конфигурация
│   └── validators/     # Схемы валидации
├── uploads/            # Временные файлы
├── tests/              # Тесты
└── docs/               # API документация
```

### Слоистая архитектура:
1. **Routes** - маршрутизация и валидация
2. **Controllers** - обработка HTTP запросов
3. **Services** - бизнес-логика
4. **Models** - работа с данными
5. **Utils** - вспомогательные функции

## 📊 Модели данных

### 1. User (Сотрудники)
```javascript
{
  _id: ObjectId,
  email: String,
  password: String, // хешированный
  name: String,
  role: String, // admin, manager, master, viewer
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### 2. Client (Клиенты)
```javascript
{
  _id: ObjectId,
  name: String,
  phone: String, // +380XXXXXXXXX формат
  age: Number,
  birthDate: Date,
  comments: String,
  source: String, // источник привлечения
  orders: [ObjectId], // ссылки на заказы
  createdAt: Date,
  updatedAt: Date
}
```


### 3. Order (Заказы)
```javascript
{
  _id: ObjectId,
  clientId: ObjectId,
  employeeId: ObjectId, // ответственный
  orderDate: Date,
  deliveryDate: Date,
  
  // Информация о товарах (ручной ввод)
  productType: String, // линзы, оправа, очки, МКЛ, аксессуары
  
  // Оправа
  frame: {
    brand: String,
    model: String,
    material: String,
    color: String,
    size: String,
    price: Number
  },
  
  // Линзы
  lenses: {
    brand: String,
    type: String, // однофокальные, прогрессивные, бифокальные
    material: String, // пластик, поликарбонат, стекло
    coating: [String], // фотохром, UV-защита, антиблик
    index: Number, // индекс преломления
    price: Number
  },
  
  // Рецепт
  prescription: {
    rightEye: {
      sphere: Number,
      cylinder: Number,
      axis: Number,
      addition: Number
    },
    leftEye: {
      sphere: Number,
      cylinder: Number,
      axis: Number,
      addition: Number
    },
    pd: Number, // межзрачковое расстояние
    purpose: String // назначение рецепта
  },
  
  // Финансы
  totalPrice: Number,
  discount: Number,
  prepayment: Number,
  paymentMethod: String, // cash, card
  paymentStatus: String, // pending, partial, paid
  
  // Статус
  status: String, // draft, in_progress, ready, delivered
  masterComments: String,
  orderComments: String,
  
  // Метаданные
  createdAt: Date,
  updatedAt: Date
}
```

### 4. SMSTemplate (Шаблоны SMS)
```javascript
{
  _id: ObjectId,
  name: String,
  template: String, // с плейсхолдерами {clientName}, {orderNumber}
  triggerEvent: String, // order_ready, order_delivered
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### 5. ActionLog (Логи действий)
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  action: String, // create_order, update_status, send_sms
  entityType: String, // order, client, product
  entityId: ObjectId,
  details: Object, // дополнительная информация
  timestamp: Date
}
```

## 🔐 Система авторизации и ролей

### Роли и права:
- **admin**: полный доступ ко всему
- **manager**: создание заказов, управление клиентами, просмотр аналитики
- **master**: изменение статусов заказов, комментарии
- **viewer**: только просмотр данных

### Middleware для проверки прав:
```javascript
const authorize = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
};
```

## 📡 API Endpoints

### Аутентификация:
- `POST /api/auth/login` - вход в систему
- `POST /api/auth/logout` - выход
- `GET /api/auth/me` - текущий пользователь

### Клиенты:
- `GET /api/clients` - список клиентов
- `POST /api/clients` - создание клиента
- `GET /api/clients/:id` - клиент по ID
- `PUT /api/clients/:id` - обновление клиента
- `DELETE /api/clients/:id` - удаление клиента
- `GET /api/clients/:id/orders` - заказы клиента

### Заказы:
- `GET /api/orders` - список заказов
- `POST /api/orders` - создание заказа
- `GET /api/orders/:id` - заказ по ID
- `PUT /api/orders/:id` - обновление заказа
- `PUT /api/orders/:id/status` - изменение статуса
- `POST /api/orders/:id/notify` - отправка SMS


### Аналитика:
- `GET /api/analytics/sales` - статистика продаж
- `GET /api/analytics/employees` - по сотрудникам
- `GET /api/analytics/brands` - популярные бренды

### Файлы:
- `POST /api/upload` - загрузка файлов
- `GET /api/files/:id` - получение файла

## 🔧 Сервисы

### SMSService:
```javascript
class SMSService {
  async sendOrderReady(clientPhone, orderNumber) {
    const template = await SMSTemplate.findOne({ 
      triggerEvent: 'order_ready' 
    });
    const message = template.template
      .replace('{orderNumber}', orderNumber);
    
    return await this.sendSMS(clientPhone, message);
  }
}
```

### AnalyticsService:
```javascript
class AnalyticsService {
  async getSalesReport(startDate, endDate) {
    return await Order.aggregate([
      { $match: { 
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'delivered'
      }},
      { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }},
        totalSales: { $sum: "$totalPrice" },
        ordersCount: { $sum: 1 }
      }}
    ]);
  }

  async getPopularBrands(startDate, endDate) {
    return await Order.aggregate([
      { $match: { 
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'delivered'
      }},
      { $group: {
        _id: "$frame.brand",
        count: { $sum: 1 },
        totalRevenue: { $sum: "$frame.price" }
      }},
      { $sort: { count: -1 } }
    ]);
  }
}
```

## 🚀 Этапы разработки

### Фаза 1: Основа (1-2 недели)
1. Настройка проекта и зависимостей
2. Подключение MongoDB
3. Базовые модели (User, Client, Order)
4. Аутентификация и авторизация
5. CRUD операции для клиентов и заказов

### Фаза 2: Бизнес-логика (1-2 недели)
1. Сложная логика заказов
2. Система статусов
3. Валидация данных
4. Логирование действий

### Фаза 3: Интеграции (1 неделя)
1. SMS-сервис
2. Файловое хранение
3. Шаблоны уведомлений

### Фаза 4: Аналитика (1 неделя)
1. Отчеты по продажам
2. Статистика по сотрудникам
3. Популярные бренды и типы товаров

### Фаза 5: Оптимизация (1 неделя)
1. Индексы в БД
2. Кеширование
3. Тестирование
4. Документация API

## 🔒 Безопасность

1. **Валидация входных данных** - joi схемы
2. **Санитизация** - защита от NoSQL инъекций
3. **Rate limiting** - ограничение запросов
4. **HTTPS** - шифрование трафика
5. **Helmet** - заголовки безопасности
6. **CORS** - контроль доступа

## 📈 Масштабирование

1. **Индексы БД** - для быстрых запросов
2. **Пагинация** - для больших списков
3. **Кеширование** - Redis для частых запросов
4. **Файловое хранение** - CDN для статики
5. **Мониторинг** - логи и метрики

## 🧪 Тестирование

1. **Unit тесты** - Jest для сервисов
2. **Integration тесты** - для API endpoints
3. **E2E тесты** - критические сценарии
4. **Load тесты** - производительность

Эта архитектура обеспечивает:
- ✅ Масштабируемость
- ✅ Безопасность  
- ✅ Простоту поддержки
- ✅ Гибкость расширения
- ✅ Производительность
