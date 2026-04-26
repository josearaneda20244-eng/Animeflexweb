// components/NotificationManager.tsx
import React, { useState, useEffect, createContext, useContext } from 'react';
import { Bell, X, Check, AlertCircle, Info, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/apiClient';

function safeParseArray<T = any>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionText?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();

  // Load notifications from API and localStorage
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      // Try to load from API first
      const response = await apiClient.get<any>(`/users/${user.id}/notifications`);
      const rawList: any[] = Array.isArray(response) ? response : (response?.data ?? []);
      const apiNotifications = rawList.map((n: any) => ({
        ...n,
        timestamp: new Date(n.timestamp)
      }));
      setNotifications(apiNotifications);
    } catch (error) {
      // Fallback to localStorage
      console.log('Loading notifications from localStorage');
      const stored = localStorage.getItem(`notifications_${user.id}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const notificationsWithDates = parsed.map((n: any) => ({
            ...n,
            timestamp: new Date(n.timestamp)
          }));
          setNotifications(notificationsWithDates);
        } catch (parseError) {
          console.error('Error parsing stored notifications:', parseError);
        }
      }
    }
  };

  const addNotification = async (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    };

    // Add to local state immediately
    setNotifications(prev => [newNotification, ...prev].slice(0, 50));

    // Try to save to API
    if (user) {
      try {
        await apiClient.post(`/users/${user.id}/notifications`, newNotification);
      } catch (error) {
        // Save to localStorage as fallback
        const current = safeParseArray(localStorage.getItem(`notifications_${user.id}`));
        localStorage.setItem(`notifications_${user.id}`, JSON.stringify([newNotification, ...current].slice(0, 50)));
      }
    }
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );

    if (user) {
      try {
        await apiClient.patch(`/users/${user.id}/notifications/${id}/read`, {});
      } catch (error) {
        // Update localStorage
        const current = safeParseArray(localStorage.getItem(`notifications_${user.id}`));
        const updated = current.map((n: any) => n.id === id ? { ...n, read: true } : n);
        localStorage.setItem(`notifications_${user.id}`, JSON.stringify(updated));
      }
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    if (user) {
      try {
        await apiClient.patch(`/users/${user.id}/notifications/read-all`, {});
      } catch (error) {
        // Update localStorage
        const current = safeParseArray(localStorage.getItem(`notifications_${user.id}`));
        const updated = current.map((n: any) => ({ ...n, read: true }));
        localStorage.setItem(`notifications_${user.id}`, JSON.stringify(updated));
      }
    }
  };

  const removeNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));

    if (user) {
      try {
        await apiClient.delete(`/users/${user.id}/notifications/${id}`);
      } catch (error) {
        // Update localStorage
        const current = safeParseArray(localStorage.getItem(`notifications_${user.id}`));
        const updated = current.filter((n: any) => n.id !== id);
        localStorage.setItem(`notifications_${user.id}`, JSON.stringify(updated));
      }
    }
  };

  const clearAll = async () => {
    setNotifications([]);

    if (user) {
      try {
        await apiClient.delete(`/users/${user.id}/notifications`);
      } catch (error) {
        localStorage.removeItem(`notifications_${user.id}`);
      }
    }
  };

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Show browser notification for new notifications
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      notifications.forEach(notification => {
        if (!notification.read) {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico'
          });
        }
      });
    }
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const value: NotificationContextType = {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    unreadCount
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onRemove: (id: string) => void;
  onAction?: (url: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onRemove,
  onAction
}) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case 'success':
        return 'border-green-500';
      case 'error':
        return 'border-red-500';
      case 'warning':
        return 'border-yellow-500';
      case 'info':
      default:
        return 'border-blue-500';
    }
  };

  return (
    <div className={`p-4 border-l-4 ${getBorderColor()} bg-card rounded-lg shadow-sm ${
      !notification.read ? 'bg-accent/50' : ''
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">{notification.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {notification.timestamp.toLocaleString()}
            </p>
            {notification.actionUrl && notification.actionText && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => onAction?.(notification.actionUrl!)}
              >
                {notification.actionText}
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!notification.read && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkAsRead(notification.id)}
              className="h-6 w-6 p-0"
            >
              <Check className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(notification.id)}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

interface NotificationManagerProps {
  className?: string;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({ className }) => {
  const { notifications, markAsRead, markAllAsRead, removeNotification, clearAll, unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (url: string) => {
    window.location.href = url;
    setIsOpen(false);
  };

  const requestPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="fixed left-2 right-2 top-[66px] sm:absolute sm:left-auto sm:right-0 sm:top-12 w-auto sm:w-96 max-h-[calc(100vh-78px)] sm:max-h-96 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-sm sm:text-base">Notificaciones</h3>
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={requestPermission}
                  className="h-6 w-6 p-0"
                >
                  <Settings className="w-3 h-3" />
                </Button>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-[11px] sm:text-xs px-2"
                  >
                    Marcar leídas
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    className="text-[11px] sm:text-xs text-red-500 hover:text-red-600 px-2"
                  >
                    Limpiar
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No hay notificaciones</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {notifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onRemove={removeNotification}
                    onAction={handleAction}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};