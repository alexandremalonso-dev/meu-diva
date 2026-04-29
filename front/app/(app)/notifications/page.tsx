'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Trash2, ArrowLeft, Calendar, DollarSign, Mail, Lock, MessageSquare, Video, Clock, XCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
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

const notificationTypeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  appointment_created: { icon: <Calendar className='w-4 h-4' />, color: 'bg-blue-100 text-blue-600' },
  appointment_confirmed: { icon: <CheckCircle className='w-4 h-4' />, color: 'bg-green-100 text-green-600' },
  appointment_cancelled: { icon: <XCircle className='w-4 h-4' />, color: 'bg-red-100 text-red-600' },
  appointment_rescheduled: { icon: <RefreshCw className='w-4 h-4' />, color: 'bg-orange-100 text-orange-600' },
  payment_received: { icon: <DollarSign className='w-4 h-4' />, color: 'bg-emerald-100 text-emerald-600' },
  email_changed: { icon: <Mail className='w-4 h-4' />, color: 'bg-purple-100 text-purple-600' },
  password_reset: { icon: <Lock className='w-4 h-4' />, color: 'bg-yellow-100 text-yellow-600' },
  invite_received: { icon: <MessageSquare className='w-4 h-4' />, color: 'bg-indigo-100 text-indigo-600' },
  default: { icon: <Bell className='w-4 h-4' />, color: 'bg-gray-100 text-gray-600' }
};

export default function NotificationsPage() {
  const { execute: apiCall } = useApi();
  const { user } = useAuth();
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall({
        url: '/api/notifications?limit=100',
        requireAuth: true
      });
      setNotifications(data);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user, loadNotifications]);

  const markAsRead = async (notificationId: number) => {
    try {
      await apiCall({
        url: '/api/notifications/mark-read',
        method: 'POST',
        body: { notification_ids: [notificationId] },
        requireAuth: true
      });
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiCall({
        url: '/api/notifications/mark-all-read',
        method: 'POST',
        requireAuth: true
      });
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    try {
      await apiCall({
        url: `/api/notifications/${notificationId}`,
        method: 'DELETE',
        requireAuth: true
      });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Erro ao deletar notificação:', error);
    }
  };

  const deleteSelected = async () => {
    for (const id of selectedNotifications) {
      await deleteNotification(id);
    }
    setSelectedNotifications([]);
  };

  const toggleSelect = (id: number) => {
    setSelectedNotifications(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getTypeConfig = (type: string) => {
    return notificationTypeConfig[type] || notificationTypeConfig.default;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } else if (diffInDays < 7) {
      return format(date, "EEEE 'às' HH:mm", { locale: ptBR });
    } else {
      return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    }
  };

  const filteredNotifications = notifications.filter(n =>
    filter === 'all' || !n.is_read
  );

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
            <p className="text-sm text-gray-500">
              {unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedNotifications.length > 0 && (
            <button
              onClick={deleteSelected}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Excluir ({selectedNotifications.length})
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3 py-1.5 text-sm text-[#2F80D3] hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
            >
              <CheckCheck className="w-4 h-4" />
              Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'text-[#E03673] border-b-2 border-[#E03673]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            filter === 'unread'
              ? 'text-[#E03673] border-b-2 border-[#E03673]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Não lidas
          {unreadCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-[#E03673] text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E03673]"></div>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">Nenhuma notificação encontrada</p>
          <p className="text-sm text-gray-300 mt-1">
            Quando houver novidades, elas aparecerão aqui
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map((notification) => {
            const { icon, color } = getTypeConfig(notification.type);
            return (
              <div
                key={notification.id}
                className={`p-4 rounded-xl transition-all hover:shadow-md ${
                  !notification.is_read ? 'bg-[#FCE4EC]/30 border-l-4 border-l-[#E03673]' : 'bg-white border border-gray-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 pt-0.5">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.includes(notification.id)}
                      onChange={() => toggleSelect(notification.id)}
                      className="w-4 h-4 rounded border-gray-300 text-[#E03673] focus:ring-[#E03673]"
                    />
                  </div>

                  <div className={`flex-shrink-0 w-8 h-8 rounded-full ${color} flex items-center justify-center`}>
                    {icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm ${!notification.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">{notification.message}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatTime(notification.created_at)}
                        </span>
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-xs text-[#2F80D3] hover:text-[#E03673] flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Marcar como lida
                        </button>
                      )}
                      {notification.action_link && (
                        <Link
                          href={notification.action_link}
                          onClick={() => {
                            if (!notification.is_read) markAsRead(notification.id);
                          }}
                          className="text-xs text-[#E03673] hover:underline flex items-center gap-1"
                        >
                          Ver detalhes →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}