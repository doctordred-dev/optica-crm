# 🚀 Инструкция по деплою CRM Оптика

## 📋 Подготовка к деплою

### 1. Проверьте файлы проекта
Убедитесь, что у вас есть все необходимые файлы:
- ✅ `package.json` с правильными скриптами
- ✅ `Dockerfile` для контейнеризации
- ✅ `ecosystem.config.js` для PM2
- ✅ `railway.json` для Railway
- ✅ `render.yaml` для Render
- ✅ Health check endpoint `/api/health`

### 2. Переменные окружения
Подготовьте следующие переменные:
```bash
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/optica-crm
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
JWT_REFRESH_SECRET=your-super-secret-refresh-key-at-least-32-characters
TURBOSMS_TOKEN=your-turbosms-token
CORS_ORIGIN=https://your-frontend-domain.com
```

## 🎯 Варианты деплоя

### Вариант 1: Railway (Рекомендуется)

#### Преимущества:
- 🆓 Бесплатный план (500 часов в месяц)
- 🔄 Автоматический деплой из GitHub
- 🔒 Встроенный HTTPS
- 📊 Встроенная MongoDB
- 🎛️ Простая панель управления

#### Шаги деплоя:

1. **Создайте аккаунт на Railway.app**
   ```
   https://railway.app
   ```

2. **Подключите GitHub репозиторий**
   - Нажмите "New Project"
   - Выберите "Deploy from GitHub repo"
   - Выберите ваш репозиторий

3. **Настройте переменные окружения**
   - Перейдите в Settings → Environment
   - Добавьте все переменные из списка выше

4. **Добавьте MongoDB**
   - Нажмите "Add Service" → "Database" → "MongoDB"
   - Скопируйте MONGODB_URI в переменные окружения

5. **Деплой**
   - Railway автоматически задеплоит проект
   - Получите URL вашего API

#### Команды для локального тестирования:
```bash
# Установка Railway CLI
npm install -g @railway/cli

# Логин
railway login

# Локальный запуск с переменными Railway
railway run npm start
```

---

### Вариант 2: Render

#### Преимущества:
- 🆓 Бесплатный план
- 🔄 Автоматический деплой
- 🔒 HTTPS из коробки

#### Шаги деплоя:

1. **Создайте аккаунт на Render.com**
   ```
   https://render.com
   ```

2. **Создайте Web Service**
   - New → Web Service
   - Подключите GitHub репозиторий
   - Выберите папку `backend`

3. **Настройки сервиса**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `Node`

4. **Переменные окружения**
   - Добавьте все переменные из списка

5. **MongoDB Atlas**
   - Создайте кластер на MongoDB Atlas
   - Добавьте MONGODB_URI в переменные

---

### Вариант 3: DigitalOcean App Platform

#### Преимущества:
- 🚀 Высокая производительность
- 🔧 Гибкие настройки
- 💰 От $5/месяц

#### Шаги деплоя:

1. **Создайте аккаунт DigitalOcean**
   ```
   https://digitalocean.com
   ```

2. **Создайте App**
   - Apps → Create App
   - Подключите GitHub
   - Выберите репозиторий

3. **Настройки**
   - Source Directory: `backend`
   - Build Command: `npm install`
   - Run Command: `npm start`

4. **База данных**
   - Добавьте Managed MongoDB
   - Или используйте MongoDB Atlas

---

### Вариант 4: VPS (Полный контроль)

#### Для опытных пользователей

```bash
# 1. Подключение к серверу
ssh root@your-server-ip

# 2. Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Установка PM2
npm install -g pm2

# 4. Клонирование проекта
git clone https://github.com/your-username/optica-crm.git
cd optica-crm/backend

# 5. Установка зависимостей
npm install --production

# 6. Настройка переменных окружения
cp env-template.txt .env
nano .env  # Заполните переменные

# 7. Запуск с PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# 8. Настройка Nginx (опционально)
sudo apt install nginx
# Настройте reverse proxy
```

## 🔧 После деплоя

### 1. Создайте админа
```bash
# Локально или через Railway CLI
npm run create-admin

# Или через API
curl -X POST https://your-api-url.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@optica.com",
    "password": "admin123456",
    "name": "Администратор",
    "role": "admin"
  }'
```

### 2. Создайте SMS шаблоны
```bash
npm run create-sms-templates
```

### 3. Проверьте работу
```bash
# Health check
curl https://your-api-url.com/api/health

# Тест API
curl https://your-api-url.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@optica.com",
    "password": "admin123456"
  }'
```

## 📊 Мониторинг

### Railway
- Встроенные логи и метрики
- Автоматические алерты

### Render
- Логи в реальном времени
- Метрики производительности

### VPS
```bash
# Логи PM2
pm2 logs

# Статус процессов
pm2 status

# Мониторинг
pm2 monit
```

## 🔒 Безопасность

1. **Используйте сильные пароли**
2. **Настройте CORS правильно**
3. **Используйте HTTPS**
4. **Регулярно обновляйте зависимости**
5. **Настройте rate limiting**

## 🚨 Troubleshooting

### Проблема: Сервер не запускается
```bash
# Проверьте логи
pm2 logs
# или
railway logs
```

### Проблема: База данных не подключается
- Проверьте MONGODB_URI
- Убедитесь, что IP добавлен в whitelist MongoDB Atlas

### Проблема: SMS не отправляются
- Проверьте TURBOSMS_TOKEN
- Проверьте баланс TurboSMS

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи приложения
2. Убедитесь в правильности переменных окружения
3. Проверьте health check endpoint
4. Обратитесь к документации платформы

---

**Рекомендация:** Начните с Railway для быстрого старта, затем при необходимости мигрируйте на более мощные решения.
