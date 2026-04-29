"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Section } from "@/features/landing/Section";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  title?: string;
  subtitle?: string;
  questions?: FAQItem[];
}

const defaultQuestions: FAQItem[] = [
  {
    question: "Como funciona o atendimento?",
    answer: "Você escolhe um terapeuta, agenda um horário disponível e realiza a sessão por videochamada diretamente na plataforma. É simples, seguro e você pode fazer de onde estiver."
  },
  {
    question: "Preciso ter saldo para agendar?",
    answer: "Sim, você precisa ter créditos na carteira para agendar uma sessão. Pode comprar créditos com cartão de crédito na área 'Carteira' do seu perfil."
  },
  {
    question: "Posso cancelar uma sessão?",
    answer: "Sim, com até 24h de antecedência. Cancelamentos após esse prazo não serão reembolsados. O estorno cai automaticamente na sua carteira."
  },
  {
    question: "Os terapeutas são qualificados?",
    answer: "Todos os profissionais passam por um processo de verificação de diplomas e registros profissionais. Você pode ver as credenciais no perfil de cada terapeuta."
  },
  {
    question: "Como funciona o pacote de sessões?",
    answer: "Você pode comprar pacotes de 5 ou 10 sessões com desconto. Os créditos ficam na sua carteira e você agenda as sessões conforme sua disponibilidade."
  }
];

export function FAQ({ 
  title = "Dúvidas frequentes", 
  subtitle = "Tire suas dúvidas sobre o Meu Divã",
  questions = defaultQuestions 
}: FAQProps) {
  return (
    <Section title={title} subtitle={subtitle}>
      <div className="max-w-3xl mx-auto">
        <Accordion type="single" collapsible className="w-full">
          {questions.map((item, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}