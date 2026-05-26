"use client";

import { useState, useRef, useEffect } from 'react';
import { Check, CheckCheck, MoreHorizontal, Reply, Trash2, Smile } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface ChatMessageProps {
  id: number;
  sender_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
  onDeleted?: (messageId: number) => void;
  onReply?: (message: { id: number; message: string }) => void;
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🤝','😊','🤓','😢','😭','👋','👊','🙏','🤧','🤒','🙁'];

export function ChatMessage({ id, sender_id, message, is_read, created_at, read_at, onDeleted, onReply }: ChatMessageProps) {
  const { user } = useAuth();
  const isOwn = sender_id === user?.id;
  const isImage = message.startsWith('[IMAGE]');
  const imageData = isImage ? message.slice(7) : null;

  const [menuOpen, setMenuOpen] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen && !reactionOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setReactionOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen, reactionOpen]);

  const handleDelete = async () => {
    if (!isOwn) return;
    setMenuOpen(false);
    setDeleting(true);
    try {
      await api(`/api/chat/messages/${id}`, { method: 'DELETE' });
      setDeleted(true);
      onDeleted?.(id);
    } catch (err) {
      console.error('Erro ao excluir mensagem:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleReply = () => {
    setMenuOpen(false);
    onReply?.({ id, message: isImage ? '📷 Imagem' : message });
  };

  const handleReaction = (emoji: string) => {
    setReactionOpen(false);
    setMenuOpen(false);
    console.log('Reação:', emoji, 'na mensagem:', id);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  if (deleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[85%] px-3 py-2 rounded-2xl bg-gray-100 text-gray-400 text-sm italic">
          Mensagem excluída
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {/* Bolha com botão de menu DENTRO */}
      <div
        ref={menuRef}
        className={`relative max-w-[85%] rounded-2xl overflow-visible group ${
          isOwn
            ? 'bg-[#E03673] text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
        } ${isImage ? 'p-1' : 'px-3 py-2'}`}
      >
        {isImage ? (
          <div>
            <img
              src={imageData!}
              alt="Imagem enviada"
              className="max-w-full rounded-xl cursor-pointer"
              style={{ maxHeight: '200px', objectFit: 'contain' }}
              onClick={() => window.open(imageData!, '_blank')}
            />
            <div className={`text-xs px-2 pb-1 flex items-center gap-1 justify-end mt-1 ${
              isOwn ? 'text-white/70' : 'text-gray-400'
            }`}>
              <span>{formatTime(created_at)}</span>
              {isOwn && (is_read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm break-words whitespace-pre-wrap pr-5">{message}</p>
            {/* Horário + status + botão menu na mesma linha */}
            <div className={`text-xs mt-1 flex items-center gap-1 justify-end ${
              isOwn ? 'text-white/70' : 'text-gray-400'
            }`}>
              <span>{formatTime(created_at)}</span>
              {isOwn && (is_read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}

              {/* 🔥 Botão de menu — aparece ao hover, dentro da bolha */}
              <button
                onClick={() => { setMenuOpen(!menuOpen); setReactionOpen(false); }}
                className={`ml-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-0.5 ${
                  isOwn ? 'hover:bg-white/20' : 'hover:bg-gray-200'
                }`}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}

        {/* Menu de contexto — abre abaixo da bolha */}
        {menuOpen && (
          <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 min-w-[160px]`}>
            <button
              onClick={handleReply}
              className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Reply className="w-4 h-4 text-gray-400" />
              Responder
            </button>

            <button
              onClick={() => setReactionOpen(!reactionOpen)}
              className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Smile className="w-4 h-4 text-gray-400" />
              Adicionar reação
            </button>

            {reactionOpen && (
              <div className="border-t border-gray-100 px-2 py-2 flex flex-wrap gap-1">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="text-lg hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {isOwn && (
              <>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Excluindo...' : 'Excluir mensagem'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}