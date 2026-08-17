// ============================================
// DATE UTILITIES FOR APPOINTMENT PARSING
// ============================================

export interface ParseTimeResult {
  success: boolean;
  time?: Date;
  nameFromInput?: string;
  error?: string;
}

// Parse natural language appointment times
export function parseAppointmentTime(input: string): ParseTimeResult {
  const lowerInput = input.toLowerCase().trim();
  
  // Try to extract time and name
  // Patterns:
  // "John 2pm" -> name="John", time="2pm"
  // "2pm" -> name=null, time="2pm"
  // "tomorrow 3pm Mary" -> name="Mary", time="tomorrow 3pm"
  // "Mary tomorrow 10am" -> name="Mary", time="tomorrow 10am"
  
  let nameFromInput: string | undefined;
  let timeString = lowerInput;
  
  // Common time keywords
  const timeKeywords = [
    'today', 'tomorrow', 'am', 'pm',
    'morning', 'afternoon', 'evening',
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  ];
  
  // Split into words
  const words = lowerInput.split(/\s+/);
  
  // Find where time-related words start
  let timeStartIndex = -1;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Check if word contains time indicators
    if (
      /\d/.test(word) || // Has digits
      timeKeywords.some(k => word.includes(k)) ||
      /^\d{1,2}:\d{2}/.test(word) // HH:MM format
    ) {
      timeStartIndex = i;
      break;
    }
  }
  
  // Extract name (words before time)
  if (timeStartIndex > 0) {
    nameFromInput = words.slice(0, timeStartIndex).join(' ');
    timeString = words.slice(timeStartIndex).join(' ');
  } else if (timeStartIndex === -1) {
    // No clear time found - might be name-only input
    // Try to extract time from end
    const lastWord = words[words.length - 1];
    if (/\d/.test(lastWord)) {
      // Last word has digits, assume it's time
      nameFromInput = words.slice(0, -1).join(' ') || undefined;
      timeString = lastWord;
    }
  }
  
  // Parse the time string
  const parsedTime = parseTimeString(timeString);
  
  if (!parsedTime) {
    return {
      success: false,
      error: "Could not parse time from input",
    };
  }
  
  return {
    success: true,
    time: parsedTime,
    nameFromInput: nameFromInput?.trim(),
  };
}

function parseTimeString(timeStr: string): Date | null {
  const now = new Date();
  let targetDate = new Date();
  let timeSet = false;
  
  const lowerStr = timeStr.toLowerCase().trim();
  
  // Handle "today" / "tomorrow"
  if (lowerStr.includes('tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  
  // Handle specific dates
  // Format: "Aug 20", "20/8", "8/20", "2026-08-20"
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  
  // "Aug 20" or "20 Aug"
  for (let i = 0; i < monthNames.length; i++) {
    if (lowerStr.includes(monthNames[i])) {
      const dayMatch = lowerStr.match(/\b(\d{1,2})\b/);
      if (dayMatch) {
        targetDate.setMonth(i);
        targetDate.setDate(parseInt(dayMatch[1]));
      }
    }
  }
  
  // Slash format: "20/8" or "8/20"
  const slashMatch = lowerStr.match(/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    const first = parseInt(slashMatch[1]);
    const second = parseInt(slashMatch[2]);
    
    // Assume day/month if first > 12, otherwise month/day (US format)
    if (first > 12) {
      targetDate.setDate(first);
      targetDate.setMonth(second - 1);
    } else {
      targetDate.setMonth(first - 1);
      targetDate.setDate(second);
    }
  }
  
  // ISO format: "2026-08-20"
  const isoMatch = lowerStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    targetDate.setFullYear(parseInt(isoMatch[1]));
    targetDate.setMonth(parseInt(isoMatch[2]) - 1);
    targetDate.setDate(parseInt(isoMatch[3]));
  }
  
  // Parse time portion
  // Formats: "2pm", "14:00", "2:30pm", "14:30"
  
  // Try "2pm" / "2:30pm" format
  const ampmMatch = lowerStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1]);
    const minutes = ampmMatch[2] ? parseInt(ampmMatch[2]) : 0;
    const meridiem = ampmMatch[3];
    
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    
    targetDate.setHours(hours, minutes, 0, 0);
    timeSet = true;
  }
  
  // Try 24-hour format: "14:00", "14:30"
  if (!timeSet) {
    const time24Match = lowerStr.match(/\b(\d{1,2}):(\d{2})\b/);
    if (time24Match) {
      const hours = parseInt(time24Match[1]);
      const minutes = parseInt(time24Match[2]);
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        targetDate.setHours(hours, minutes, 0, 0);
        timeSet = true;
      }
    }
  }
  
  // Try bare hour: "2", "14"
  if (!timeSet) {
    const bareHourMatch = lowerStr.match(/\b(\d{1,2})\b/);
    if (bareHourMatch) {
      const hours = parseInt(bareHourMatch[1]);
      
      // If it's a reasonable hour (0-23)
      if (hours >= 0 && hours <= 23) {
        targetDate.setHours(hours, 0, 0, 0);
        timeSet = true;
      }
    }
  }
  
  // If no time was set, return null
  if (!timeSet) {
    return null;
  }
  
  // If the parsed time is in the past today, assume tomorrow
  if (targetDate < now && !lowerStr.includes('tomorrow') && !slashMatch && !isoMatch) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  
  return targetDate;
}

// Format appointment time for display
export function formatAppointmentTime(date: Date, short: boolean = false): string {
  const now = new Date();
  const isToday = isSameDay(date, now);
  const isTomorrow = isSameDay(date, addDays(now, 1));
  
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  if (short) {
    return timeStr;
  }
  
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  
  if (isToday) {
    return `Today ${timeStr}`;
  } else if (isTomorrow) {
    return `Tomorrow ${timeStr}`;
  } else {
    return `${dateStr} ${timeStr}`;
  }
}

// Check if date is today
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

// Check if date is tomorrow
export function isTomorrow(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(date, tomorrow);
}

// Helper: Check if two dates are the same day
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// Helper: Add days to date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
