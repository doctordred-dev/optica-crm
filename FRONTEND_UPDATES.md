# 🎨 Обновления для фронтенда

## ✅ Что уже сделано на бэкенде:

1. **Добавлено поле `defaultDiscount`** в модель `Client` - обычная скидка клиента (0-100%)
2. **Поле `paymentMethod`** уже существует в модели `Order` - способ оплаты (наличные/безналичные/смешанная)
3. **Поле `discount`** уже существует в модели `Order` - скидка на конкретный заказ (0-100%)

---

## 📋 Задачи для фронтенда:

### 1. ✅ Добавить отображение клиента в списке заказов (ГОТОВО)

Файл: `/Users/vladislav/Documents/optica-crm-front/app/dashboard/orders/page.tsx`

Уже добавлена колонка "Клієнт" с именем и телефоном клиента.

---

### 2. Добавить поле обычной скидки в форму клиента

**Файлы для редактирования:**
- `/Users/vladislav/Documents/optica-crm-front/components/clients/client-dialog.tsx`
- `/Users/vladislav/Documents/optica-crm-front/components/clients/client-details-dialog.tsx`

#### В `client-dialog.tsx`:

**1. Добавить в `formData` state:**
```typescript
const [formData, setFormData] = useState({
  name: "",
  phone: "",
  age: "",
  birthDate: "",
  comments: "",
  source: "",
  defaultDiscount: "0", // ДОБАВИТЬ ЭТО
})
```

**2. Добавить в `useEffect` для редактирования:**
```typescript
useEffect(() => {
  if (client) {
    setFormData({
      name: client.name || "",
      phone: client.phone || "",
      age: client.age?.toString() || "",
      birthDate: client.birthDate ? client.birthDate.split('T')[0] : "",
      comments: client.comments || "",
      source: client.source || "",
      defaultDiscount: client.defaultDiscount?.toString() || "0", // ДОБАВИТЬ ЭТО
    })
  }
}, [client])
```

**3. Добавить поле в форму (после поля "source"):**
```tsx
<div className="grid gap-2">
  <Label htmlFor="defaultDiscount">Звичайна знижка (%)</Label>
  <Input
    id="defaultDiscount"
    type="number"
    min="0"
    max="100"
    placeholder="0"
    value={formData.defaultDiscount}
    onChange={(e) => setFormData({ ...formData, defaultDiscount: e.target.value })}
  />
</div>
```

**4. Обновить `handleSubmit`:**
```typescript
const clientData = {
  name: formData.name,
  phone: formData.phone,
  age: formData.age ? parseInt(formData.age) : undefined,
  birthDate: formData.birthDate || undefined,
  comments: formData.comments || undefined,
  source: formData.source || undefined,
  defaultDiscount: formData.defaultDiscount ? parseFloat(formData.defaultDiscount) : 0, // ДОБАВИТЬ ЭТО
}
```

#### В `client-details-dialog.tsx`:

**Добавить отображение обычной скидки клиента:**
```tsx
<div className="grid grid-cols-2 gap-4 text-sm">
  <div>
    <p className="text-muted-foreground">Телефон</p>
    <p className="font-medium">{client.phone}</p>
  </div>
  <div>
    <p className="text-muted-foreground">Звичайна знижка</p>
    <p className="font-medium">{client.defaultDiscount || 0}%</p>
  </div>
  {/* остальные поля... */}
</div>
```

---

### 3. Добавить поле скидки в форму заказа с автоматическим пересчетом

**Файл:** `/Users/vladislav/Documents/optica-crm-front/components/orders/order-dialog.tsx`

#### Шаг 1: Обновить `formData` state

Убедитесь что есть поля:
```typescript
const [formData, setFormData] = useState({
  // ... существующие поля
  discount: "0",
  paymentMethod: "наличные", // ДОБАВИТЬ ЭТО
  // ... остальные поля
})
```

#### Шаг 2: Добавить функцию пересчета цены

```typescript
// Функция для расчета итоговой цены с учетом скидки
const calculateTotalPrice = () => {
  const framePrice = parseFloat(formData.framePrice) || 0
  const lensesPrice = parseFloat(formData.lensesPrice) || 0
  const discount = parseFloat(formData.discount) || 0
  
  const subtotal = framePrice + lensesPrice
  const discountAmount = (subtotal * discount) / 100
  const total = subtotal - discountAmount
  
  return total
}
```

#### Шаг 3: Автоматически подставлять скидку клиента

Обновить функцию `handleSelectClient`:
```typescript
const handleSelectClient = (client: Client) => {
  setSelectedClient(client)
  setFormData((prev) => ({ 
    ...prev, 
    clientId: client._id,
    discount: client.defaultDiscount?.toString() || "0" // ДОБАВИТЬ ЭТО
  }))
  setSearchPhone("")
  setSearchResults([])
  setShowResults(false)
  toast({
    title: "Клієнта обрано",
    description: `${client.name} - ${client.phone}`,
  })
}
```

#### Шаг 4: Добавить поля в форму

**Добавить после полей с ценами (в табе с финансами или создать новый таб):**

```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="grid gap-2">
    <Label htmlFor="discount">Знижка (%)</Label>
    <Input
      id="discount"
      type="number"
      min="0"
      max="100"
      placeholder="0"
      value={formData.discount}
      onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
    />
  </div>
  
  <div className="grid gap-2">
    <Label htmlFor="paymentMethod">Спосіб оплати</Label>
    <Select
      value={formData.paymentMethod}
      onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="наличные">Готівка</SelectItem>
        <SelectItem value="безналичные">Безготівковий</SelectItem>
        <SelectItem value="смешанная">Змішана</SelectItem>
      </SelectContent>
    </Select>
  </div>
</div>

{/* Показать итоговую цену */}
<div className="p-4 bg-muted rounded-lg">
  <div className="flex justify-between items-center">
    <span className="text-sm text-muted-foreground">Підсумкова вартість:</span>
    <span className="text-2xl font-bold">{calculateTotalPrice().toLocaleString("uk-UA")} ₴</span>
  </div>
  {parseFloat(formData.discount) > 0 && (
    <p className="text-xs text-muted-foreground mt-1">
      Знижка {formData.discount}% застосована
    </p>
  )}
</div>
```

#### Шаг 5: Обновить `handleSubmit`

Убедитесь что отправляете:
```typescript
const orderData = {
  // ... существующие поля
  discount: formData.discount ? parseFloat(formData.discount) : 0,
  paymentMethod: formData.paymentMethod,
  totalPrice: calculateTotalPrice(), // Используем рассчитанную цену
  // ... остальные поля
}
```

---

### 4. Обновить типы TypeScript

**Файл:** `/Users/vladislav/Documents/optica-crm-front/lib/types.ts`

```typescript
export interface Client {
  _id: string
  name: string
  phone: string
  age?: number
  birthDate?: string
  comments?: string
  source?: string
  defaultDiscount?: number // ДОБАВИТЬ ЭТО
  stats?: {
    totalOrders: number
    totalSpent: number
  }
  createdAt: string
  updatedAt: string
}

export interface Order {
  _id: string
  clientId: Client | string
  // ... существующие поля
  discount?: number
  paymentMethod?: 'наличные' | 'безналичные' | 'смешанная' // ДОБАВИТЬ ЭТО
  // ... остальные поля
}
```

---

## 🎯 Итоговый чеклист:

- [x] Бэкенд: Добавлено поле `defaultDiscount` в модель Client
- [x] Бэкенд: Поле `paymentMethod` уже есть в модели Order
- [x] Фронтенд: Добавлена колонка "Клиент" в списке заказов
- [ ] Фронтенд: Добавить поле скидки в форму клиента
- [ ] Фронтенд: Показать обычную скидку на странице клиента
- [ ] Фронтенд: Добавить поле скидки в форму заказа
- [ ] Фронтенд: Добавить автоматический пересчет цены при изменении скидки
- [ ] Фронтенд: Добавить поле способа оплаты в форму заказа
- [ ] Фронтенд: Обновить типы TypeScript

---

## 🚀 После внедрения:

1. Перезапустите бэкенд для применения изменений в модели Client
2. Проверьте что API возвращает поле `defaultDiscount` для клиентов
3. Протестируйте создание/редактирование клиента с указанием скидки
4. Протестируйте создание заказа - скидка должна автоматически подставляться
5. Проверьте пересчет цены при изменении скидки
