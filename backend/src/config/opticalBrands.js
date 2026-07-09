// Довідник поширених брендів оправ і лінз — зібраний агрегацією реальної
// історії замовлень цієї оптики (Order.frame.brand / Order.lenses.brand,
// топ за частотою станом на 2026-07-09). Використовується як орієнтир для
// ІІ при розпізнаванні рукописного тексту на бланках — НЕ вичерпний
// список і не обмежує розпізнавання: якщо на бланку явно написано інший
// бренд, довіряти написаному.
//
// Щоб оновити список пізніше (нові бренди в асортименті) — перезапустити
// агрегацію по реальних замовленнях і замінити масиви нижче вручну.

const FRAME_BRANDS = [
  'La Stella', 'Victory', 'Vizzini', 'Glory', 'Mien', 'Dackor', 'Tempo',
  'Tornado', 'Dacchi', 'Primavera', 'Gala', 'Despada', 'Guchini', 'Ray-Ban'
];

const LENS_BRANDS = [
  'Essilor', 'Dagas', 'By Tokay', 'Kodak', 'Prima', 'Comfort Line',
  'High-top', 'Jet Star', 'Optimix', 'Seiko', 'Carl Zeiss', 'Jzokron',
  'Le Perle', 'Synchrony'
];

module.exports = { FRAME_BRANDS, LENS_BRANDS };
