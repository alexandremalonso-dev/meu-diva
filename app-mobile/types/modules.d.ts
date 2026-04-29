// Declarações de módulos para resolver TS2307
declare module '@/components/meet/MeetButton' {
  export const MeetButton: React.FC<{
    appointmentId: number;
    meetLink?: string | null;
    onMeetLinkGenerated?: (link: string) => void;
    variant?: 'primary' | 'secondary' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
  }>;
}

declare module '@/components/ui/PhoneInput' {
  export const PhoneInput: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    required?: boolean;
  }>;
}

declare module '@/features/landing/CTABanner' {
  export const CTABanner: React.FC<any>;
}

declare module '@/features/landing/Section' {
  export const Section: React.FC<any>;
}

declare module '@/features/landing/StickyBanner' {
  export const StickyBanner: React.FC<any>;
}

declare module '@/features/landing/CenteredFooter' {
  export const CenteredFooter: React.FC<any>;
  export const FooterIcon: React.FC<any>;
}

declare module '@/features/billing/PricingInformation' {
  export const PricingInformation: React.FC<any>;
}

declare module '@/features/sponsors/SponsorLogos' {
  export const SponsorLogos: React.FC<any>;
}