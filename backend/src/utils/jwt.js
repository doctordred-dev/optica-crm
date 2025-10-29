const jwt = require('jsonwebtoken');

// Генерация JWT токена
const generateToken = (payload, expiresIn = null) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: expiresIn || process.env.JWT_EXPIRE || '7d'
    }
  );
};

// Генерация refresh токена
const generateRefreshToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d'
    }
  );
};

// Верификация токена
const verifyToken = (token, isRefresh = false) => {
  try {
    const secret = isRefresh ? process.env.JWT_REFRESH_SECRET : process.env.JWT_SECRET;
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Недействительный токен');
  }
};

// Декодирование токена без верификации (для получения данных из истекшего токена)
const decodeToken = (token) => {
  return jwt.decode(token);
};

// Получение токена из заголовка Authorization
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};

// Создание пары токенов (access + refresh)
const generateTokenPair = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role
  };

  const accessToken = generateToken(payload);
  const refreshToken = generateRefreshToken({ id: user._id });

  return {
    accessToken,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRE || '7d'
  };
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  extractTokenFromHeader,
  generateTokenPair
};
