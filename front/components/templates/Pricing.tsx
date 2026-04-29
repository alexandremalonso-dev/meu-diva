"use client";

import { PricingInformation } from '@/features/billing/PricingInformation';
import { Section } from '@/features/landing/Section';
import { PLAN_ID } from '@/utils/AppConfig';

const pricingTiers = [
  {
    name: 'Sessão avulsa',
    price: 'R$ 150',
    description: 'Ideal para quem quer experimentar',
    features: [
      { name: '1 sessão de 50 minutos' },
      { name: 'Escolha seu terapeuta' },
      { name: 'Atendimento por video' },
    ],
    priceId: PLAN_ID.FREE,
  },
  {
    name: 'Pacote 5 sessões',
    price: 'R$ 675',
    description: 'Mais econômico para acompanhamento',
    features: [
      { name: '5 sessões de 50 minutos' },
      { name: 'Economia de 10%' },
      { name: 'Válido por 3 meses' },
    ],
    isPopular: true,
    priceId: PLAN_ID.PRO,
  },
  {
    name: 'Pacote 10 sessões',
    price: 'R$ 1.200',
    description: 'Para terapia contínua',
    features: [
      { name: '10 sessões de 50 minutos' },
      { name: 'Economia de 20%' },
      { name: 'Válido por 6 meses' },
    ],
    priceId: PLAN_ID.ENTERPRISE,
  },
];

interface PricingProps {
  title?: string;
  subtitle?: string;
}

export function Pricing({ title = "Planos e preços", subtitle = "Escolha a opção que melhor se adapta às suas necessidades" }: PricingProps) {
  return (
    <Section title={title} subtitle={subtitle}>
      <div className="grid gap-8 md:grid-cols-3">
        {pricingTiers.map((tier, index) => (
          <PricingInformation key={index} tier={tier} />
        ))}
      </div>
    </Section>
  );
}