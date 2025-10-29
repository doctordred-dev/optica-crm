# 🚀 Инструкции по настройке Optika CRM Backend

## 📋 Что нужно создать и настроить

### 1. 🗄️ База данных MongoDB

#### Вариант A: Локальная установка MongoDB
1. **Установите MongoDB Community Server:**
   - Скачайте с https://www.mongodb.com/try/download/community
   - Следуйте инструкциям для вашей ОС

2. **Запустите MongoDB:**
   ```bash
   # macOS (с Homebrew)
   brew services start mongodb-community
   
   # Windows
   # Запустите MongoDB как службу или вручную
   
   # Linux (Ubuntu)
   sudo systemctl start mongod
   ```

3. **Создайте базу данных:**
   ```bash
   # Подключитесь к MongoDB
   mongosh
   
   # Создайте базу данных
   use optica-crm
   
   # Создайте первого пользователя (админа)
   db.users.insertOne({
     email: "admin@optica.com",
     password: "$2a$12$...", // будет хеширован в приложении
     name: "Администратор",
     role: "admin",
     isActive: true,
     createdAt: new Date(),
     updatedAt: new Date()
   })
   ```

#### Вариант B: MongoDB Atlas (облачная БД) - РЕКОМЕНДУЕТСЯ
1. **Создайте аккаунт на https://www.mongodb.com/atlas**
2. **Создайте кластер:**
   - Выберите FREE tier (M0)
   - Выберите регион ближе к вам
3. **Настройте доступ:**
   - Database Access: создайте пользователя БД
   - Network Access: добавьте свой IP (или 0.0.0.0/0 для разработки)
4. **Получите строку подключения:**
   - Нажмите "Connect" → "Connect your application"
   - Скопируйте строку подключения

### 2. 📱 SMS-сервис (выберите один)

#### Вариант A: Twilio
1. **Зарегистрируйтесь на https://www.twilio.com**
2. **Получите учетные данные:**
   - Account SID
   - Auth Token
   - Номер телефона Twilio
3. **Добавьте в .env файл**

#### Вариант B: SMS.ru
1. **Зарегистрируйтесь на https://sms.ru**
2. **Получите API ID в личном кабинете**
3. **Добавьте в .env файл**

### 3. 🔐 JWT секретные ключи
Сгенерируйте надежные ключи:
```bash
# В Node.js консоли или онлайн генераторе
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. ☁️ Файловое хранение (опционально)

#### Для продакшена - AWS S3:
1. **Создайте AWS аккаунт**
2. **Создайте S3 bucket**
3. **Создайте IAM пользователя с правами на S3**
4. **Получите Access Key и Secret Key**

#### Альтернатива - Cloudinary:
1. **Зарегистрируйтесь на https://cloudinary.com**
2. **Получите Cloud Name, API Key, API Secret**

## 🛠️ Установка и запуск

### 1. Установите зависимости:
```bash
cd backend
npm install
```

### 2. Настройте переменные окружения:
```bash
# Скопируйте шаблон
cp env-template.txt .env

# Отредактируйте .env файл своими данными
nano .env  # или любой другой редактор
```

### 3. Запустите сервер:
```bash
# Режим разработки (с автоперезагрузкой)
npm run dev

# Продакшн режим
npm start
```

### 4. Проверьте работу:
Откройте http://localhost:5000 - должны увидеть:
```json
{
  "message": "Optika CRM API",
  "version": "v1",
  "status": "running"
}
```

## 🔧 Обязательные настройки в .env

### Минимальные настройки для запуска:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/optica-crm
JWT_SECRET=your-generated-secret-key-here
JWT_REFRESH_SECRET=your-generated-refresh-secret-here
```

### Для SMS (один из вариантов):
```env
# Twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# ИЛИ SMS.ru
SMS_RU_API_ID=your-api-id
```

## 📊 Создание первого администратора

После запуска сервера создайте первого пользователя через API:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@optica.com",
    "password": "secure-password-123",
    "name": "Администратор",
    "role": "admin"
  }'
```

## 🧪 Тестирование API

### Проверьте основные endpoints:
```bash
# Главная страница
curl http://localhost:5000/

# Аутентификация
curl http://localhost:5000/api/auth/login

# Клиенты
curl http://localhost:5000/api/clients

# Заказы
curl http://localhost:5000/api/orders
```

## 🔍 Отладка проблем

### Проблемы с подключением к MongoDB:
1. Проверьте, запущен ли MongoDB
2. Проверьте строку подключения в .env
3. Для Atlas: проверьте Network Access и Database Access

### Проблемы с SMS:
1. Проверьте учетные данные в .env
2. Проверьте баланс аккаунта SMS-сервиса
3. Проверьте формат номера телефона

### Проблемы с JWT:
1. Убедитесь, что JWT_SECRET установлен
2. Проверьте, что ключ достаточно длинный (минимум 32 символа)

## 📝 Логи

Логи сохраняются в папке `logs/`:
- `error.log` - только ошибки
- `combined.log` - все события

В режиме разработки логи также выводятся в консоль.

## 🚀 Готово!

После выполнения всех шагов у вас будет:
- ✅ Работающий backend сервер
- ✅ Подключенная база данных
- ✅ Настроенная аутентификация
- ✅ SMS-интеграция (опционально)
- ✅ Файловое хранение (опционально)

Теперь можно приступать к разработке frontend части или тестированию API!
