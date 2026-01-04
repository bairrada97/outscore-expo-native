// contexts/TimeZoneContext.tsx

import { getDeviceTimeZone, initializeTimeZone } from '@/utils/store-user-timezone';
import React, { createContext, useContext, useState, useEffect } from 'react';


// Define the context type
interface TimeZoneContextType {
  timeZone: string;
  isLoading: boolean;
}

// Create the context with default values
const TimeZoneContext = createContext<TimeZoneContextType>({
  timeZone: 'UTC',
  isLoading: true
});

// Create the provider component
export const TimeZoneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timeZone, setTimeZone] = useState<string>(getDeviceTimeZone()); // Immediately use device timezone
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function setupTimeZone() {
      try {
        // Initialize with async storage + device timezone fallback
        const tz = await initializeTimeZone();
        setTimeZone(tz);
        console.log('TimeZoneContext initialized with:', tz);
      } catch (error) {
        console.error('Error initializing timezone:', error);
        // Fallback already handled in getDeviceTimeZone
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
};

// Create a custom hook for easy access
export function useTimeZone() {
  const context = useContext(TimeZoneContext);
  if (!context) {
    throw new Error('useTimeZone must be used within a TimeZoneProvider');
  }
  return context;
}
