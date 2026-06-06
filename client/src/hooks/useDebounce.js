/**
 * client/src/hooks/useDebounce.js
 *
 * Returns a debounced version of `value` that only updates after
 * `delay` milliseconds of inactivity. Default delay: 300ms.
 *
 * Usage:
 *   const debouncedSearch = useDebounce(searchQuery, 300);
 */
import { useEffect, useState } from 'react';

export default function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
