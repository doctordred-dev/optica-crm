# Документация API аутентификации

## Обзор

API аутентификации предоставляет эндпоинты для регистрации, входа, обновления токенов и управления сессиями пользователей.

---

## 1. Регистрация пользователя

### Эндпоинт
```
POST /api/auth/register
```

### Доступ
**Private** - требуется аутентификация и роль `admin`

### Описание
Создает нового пользователя в системе. Доступен только администраторам.

### Headers
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Request Body
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "Имя Пользователя",
  "role": "manager"
}
```

#### Параметры
| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| email | string | Да | Email пользователя (уникальный) |
| password | string | Да | Пароль (минимум 6 символов) |
| name | string | Да | Полное имя пользователя |
| role | string | Нет | Роль пользователя: `admin`, `manager`, `viewer` (по умолчанию `viewer`) |

### Response (201 Created)
```json
{
  "success": true,
  "message": "Пользователь успешно зарегистрирован",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "name": "Имя Пользователя",
      "role": "manager",
      "roleRu": "Менеджер"
    }
  }
}
```

### Возможные ошибки
| Код | Описание |
|-----|----------|
| 400 | Пользователь с таким email уже существует |
| 401 | Не авторизован |
| 403 | Недостаточно прав (не админ) |
| 500 | Ошибка сервера |

### Процесс работы
1. **Middleware `authenticate`** - проверяет JWT токен в заголовке Authorization
2. **Middleware `authorize('admin')`** - проверяет роль пользователя
3. **Middleware `validateRegister`** - валидирует входные данные
4. **Контроллер:**
   - Проверяет, не существует ли пользователь с таким email
   - Создает нового пользователя (пароль автоматически хешируется bcrypt)
   - Логирует действие в ActionLog
   - Возвращает данные пользователя (без пароля)

### Пример использования
```javascript
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    email: 'newuser@example.com',
    password: 'securePass123',
    name: 'Новый Пользователь',
    role: 'manager'
  })
});

const data = await response.json();
```

---

## 2. Вход в систему (Login)

### Эндпоинт
```
POST /api/auth/login
```

### Доступ
**Public** - доступен без аутентификации

### Описание
Аутентифицирует пользователя и возвращает JWT токены для доступа к защищенным эндпоинтам.

### Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

#### Параметры
| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| email | string | Да | Email пользователя |
| password | string | Да | Пароль пользователя |

### Response (200 OK)
```json
{
  "success": true,
  "message": "Успешный вход в систему",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "name": "Имя Пользователя",
      "role": "manager",
      "roleRu": "Менеджер",
      "lastLogin": "2025-12-16T15:16:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

#### Токены
- **accessToken** - короткоживущий токен (15 минут) для доступа к API
- **refreshToken** - долгоживущий токен (7 дней) для обновления accessToken

### Возможные ошибки
| Код | Описание |
|-----|----------|
| 400 | Email и пароль обязательны |
| 401 | Неверные учетные данные |
| 401 | Аккаунт деактивирован |
| 500 | Ошибка сервера |

### Процесс работы
1. **Middleware `validateLogin`** - валидирует email и password
2. **Контроллер:**
   - Проверяет наличие обязательных полей
   - Ищет пользователя по email (включая поле password)
   - **Если пользователь не найден:**
     - Логирует неудачную попытку в ActionLog
     - Возвращает 401 ошибку
   - **Проверяет активность аккаунта:**
     - Если `isActive = false`, логирует и возвращает ошибку
   - **Проверяет пароль:**
     - Сравнивает введенный пароль с хешем через bcrypt
     - При несовпадении логирует и возвращает ошибку
   - **При успешной аутентификации:**
     - Обновляет поле `lastLogin` пользователя
     - Генерирует пару JWT токенов (access + refresh)
     - Логирует успешный вход в ActionLog
     - Возвращает данные пользователя и токены

### Безопасность
- Все неудачные попытки входа логируются с IP-адресом и User-Agent
- Пароли хранятся в виде bcrypt хешей
- Используется одинаковое сообщение об ошибке для несуществующих пользователей и неверных паролей (защита от перебора email)

### Пример использования
```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'myPassword123'
  })
});

const data = await response.json();

if (data.success) {
  // Сохраняем токены
  localStorage.setItem('accessToken', data.data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
  
  // Сохраняем данные пользователя
  localStorage.setItem('user', JSON.stringify(data.data.user));
}
```

---

## 3. Обновление токена

### Эндпоинт
```
POST /api/auth/refresh
```

### Доступ
**Public** - доступен без аутентификации

### Описание
Обновляет истекший accessToken используя refreshToken.

### Request Body
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Токены обновлены",
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

### Процесс работы
1. Верифицирует refreshToken
2. Проверяет существование и активность пользователя
3. Генерирует новую пару токенов
4. Возвращает обновленные токены

### Пример использования
```javascript
const response = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    refreshToken: localStorage.getItem('refreshToken')
  })
});

const data = await response.json();

if (data.success) {
  localStorage.setItem('accessToken', data.data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
}
```

---

## 4. Получение текущего пользователя

### Эндпоинт
```
GET /api/auth/me
```

### Доступ
**Private** - требуется аутентификация

### Headers
```
Authorization: Bearer <accessToken>
```

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "name": "Имя Пользователя",
      "role": "manager",
      "roleRu": "Менеджер",
      "lastLogin": "2025-12-16T15:16:00.000Z",
      "createdAt": "2025-01-01T10:00:00.000Z"
    }
  }
}
```

---

## 5. Выход из системы

### Эндпоинт
```
POST /api/auth/logout
```

### Доступ
**Private** - требуется аутентификация

### Headers
```
Authorization: Bearer <accessToken>
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Успешный выход из системы"
}
```

### Процесс работы
1. Логирует выход пользователя в ActionLog
2. Возвращает подтверждение

**Примечание:** Клиент должен самостоятельно удалить токены из хранилища.

### Пример использования
```javascript
await fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

// Удаляем токены на клиенте
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
localStorage.removeItem('user');
```

---

## 6. Изменение пароля

### Эндпоинт
```
PUT /api/auth/change-password
```

### Доступ
**Private** - требуется аутентификация

### Headers
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Request Body
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword456"
}
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Пароль успешно изменен"
}
```

### Возможные ошибки
| Код | Описание |
|-----|----------|
| 400 | Текущий и новый пароли обязательны |
| 400 | Неверный текущий пароль |
| 401 | Не авторизован |
| 500 | Ошибка сервера |

---

## Роли пользователей

| Роль | Значение | Описание |
|------|----------|----------|
| admin | Администратор | Полный доступ ко всем функциям |
| manager | Менеджер | Управление клиентами и заказами |
| viewer | Наблюдатель | Только просмотр данных |

---

## Логирование действий

Все действия аутентификации логируются в коллекцию `ActionLog`:

- **Успешный вход** - action: `login`
- **Неудачный вход** - action: `failed_login` (с причиной)
- **Регистрация** - action: `other` с metadata: `create_user`
- **Выход** - action: `logout`
- **Смена пароля** - action: `other` с metadata: `change_password`

Каждый лог содержит:
- `userId` - ID пользователя (или null для неудачных попыток)
- `ipAddress` - IP-адрес клиента
- `userAgent` - User-Agent браузера
- `timestamp` - Время действия
- `success` - Статус операции

---

## Безопасность

### Хеширование паролей
- Используется bcrypt с salt rounds = 10
- Пароли никогда не возвращаются в API ответах
- Поле password исключено из выборок по умолчанию

### JWT токены
- **Access Token:** срок жизни 15 минут
- **Refresh Token:** срок жизни 7 дней
- Токены подписываются секретным ключом из переменных окружения

### Защита от атак
- Rate limiting на эндпоинтах входа
- Одинаковые сообщения об ошибках для защиты от перебора
- Логирование всех попыток входа
- Проверка активности аккаунта

---

## Переменные окружения

Необходимые переменные для работы аутентификации:

```env
JWT_SECRET=your-secret-key-here
JWT_ACCESS_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
```
