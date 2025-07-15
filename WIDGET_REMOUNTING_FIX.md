# Widget Remounting Issue - Fix Documentation

## Problem Summary

The widget component (`src/pages/widget.tsx`) was caught in an infinite remounting loop, causing continuous console spam and poor performance.

**Symptoms:**

```
🔧 Widget component mounting...
widget.tsx:481 🔧 Widget initial config: {width: '100%', height: '100%', theme: 'light', ...}
widget.tsx:549 🔧 Widget auth state: {isAuthenticated: true, authChecked: true, authError: null}
useEmotionImage.ts:27 🎭 [useEmotionImage] Current state: {emotion: 'neutral', ...}
[REPEATS INFINITELY]
```

## Root Causes

### 1. URL Parsing useEffect Dependency Loop

**Location:** `src/pages/widget.tsx` around line 1200

**Problem:**

```typescript
useEffect(() => {
  // Parse URL parameters and update config
  setConfig((prev) => ({ ...prev, ...urlConfig }))
}, [config]) // ❌ BAD: config is both read and written
```

**Issue:** The effect updates `config`, which triggers the effect again because `config` is in the dependency array.

### 2. Message Handler useEffect Circular Dependency

**Location:** `src/pages/widget.tsx` around line 1000

**Problem:**

```typescript
useEffect(() => {
  function handleAllMessages(event) {
    // ... message handling logic
  }

  window.addEventListener('message', handleAllMessages)
  return () => window.removeEventListener('message', handleAllMessages)
}, [handleAllMessages, isAuthenticated]) // ❌ BAD: handleAllMessages is defined inside the effect
```

**Issue:** `handleAllMessages` is defined inside the useEffect but is also in the dependency array, creating a circular reference.

### 3. Config Object Recreation

**Location:** `src/pages/widget.tsx` around line 460

**Problem:**

```typescript
const [config, setConfig] = useState<WidgetConfig>({
  width: '800px',
  height: '600px',
  // ... other properties
}) // ❌ BAD: New object created on every render
```

**Issue:** The initial config object was recreated on every render, causing `config.postMessages` references to change constantly.

## Applied Fixes

### ✅ Fix 1: URL Parsing Dependency Array

```typescript
// BEFORE (❌ Causes loop)
useEffect(() => {
  setConfig((prev) => ({ ...prev, ...urlConfig }))
}, [config])

// AFTER (✅ Fixed)
useEffect(() => {
  setConfig((prev) => ({ ...prev, ...urlConfig }))
}, []) // Only run once on mount, not when config changes
```

### ✅ Fix 2: Message Handler Dependencies

```typescript
// BEFORE (❌ Circular dependency)
useEffect(() => {
  function handleAllMessages(event) {
    /* ... */
  }
  window.addEventListener('message', handleAllMessages)
  return () => window.removeEventListener('message', handleAllMessages)
}, [handleAllMessages, isAuthenticated])

// AFTER (✅ Fixed)
useEffect(() => {
  function handleAllMessages(event) {
    /* ... */
  }
  window.addEventListener('message', handleAllMessages)
  return () => window.removeEventListener('message', handleAllMessages)
}, [postMessagesEnabled, isAuthenticated]) // Removed circular dependency
```

### ✅ Fix 3: Stable Config Object

```typescript
// BEFORE (❌ Recreated every render)
const Widget = () => {
  const [config, setConfig] = useState<WidgetConfig>({
    width: '800px',
    // ... properties
  })

// AFTER (✅ Fixed)
const INITIAL_WIDGET_CONFIG: WidgetConfig = {
  width: '800px',
  // ... properties
}

const Widget = () => {
  const [config, setConfig] = useState<WidgetConfig>(INITIAL_WIDGET_CONFIG)
```

### ✅ Fix 4: Memoized Dependencies

```typescript
// Added stable reference for postMessages
const postMessagesEnabled = useMemo(
  () => config.postMessages,
  [config.postMessages]
)

// Updated all dependency arrays to use stable reference
useEffect(() => {
  if (!postMessagesEnabled) return
  // ... logic
}, [postMessagesEnabled]) // Instead of config.postMessages
```

## Prevention Guidelines

### 🔒 Rules to Prevent Regression

#### 1. useEffect Dependency Rules

- **NEVER** include a value in dependencies that the effect itself modifies
- **NEVER** include functions defined inside the effect in its dependency array
- **ALWAYS** use stable references for object properties in dependencies

#### 2. State Initialization Rules

- **NEVER** initialize state with object literals inside components
- **ALWAYS** define initial state objects outside the component or use useMemo
- **PREFER** constants for static initial values

#### 3. Code Review Checklist

Before approving changes to `src/pages/widget.tsx`:

- [ ] No useEffect has variables it modifies in its dependency array
- [ ] No useEffect has functions defined inside it in its dependency array
- [ ] State initialization uses stable references (constants or memoized values)
- [ ] Object properties used in dependencies are memoized with useMemo
- [ ] Test that the widget doesn't remount continuously in browser dev tools

#### 4. Testing Guidelines

**Manual Test:**

1. Open widget in browser
2. Open Developer Tools → Console
3. Verify "Widget component mounting..." appears only ONCE
4. Wait 10 seconds - should not see repeated mounting messages

**Automated Test:**
Consider adding a test that verifies the widget component doesn't remount unexpectedly.

## Related Files

- `src/pages/widget.tsx` - Main widget component
- `src/hooks/useEmotionImage.ts` - Hook that was being affected by remounting
- Any component that uses useEffect with config dependencies

## Historical Context

- **Original Issue:** Commit that introduced the regression
- **Successful Fix:** Commit `4271ff289325fcdce1809766060bdee97ac19c9c`
- **Documentation:** This file created to prevent future regressions

## Emergency Rollback

If this issue reoccurs, the fastest fix is to:

1. Check the two main useEffect dependency arrays mentioned above
2. Remove any circular dependencies
3. Ensure config initialization uses stable references

---

**⚠️ CRITICAL:** This issue causes significant performance problems and poor user experience. Always test widget mounting behavior when making changes to the widget component.
