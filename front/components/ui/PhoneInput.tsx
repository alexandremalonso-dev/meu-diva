"use client";

import { useState } from 'react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

export function PhoneInput({ 
  value, 
  onChange, 
  placeholder, 
  className = '',
  disabled = false,
  required = false
}: PhoneInputProps) {
  
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length <= 2) {
      return numbers;
    }
    if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    }
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    onChange(formatted);
  };

  return (
    <input
      type="tel"
      value={value}
      onChange={handleChange}
      placeholder={placeholder || "(00) 00000-0000"}
      disabled={disabled}
      required={required}
      className={`w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none ${className}`}
    />
  );
}