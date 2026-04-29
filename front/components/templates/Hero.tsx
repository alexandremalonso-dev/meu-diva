"use client";

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/buttonVariants';

interface HeroProps {
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
}

export function Hero({ title, subtitle, buttonText, buttonLink }: HeroProps) {
  return (
    <section className="py-20 px-4 md:px-6 text-center">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          {title}
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          {subtitle}
        </p>
        <Link href={buttonLink} className={buttonVariants({ size: "lg" })}>
          {buttonText}
        </Link>
      </div>
    </section>
  );
}