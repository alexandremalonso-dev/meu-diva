"use client";
// asaas-valor-terapeuta: o endereço antigo (/admin/pricing) passou a ser /admin/valor-terapeuta. Mantido só para favoritos e links antigos.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPricingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/valor-terapeuta");
  }, [router]);
  return null;
}
