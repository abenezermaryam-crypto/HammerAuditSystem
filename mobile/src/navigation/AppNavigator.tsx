import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DailyIncomeScreen } from '../screens/DailyIncomeScreen';
import { DailyExpenseScreen } from '../screens/DailyExpenseScreen';
import { DailyClosingScreen } from '../screens/DailyClosingScreen';
import { ThreeDayAuditScreen } from '../screens/ThreeDayAuditScreen';
import { DiscrepanciesScreen } from '../screens/DiscrepanciesScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { UserManagementScreen } from '../screens/UserManagementScreen';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const { user } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // Handled consistently by custom interactive AppTopHeader with Back & Home icons
      }}
    >
      {!user ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
        />
      ) : (
        <>
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
          />
          {user.role === 'manager' && (
            <>
              <Stack.Screen name="Analytics" component={AnalyticsScreen} />
              <Stack.Screen name="DailyIncome" component={DailyIncomeScreen} />
              <Stack.Screen name="DailyExpense" component={DailyExpenseScreen} />
              <Stack.Screen name="DailyClosing" component={DailyClosingScreen} />
              <Stack.Screen name="ThreeDayAudit" component={ThreeDayAuditScreen} />
              <Stack.Screen name="Discrepancies" component={DiscrepanciesScreen} />
              <Stack.Screen name="Reports" component={ReportsScreen} />
              <Stack.Screen name="UserManagement" component={UserManagementScreen} />
            </>
          )}
          {user.role === 'recorder' && (
            <>
              <Stack.Screen name="DailyIncome" component={DailyIncomeScreen} />
              <Stack.Screen name="DailyExpense" component={DailyExpenseScreen} />
              <Stack.Screen name="DailyClosing" component={DailyClosingScreen} />
              <Stack.Screen name="Discrepancies" component={DiscrepanciesScreen} />
            </>
          )}
          {user.role === 'auditor' && (
            <>
              <Stack.Screen name="Analytics" component={AnalyticsScreen} />
              <Stack.Screen name="ThreeDayAudit" component={ThreeDayAuditScreen} />
              <Stack.Screen name="Discrepancies" component={DiscrepanciesScreen} />
              <Stack.Screen name="Reports" component={ReportsScreen} />
              <Stack.Screen name="DailyIncome" component={DailyIncomeScreen} />
              <Stack.Screen name="DailyExpense" component={DailyExpenseScreen} />
            </>
          )}
        </>
      )}
    </Stack.Navigator>
  );
};
