import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCachedDateRange,
  setCachedDateRange,
} from '../services/storage/appStorageCache';

export { DATE_RANGE_STORAGE_KEY } from '../services/storage/appStorageCache';

export type GlobalDateRange = {
  startDate: string;
  endDate: string;
};

type DateRangeContextValue = {
  range: GlobalDateRange;
  rangeKey: string;
  setRange: (next: GlobalDateRange) => Promise<void>;
  resetToToday: () => Promise<void>;
};

const getTodayIso = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toValidIso = (value: unknown) => {
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const getDefaultRange = (): GlobalDateRange => {
  const today = getTodayIso();
  return {
    startDate: today,
    endDate: today,
  };
};

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRangeState] = useState<GlobalDateRange>(getDefaultRange());

  useEffect(() => {
    const load = async () => {
      try {
        const storedRange = await getCachedDateRange();
        if (storedRange) setRangeState(storedRange);
      } catch {
        // ignore and keep default
      }
    };

    load();
  }, []);

  const setRange = useCallback(async (next: GlobalDateRange) => {
    const start = toValidIso(next.startDate);
    const end = toValidIso(next.endDate);

    if (!start || !end) {
      return;
    }

    const normalized =
      start <= end
        ? { startDate: start, endDate: end }
        : { startDate: end, endDate: start };

    setRangeState(normalized);

    try {
      await setCachedDateRange(normalized);
    } catch {
      // ignore persistence failure
    }
  }, []);

  const resetToToday = useCallback(async () => {
    const today = getTodayIso();
    await setRange({ startDate: today, endDate: today });
  }, [setRange]);

  const value = useMemo(
    () => ({
      range,
      rangeKey: `${range.startDate}_${range.endDate}`,
      setRange,
      resetToToday,
    }),
    [range, setRange, resetToToday]
  );

  return (
    <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const context = useContext(DateRangeContext);

  if (!context) {
    throw new Error('useDateRange must be used inside DateRangeProvider');
  }

  return context;
}
