# 📚 API Документация для Frontend - Optika CRM

## 🔗 Base URL
```
Production: https://your-app.onrender.com
Development: http://localhost:7001
```

Все эндпоинты начинаются с `/api`

---

## 🔐 Аутентификация

### Формат токена
```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

### POST /api/auth/login - Вход
**Body:**
```json
{
  "email": "admin@optica.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "...", "email": "...", "name": "...", "role": "admin" },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "..."
  }
}
```

### GET /api/auth/me - Текущий пользователь
### POST /api/auth/refresh - Обновить токен
### POST /api/auth/logout - Выход

---

## 👥 Клиенты

### GET /api/clients - Список клиентов
**Query params:**
- `page` (number) - номер страницы, default: 1
- `limit` (number) - количество, default: 20
- `search` (string) - поиск по имени/телефону
- `source` (string) - источник привлечения
- `ageMin`, `ageMax` (number) - фильтр по возрасту
- `hasOrders` (boolean) - есть ли заказы
- `createdFrom`, `createdTo` (date) - период создания
- `sortBy` (string) - поле сортировки
- `sortOrder` (string) - asc/desc
- `includeStats` (boolean) - включить статистику

**Response:**
```json
{
  "success": true,
  "data": {
    "clients": [{
      "_id": "...",
      "name": "Иван Петров",
      "phone": "+380501234567",
      "formattedPhone": "+38 (050) 123-45-67",
      "age": 35,
      "source": "реклама",
      "stats": {
        "totalOrders": 5,
        "totalSpent": 15000,
        "avgOrderValue": 3000
      }
    }],
    "pagination": { "current": 1, "pages": 5, "total": 100, "limit": 20 }
  }
}
```

### POST /api/clients - Создать клиента
**Body:** `{ name, phone, age?, birthDate?, source?, comments? }`

### GET /api/clients/:id - Получить клиента
### PUT /api/clients/:id - Обновить клиента
### DELETE /api/clients/:id - Удалить клиента
### GET /api/clients/:id/orders - Заказы клиента

---

## 📦 Заказы

### GET /api/orders - Список заказов
**Query params:**
- `page`, `limit` - пагинация
- `status` - черновик, в_работе, готов, выдан, отменен
- `clientId`, `employeeId` - фильтры
- `startDate`, `endDate` - период

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [{
      "_id": "...",
      "clientId": { "name": "...", "phone": "..." },
      "employeeId": { "name": "..." },
      "orderDate": "2024-11-20T10:00:00.000Z",
      "deliveryDate": "2024-11-25T10:00:00.000Z",
      "productType": "очки",
      "frame": { "brand": "Ray-Ban", "model": "Aviator", "price": 5000 },
      "lenses": { "brand": "Essilor", "type": "однофокальные", "price": 3000 },
      "prescription": {
        "rightEye": { "sphere": -2.5, "cylinder": -0.5, "axis": 90 },
        "leftEye": { "sphere": -2.0, "cylinder": -0.75, "axis": 85 },
        "pd": 64
      },
      "totalPrice": 8000,
      "discount": 10,
      "prepayment": 4000,
      "finalPrice": 7200,
      "remainingPayment": 3200,
      "status": "в_работе"
    }],
    "pagination": { ... }
  }
}
```

### POST /api/orders - Создать заказ
**Body:** `{ clientId, employeeId, productType, totalPrice, frame?, lenses?, prescription?, ... }`

### PUT /api/orders/:id - Обновить заказ
### PUT /api/orders/:id/status - Изменить статус
**Body:** `{ status, masterComments? }`

### POST /api/orders/:id/notify - Отправить SMS

---

## 🛍️ Товары

### GET /api/products - Список товаров
**Query params:**
- `type` - frame, lens, accessory, contact_lens
- `brand` - бренд
- `minPrice`, `maxPrice` - диапазон цен
- `inStock` - в наличии
- `search` - текстовый поиск

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [{
      "_id": "...",
      "type": "frame",
      "brand": "Ray-Ban",
      "model": "Aviator",
      "name": "Классические авиаторы",
      "frameSpecs": { "material": "металл", "color": "золотой", "size": "58-14-140" },
      "price": 5000,
      "stock": 15,
      "sku": "FR-RAY-123456",
      "fullName": "Ray-Ban Aviator Классические авиаторы"
    }],
    "pagination": { ... }
  }
}
```

### POST /api/products - Создать товар
### PUT /api/products/:id - Обновить товар
### PATCH /api/products/:id/stock - Обновить остаток
**Body:** `{ quantity, operation: "set"|"add"|"subtract" }`

### GET /api/products/popular/:type - Популярные товары
### GET /api/products/low-stock - Товары с низким остатком

---

## 📊 Аналитика

### GET /api/analytics/sales - Статистика продаж
**Query params:** `startDate`, `endDate`, `groupBy` (day/week/month)

**Response:**
```json
{
  "success": true,
  "data": {
    "salesByPeriod": [{ "_id": "2024-11-20", "totalOrders": 15, "totalRevenue": 45000 }],
    "totalStats": { "totalOrders": 450, "totalRevenue": 1350000, "avgOrderValue": 3000 },
    "statusStats": [{ "_id": "выдан", "count": 350, "totalRevenue": 1050000 }],
    "paymentStats": [{ "_id": "наличные", "count": 200, "totalRevenue": 600000 }]
  }
}
```

### GET /api/analytics/employees - По сотрудникам
### GET /api/analytics/brands - Популярные бренды
### GET /api/analytics/overview - Dashboard (общая статистика)
### GET /api/analytics/clients - По клиентам

---

## 📤 Экспорт

### GET /api/export/clients - Экспорт клиентов в CSV
### GET /api/export/orders - Экспорт заказов в CSV
### GET /api/export/sales - Экспорт продаж в CSV

---

## 📱 SMS

### GET /api/sms/templates - Шаблоны SMS
### POST /api/sms/templates - Создать шаблон
### POST /api/sms/send - Отправить SMS
**Body:** `{ phone, message }`

### GET /api/sms/balance - Баланс SMS

---

## 🔑 Роли

| Роль | Доступ |
|------|--------|
| admin | Полный доступ |
| manager | Заказы, клиенты, аналитика |
| master | Изменение статусов |
| viewer | Только просмотр |

---

## 📝 Пример использования (React)

```javascript
const API_URL = 'http://localhost:7001/api';

export const apiClient = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error);
    return data;
  },

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', data.data.token);
    return data;
  },

  async getClients(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/clients?${query}`);
  },

  async createOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  async getSalesAnalytics(startDate, endDate) {
    return this.request(`/analytics/sales?startDate=${startDate}&endDate=${endDate}`);
  },
};
```

---

## ⚠️ Коды ответов

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 201 | Создано |
| 400 | Неверный запрос |
| 401 | Не авторизован |
| 403 | Доступ запрещен |
| 404 | Не найдено |
| 500 | Ошибка сервера |

Все ошибки: `{ "success": false, "error": "Описание" }`
