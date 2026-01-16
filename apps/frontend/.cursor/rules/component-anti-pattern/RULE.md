---
description: "Apply when writing or reviewing React components (.tsx files in components/ or screens/). Prevents direct API calls, business logic in components, and inline styling anti-patterns."
alwaysApply: false
tags: ["anti-patterns", "components", "best-practices", "react"]
---

# Component Anti-Patterns

## 1. Direct API Calls in Components

### ❌ ANTI-PATTERN: Component calling service directly

```typescript
// ❌ BAD - Component making API call
const ChatScreen = () => {
  const [messages, setMessages] = useState([]);

  const sendMessage = async (text: string) => {
    const response = await apiService.sendMessage({
      chatId,
      text
    });
    setMessages([...messages, response.data]);
  };

  return <ChatInput onSend={sendMessage} />;
};
```

### ✅ CORRECT PATTERN: Component → Hook → Store → Service

```typescript
// ✅ GOOD - Proper separation of concerns
const ChatScreen = () => {
  const sendMessage = useChatStore(state => state.sendMessage);
  return <ChatInput onSend={sendMessage} />;
};

// In chatStore/actions.ts
const sendMessage = async (text: string) => {
  set({ isLoading: true });
  try {
    const response = await apiService.sendMessage({ chatId, text });
    set(state => ({
      messages: [...state.messages, response.data],
      isLoading: false
    }));
  } catch (error) {
    set({ error: error.message, isLoading: false });
  }
};
```

**Why It's Bad:**
- Tight coupling between UI and data layer
- Difficult to test components
- No centralized error handling
- State management scattered across components

## 2. Business Logic in Components

### ❌ ANTI-PATTERN: Complex logic in component

```typescript
// ❌ BAD - Business logic in component
const PremiumScreen = () => {
  const [price, setPrice] = useState(0);

  useEffect(() => {
    const calculatePrice = async () => {
      const basePrice = 9.99;
      const user = await getUser();
      const discount = user.isReturning ? 0.2 : 0;
      const tax = 0.1;

      const discountedPrice = basePrice * (1 - discount);
      const finalPrice = discountedPrice * (1 + tax);

      setPrice(finalPrice);
    };

    calculatePrice();
  }, []);

  return <Text>Price: ${price}</Text>;
};
```

### ✅ CORRECT PATTERN: Logic in store or hook

```typescript
// ✅ GOOD - Logic in store
const PremiumScreen = () => {
  const price = usePremiumStore(state => state.calculatePrice());
  return <Text>Price: ${price}</Text>;
};

// In premiumStore/actions.ts
const calculatePrice = () => {
  const { user, basePrice } = get();
  const discount = user.isReturning ? 0.2 : 0;
  const tax = 0.1;

  const discountedPrice = basePrice * (1 - discount);
  return discountedPrice * (1 + tax);
};
```

**Why It's Bad:**
- Hard to test business logic
- Can't reuse logic across components
- Component becomes bloated
- Violates single responsibility principle


