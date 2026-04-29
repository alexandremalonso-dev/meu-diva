"use client";

interface TagProps {
  children: React.ReactNode;
  variant?: 'default' | 'purple' | 'blue' | 'green' | 'yellow';
  size?: 'sm' | 'md';
}

export function Tag({ children, variant = 'default', size = 'md' }: TagProps) {
  const variantClass = {
    default: 'bg-gray-100 text-gray-800',
    purple: 'bg-purple-100 text-purple-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
  };
  
  const sizeClass = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };
  
  return (
    <span className={`inline-block rounded-full ${variantClass[variant]} ${sizeClass[size]} font-medium`}>
      {children}
    </span>
  );
}