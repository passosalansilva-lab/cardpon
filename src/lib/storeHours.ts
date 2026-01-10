import { OperatingHours, DayHours, TimePeriod } from '@/components/store/OperatingHoursEditor';

const DAY_KEYS: (keyof OperatingHours)[] = [
  'sunday',
  'monday', 
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

interface StoreOpenStatus {
  isOpen: boolean;
  reason: 'manual_closed' | 'outside_hours' | 'day_closed' | 'open';
  currentDayHours: DayHours | null;
  nextOpenTime: string | null;
  currentPeriod?: TimePeriod | null;
}

// Get all periods for a day, ensuring backwards compatibility
function getDayPeriods(dayHours: DayHours): TimePeriod[] {
  if (dayHours.periods && dayHours.periods.length > 0) {
    return dayHours.periods;
  }
  // Fallback to legacy format
  return [{ open: dayHours.open, close: dayHours.close }];
}

// Check if current time is within a time period
function isWithinPeriod(currentTime: string, period: TimePeriod): boolean {
  const openTime = period.open;
  const closeTime = period.close;
  
  // Handle overnight hours (e.g., 18:00 - 02:00)
  const isOvernight = closeTime < openTime;
  
  if (isOvernight) {
    // For overnight hours: open if current >= open OR current < close
    return currentTime >= openTime || currentTime < closeTime;
  } else {
    // Normal hours: open if current >= open AND current < close
    return currentTime >= openTime && currentTime < closeTime;
  }
}

// Find the current active period or null
function findActivePeriod(currentTime: string, periods: TimePeriod[]): TimePeriod | null {
  for (const period of periods) {
    if (isWithinPeriod(currentTime, period)) {
      return period;
    }
  }
  return null;
}

// Find next opening time from periods
function findNextPeriodOpen(currentTime: string, periods: TimePeriod[]): string | null {
  // Sort periods by open time
  const sortedPeriods = [...periods].sort((a, b) => a.open.localeCompare(b.open));
  
  // Find the next period that opens after current time
  for (const period of sortedPeriods) {
    if (period.open > currentTime) {
      return period.open;
    }
  }
  
  return null;
}

export function checkStoreOpen(
  isManuallyOpen: boolean,
  openingHours: OperatingHours | null | undefined
): StoreOpenStatus {
  // If manually closed, store is closed
  if (!isManuallyOpen) {
    return {
      isOpen: false,
      reason: 'manual_closed',
      currentDayHours: null,
      nextOpenTime: null,
    };
  }

  // If no operating hours configured, use manual toggle only
  if (!openingHours) {
    return {
      isOpen: true,
      reason: 'open',
      currentDayHours: null,
      nextOpenTime: null,
    };
  }

  const now = new Date();
  const currentDayIndex = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentDayKey = DAY_KEYS[currentDayIndex];
  const currentDayHours = openingHours[currentDayKey];

  // Check if today is enabled
  if (!currentDayHours?.enabled) {
    const nextOpen = findNextOpenTime(openingHours, currentDayIndex);
    return {
      isOpen: false,
      reason: 'day_closed',
      currentDayHours,
      nextOpenTime: nextOpen,
    };
  }

  // Check current time against all periods
  const currentTime = now.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  const periods = getDayPeriods(currentDayHours);
  const activePeriod = findActivePeriod(currentTime, periods);

  if (activePeriod) {
    return {
      isOpen: true,
      reason: 'open',
      currentDayHours,
      nextOpenTime: null,
      currentPeriod: activePeriod,
    };
  }

  // Not within any period - find next opening
  const nextPeriodOpen = findNextPeriodOpen(currentTime, periods);
  
  let nextOpen: string;
  if (nextPeriodOpen) {
    nextOpen = `Abre às ${nextPeriodOpen}`;
  } else {
    // All periods today have passed, find next open day
    const nextOpenDay = findNextOpenTime(openingHours, currentDayIndex);
    nextOpen = nextOpenDay || 'Abre amanhã';
  }

  return {
    isOpen: false,
    reason: 'outside_hours',
    currentDayHours,
    nextOpenTime: nextOpen,
    currentPeriod: null,
  };
}

function findNextOpenTime(hours: OperatingHours, currentDayIndex: number): string | null {
  // Look for the next open day within the week
  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (currentDayIndex + i) % 7;
    const nextDayKey = DAY_KEYS[nextDayIndex];
    const nextDayHours = hours[nextDayKey];

    if (nextDayHours?.enabled) {
      const periods = getDayPeriods(nextDayHours);
      const firstPeriod = periods[0];
      const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      
      if (i === 1) {
        return `Abre amanhã às ${firstPeriod.open}`;
      }
      return `Abre ${dayNames[nextDayIndex]} às ${firstPeriod.open}`;
    }
  }

  return null;
}

export function formatTodayHours(openingHours: OperatingHours | null | undefined): string | null {
  if (!openingHours) return null;

  const now = new Date();
  const currentDayIndex = now.getDay();
  const currentDayKey = DAY_KEYS[currentDayIndex];
  const currentDayHours = openingHours[currentDayKey];

  if (!currentDayHours?.enabled) {
    return 'Fechado hoje';
  }

  const periods = getDayPeriods(currentDayHours);
  
  if (periods.length === 1) {
    return `${periods[0].open} - ${periods[0].close}`;
  }
  
  // Multiple periods
  return periods.map(p => `${p.open}-${p.close}`).join(' | ');
}
