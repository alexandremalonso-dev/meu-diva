"use client";

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Smile, Image } from 'lucide-react';

const EMOJIS = [
  '😊','😂','❤️','👍','🙏','😢','😍','🔥','✅','💪',
  '😅','🤔','😎','🥰','😭','👏','🎉','💙','😤','🫂',
  '🌟','💬','🤗','😇','🙂','😌','🥺','😔','😁','🫶'
];

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void>;
  onSendImage?: (file: File) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  onSendImage,
  disabled = false,
  placeholder = "Digite sua mensagem..."
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [message]);

  // Fechar emoji picker ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojis(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ Colar imagem do clipboard (Ctrl+V com print/screenshot)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file && onSendImage) {
          await onSendImage(file);
        }
        return;
      }
    }
  };

  const handleSend = async () => {
    if (!message.trim() || sending || disabled) return;
    setSending(true);
    try {
      await onSendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newMessage = message.slice(0, start) + emoji + message.slice(end);
    setMessage(newMessage);
    // Reposicionar cursor após o emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSendImage) {
      await onSendImage(file);
      e.target.value = '';
    }
  };

  return (
    <div className="relative">
      {/* Emoji picker */}
      {showEmojis && (
        <div
          ref={emojiRef}
          className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-50 w-64"
        >
          <div className="grid grid-cols-10 gap-1">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => insertEmoji(emoji)}
                className="text-lg hover:bg-gray-100 rounded p-0.5 transition-colors leading-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-1.5">
        {/* Botão emoji */}
        <button
          type="button"
          onClick={() => setShowEmojis(!showEmojis)}
          disabled={disabled}
          className="p-2 text-gray-400 hover:text-[#E03673] transition-colors flex-shrink-0 mb-0.5"
          title="Emojis"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Botão imagem */}
        <button
          type="button"
          onClick={handleImageClick}
          disabled={disabled || !onSendImage}
          className="p-2 text-gray-400 hover:text-[#E03673] transition-colors flex-shrink-0 mb-0.5 disabled:opacity-30"
          title="Enviar imagem"
        >
          <Image className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled || sending}
          rows={1}
          className="flex-1 py-2 px-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
          style={{ minHeight: '40px', maxHeight: '120px' }}
        />

        {/* Botão enviar */}
        <button
          onClick={handleSend}
          disabled={disabled || sending || !message.trim()}
          className="p-2 bg-[#E03673] text-white rounded-xl hover:bg-[#c02c5e] disabled:opacity-40 transition-colors flex items-center justify-center flex-shrink-0 mb-0.5"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}