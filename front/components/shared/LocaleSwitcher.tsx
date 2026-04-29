'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Se não estiver usando internacionalização, este componente pode ser removido
// ou simplificado para apenas mostrar o idioma atual
export const LocaleSwitcher = () => {
  const pathname = usePathname();
  const router = useRouter();

  // Se não estiver usando i18n, retorne null ou um placeholder
  return null;

  // Ou se quiser manter a funcionalidade básica:
  // const handleChange = (value: string) => {
  //   // Redirecionar sem a opção locale
  //   router.push(pathname);
  //   router.refresh();
  // };
};