"use client";

import { useState, useRef, useEffect } from 'react';
import { Send, Smile, Image as ImageIcon, X, Paperclip } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onSendImage?: (file: File) => void;
  disabled?: boolean;
  sending?: boolean;
  replyTo?: { id: number; message: string } | null;
  onCancelReply?: () => void;
}

const EMOJIS = ['😊', '😂', '❤️', '👍', '🙏', '😢', '😮', '🤝', '👋', '🎉', '💪', '🌟', '😔', '🤗', '👏', '🙌'];

// 🔥 Arquivos aceitos para anexo: imagens + documentos comuns
const ACCEPT_TYPES = "image/*,.pdf,.doc,.docx,.txt";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function ChatInput({ onSendMessage, onSendImage, disabled, sending, replyTo, onCancelReply }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (!message.trim() || disabled || sending) return;
    onSendMessage(message.trim());
    setMessage('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const validateAndSendFile = (file: File) => {
    setFileError(null);
    if (file.size > MAX_FILE_SIZE) {
      setFileError('Arquivo muito grande. Máximo 5MB.');
      setTimeout(() => setFileError(null), 3000);
      return;
    }
    onSendImage?.(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSendFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          validateAndSendFile(file);
          return;
        }
      }
    }
  };

  return (
    <div className="border-t border-gray-100 bg-white">
      {fileError && (
        <div className="px-4 pt-2 text-xs text-red-600">{fileError}</div>
      )}

      {replyTo && (
        <div className="flex items-center justify-between px-4 pt-2 pb-1 bg-gray-50 border-l-2 border-[#E03673] mx-3 mt-2 rounded">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-[#E03673] font-medium">Respondendo</p>
            <p className="text-xs text-gray-600 truncate">{replyTo.message.startsWith('[IMAGE]') || replyTo.message.startsWith('[DOC:') ? '📎 Anexo' : replyTo.message}</p>
          </div>
          <button onClick={onCancelReply} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        <div className="relative" ref={emojiPickerRef}>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(v => !v)}
            disabled={disabled}
            className="p-2 text-gray-400 hover:text-[#E03673] hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
            title="Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 p-2 grid grid-cols-8 gap-1 z-50 w-64">
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className="text-xl hover:bg-gray-100 rounded p-1 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_TYPES}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || !onSendImage}
          className="p-2 text-gray-400 hover:text-[#E03673] hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
          title="Enviar imagem ou documento"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          placeholder="Digite sua mensagem..."
          rows={1}
          className="flex-1 resize-none border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E03673]/30 focus:border-[#E03673] disabled:bg-gray-50 disabled:text-gray-400 max-h-[120px]"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!message.trim() || disabled || sending}
          className="p-2.5 bg-[#E03673] text-white rounded-full hover:bg-[#c02c5e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          title="Enviar"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
