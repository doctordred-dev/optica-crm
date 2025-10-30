#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Проверка готовности к деплою...\n');

const checks = [
  {
    name: 'package.json содержит необходимые скрипты',
    check: () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return pkg.scripts && pkg.scripts.start && pkg.engines;
    }
  },
  {
    name: 'Dockerfile существует',
    check: () => fs.existsSync('Dockerfile')
  },
  {
    name: 'ecosystem.config.js существует',
    check: () => fs.existsSync('ecosystem.config.js')
  },
  {
    name: 'railway.json существует',
    check: () => fs.existsSync('railway.json')
  },
  {
    name: 'Health check endpoint добавлен',
    check: () => {
      const serverFile = fs.readFileSync('src/server.js', 'utf8');
      return serverFile.includes('/api/health');
    }
  },
  {
    name: 'env-template.txt существует',
    check: () => fs.existsSync('env-template.txt')
  }
];

let allPassed = true;

checks.forEach(({ name, check }) => {
  const passed = check();
  console.log(`${passed ? '✅' : '❌'} ${name}`);
  if (!passed) allPassed = false;
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('🎉 Проект готов к деплою!');
  console.log('\n📋 Следующие шаги:');
  console.log('1. Создайте репозиторий на GitHub');
  console.log('2. Запушьте код: git add . && git commit -m "Ready for deployment" && git push');
  console.log('3. Выберите платформу для деплоя (Railway, Render, DigitalOcean)');
  console.log('4. Настройте переменные окружения');
  console.log('5. Создайте админа: npm run create-admin');
  console.log('\n📖 Подробная инструкция в файле DEPLOYMENT.md');
} else {
  console.log('❌ Проект НЕ готов к деплою');
  console.log('Исправьте ошибки выше и запустите проверку снова');
}

console.log('\n🔗 Полезные ссылки:');
console.log('• Railway: https://railway.app');
console.log('• Render: https://render.com');
console.log('• DigitalOcean: https://digitalocean.com');
console.log('• MongoDB Atlas: https://cloud.mongodb.com');
