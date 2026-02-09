import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Recuperar usuario del localStorage al montarse
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const register = async (nombre, mail, password) => {
    const userData = await authService.register(nombre, mail, password);
    setUser(userData.user);
    localStorage.setItem('user', JSON.stringify(userData.user));
    return userData.user;
  };

  const login = async (mail, password) => {
    const userData = await authService.login(mail, password);
    setUser(userData.user);
    localStorage.setItem('user', JSON.stringify(userData.user));
    return userData.user;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
