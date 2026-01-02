import validTimezones from './timezones.json';

const timezoneSet = new Set<string>(validTimezones);

export const isValidTimezone = (timezone: string): boolean => {
  return timezoneSet.has(timezone);
};

export const getValidTimezones = (): string[] => {
  return [...validTimezones];
};


export const commonTimezones = [
  'UTC',
  'Europe/London',
  'Europe/Lisbon',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Australia/Sydney',
];

