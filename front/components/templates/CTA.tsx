"use client";

import { ReactNode } from 'react';

interface CTABannerProps {
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
}

export function CTABanner({ title, subtitle, buttonText, buttonLink }: CTABannerProps) {
  return (
    <div className="bg-gradient-to-r from-[#E03673] to-[#2F80D3] rounded-2xl p-8 text-white text-center">
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="mb-4">{subtitle}</p>
      <a 
        href={buttonLink}
        className="inline-block bg-white text-[#E03673] px-6 py-2 rounded-full font-semibold hover:bg-gray-100 transition-colors"
      >
        {buttonText}
      </a>
    </div>
  );
}

interface SectionProps {
  children: ReactNode;
  className?: string;
}

export function Section({ children, className = '' }: SectionProps) {
  return (
    <section className={`py-12 px-4 ${className}`}>
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </section>
  );
}