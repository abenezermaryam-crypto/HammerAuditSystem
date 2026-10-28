import React, { createContext, useContext, useState } from 'react';
import { User } from '../types';
import { api, setToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  updateUser: (user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  async function login(username: string, password: string) {
    const res = await api.login({ username, password });
    if (!res?.token || !res?.user) {
      throw new Error('Authentication failed. Please verify credentials.');
    }

    await setToken(res.token);
    setUser(res.user);
  }

  function updateUser(updatedUser: User) {
    setUser(updatedUser);
  }

  async function logout() {
    try {
      await setToken(null);
    } catch (e) {
      console.warn('Error clearing token:', e);
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
