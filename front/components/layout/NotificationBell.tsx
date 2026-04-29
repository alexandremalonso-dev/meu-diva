'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Trash2, Calendar, DollarSign, Mail, Lock, MessageSquare, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: any;
  action_link: string | null;
  is_read: boolean;
  created_at: string;
}

const getIconByType = (type: string) => {
  switch (type) {
    case 'appointment_confirmed':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'appointment_cancelled':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'appointment_rescheduled':
      return <RefreshCw className="w-5 h-5 text-orange-500" />;
    case 'appointment_created':
      return <Calendar className="w-5 h-5 text-blue-500" />;
    case 'payment_received':
      return <DollarSign className="w-5 h-5 text-emerald-500" />;
    case 'email_changed':
      return <Mail className="w-5 h-5 text-purple-500" />;
    case 'password_reset':
      return <Lock className="w-5 h-5 text-yellow-500" />;
    case 'invite_received':
      return <MessageSquare className="w-5 h-5 text-indigo-500" />;
    default:
      return <Bell className="w-5 h-5 text-gray-500" />;
  }
};

export function NotificationBell() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api('/api/notifications?limit=10', { method: 'GET' });
      const notificationsList = Array.isArray(data) ? data : data.notifications || [];
      setNotifications(notificationsList);
      const unread = notificationsList.filter((n: Notification) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    if (!user) return;
    try {
      const data = await api('/api/notifications/unread/count', { method: 'GET' });
      setUnreadCount(data.unread_count || data.count || 0);
    } catch (error) {
      console.error('Erro ao carregar contagem:', error);
      setUnreadCount(0);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await api('/api/notifications/mark-read', {
        method: 'POST',
        body: JSON.stringify({ notification_ids: [notificationId] })
      });
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api('/api/notifications/mark-all-read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    try {
      await api(`/api/notifications/${notificationId}`, { method: 'DELETE' });
      const wasUnread = !notifications.find(n => n.id === notificationId)?.is_read;
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao deletar notificação:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
      loadUnreadCount();
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
    } catch {
      return 'data desconhecida';
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        className="relative p-2 rounded-lg transition-colors"
        style={{ color: "#2F80D3", background: "rgba(47,128,211,0.08)" }}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#E03673] text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-[#E03673] to-[#E03673]/80">
            <h3 className="font-semibold text-white">Notificações</h3>
            {notifications.some(n => !n.is_read) && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-white/80 hover:text-white flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" /> Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Carregando...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors relative ${!notification.is_read ? 'bg-[#FCE4EC]/30' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        {getIconByType(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!notification.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                            {notification.title}
                          </p>
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="text-gray-300 hover:text-red-500 flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{notification.message}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-400">{formatTime(notification.created_at)}</span>
                          {!notification.is_read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="text-xs text-[#2F80D3] hover:text-[#E03673] flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Marcar como lida
                            </button>
                          )}
                        </div>
                        {notification.action_link && (
                          <Link
                            href={notification.action_link}
                            onClick={() => {
                              if (!notification.is_read) markAsRead(notification.id);
                              setIsOpen(false);
                            }}
                            className="text-xs text-[#E03673] hover:underline mt-2 inline-block"
                          >
                            Ver detalhes →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-center text-sm text-[#2F80D3] hover:text-[#E03673] block"
            >
              Ver todas as notificações
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}