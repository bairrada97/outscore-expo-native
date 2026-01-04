import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { format, addDays, subDays } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';

interface CustomTabBarProps {
  currentDate: Date;
}

export function CustomTabBar({ currentDate }: CustomTabBarProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  
  // Generate dates for the tabs
  const dates = [
    subDays(currentDate, 2),
    subDays(currentDate, 1),
    currentDate,
    addDays(currentDate, 1),
    addDays(currentDate, 2),
  ];

  const handleTabPress = (date: Date) => {
    router.setParams({ date: format(date, 'yyyy-MM-dd') });
  };

  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.tabsContainer}>
        {dates.map((date) => {
          const isActive = format(date, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');
          return (
            <TouchableOpacity
              key={date.toISOString()}
              style={[
                styles.tabButton,
                isActive && styles.activeTab,
                { width: (width - 60) / 5 } // 60px for calendar button
              ]}
              onPress={() => handleTabPress(date)}
            >
              <Text style={[
                styles.tabLabel,
                isActive && styles.activeTabLabel
              ]}>
                {format(date, 'EEE')}
              </Text>
              <Text style={[
                styles.tabDate,
                isActive && styles.activeTabLabel
              ]}>
                {format(date, 'd')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={styles.calendarButton}
        onPress={() => router.push('/calendar')}
      >
        <Ionicons name="calendar" size={24} color="#666" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tabButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
  },
  tabDate: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#007AFF',
  },
  calendarButton: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#e0e0e0',
  },
}); 