import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Returns a debounced version of `value`, plus a `flush()` function
 * that immediately pushes the latest value.
 *
 * Modeled after Bharat Enterprise's signature resilient useDebounce hook:
 *  - When `value` becomes falsy (empty string, null, etc.) the debounced
 *    value updates immediately — clearing a search field never feels laggy.
 *  - Otherwise the returned value only updates after the caller stops
 *    typing/changing `value` for `delay` milliseconds.
 *  - Automatically tears down timers on unmount or input change.
 *
 * @param value The rapidly-changing input value.
 * @param delay Debounce window in milliseconds (default: 350ms).
 * @returns [debouncedValue, flush]
 */
export function useDebounce<T>(value: T, delay: number = 350): [T, () => void] {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const latestValue = useRef<T>(value);

  // Always track the latest value so flush() can grab it immediately
  latestValue.current = value;

  useEffect(() => {
    // If the value is falsy (e.g. cleared search), update immediately without timer
    if (!value) {
      setDebouncedValue(value);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  // Imperatively push the latest value right now (skipping the timer)
  const flush = useCallback(() => {
    setDebouncedValue(latestValue.current);
  }, []);

  return [debouncedValue, flush];
}

export default useDebounce;
