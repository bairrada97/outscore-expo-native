import { getDeviceTimeZone, initializeTimeZone } from '@/utils/timezone';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface TimeZoneContextType {
  timeZone: string;
  isLoading: boolean;
}

const TimeZoneContext = createContext<TimeZoneContextType>({
  timeZone: 'UTC',
  isLoading: true,
});

export function TimeZoneProvider({ children }: { children: ReactNode }) {
  const [timeZone, setTimeZone] = useState<string>(getDeviceTimeZone());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function setupTimeZone() {
      try {
        const tz = await initializeTimeZone();
        setTimeZone(tz);
      } catch (error) {
        console.error('Error initializing timezone:', error);
      } finally {
        setIsLoading(false);
      }
    }

    setupTimeZone();
  }, []);

  return (
    <TimeZoneContext.Provider value={{ timeZone, isLoading }}>
      {children}
    </TimeZoneContext.Provider>
  );
}

export function useTimeZone(): TimeZoneContextType {
  const context = useContext(TimeZoneContext);
  if (!context) {
    throw new Error('useTimeZone must be used within a TimeZoneProvider');
  }
  return context;
}

