// Тест валидации диоптрий
const testValues = ['+2.5', '+2.4', '-1.75', '+0.5', '-3.0', '2.5', 'abc'];
const regex = /^[+-]\d+(\.\d+)?$/;

console.log('Тестирование валидации диоптрий:\n');

testValues.forEach(value => {
  const isValid = regex.test(value);
  console.log(`"${value}" -> ${isValid ? '✓ VALID' : '✗ INVALID'}`);
});

console.log('\nВаши значения из запроса:');
console.log(`"+2.5" -> ${regex.test('+2.5') ? '✓ VALID' : '✗ INVALID'}`);
console.log(`"+2.4" -> ${regex.test('+2.4') ? '✓ VALID' : '✗ INVALID'}`);
