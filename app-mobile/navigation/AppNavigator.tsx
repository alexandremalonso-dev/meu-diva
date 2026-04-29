import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

// Telas temporárias (vamos criar depois)
const HomeScreen = () => null;
const AgendaScreen = () => null;
const PerfilScreen = () => null;

const COLORS = {
  primary: "#E03673",
  secondary: "#2F80D3",
  gray: "#6B7280",
};

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Home') iconName = focused ? 'search' : 'search-outline';
            else if (route.name === 'Agenda') iconName = focused ? 'calendar' : 'calendar-outline';
            else if (route.name === 'Perfil') iconName = focused ? 'person' : 'person-outline';
            return <Ionicons name={iconName as any} size={size} color={color} />;
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.gray,
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: '#fff',
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Buscar' }} />
        <Tab.Screen name="Agenda" component={AgendaScreen} options={{ title: 'Minhas Sessões' }} />
        <Tab.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Meu Perfil' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}