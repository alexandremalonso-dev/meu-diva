"use client";

export function TesteNome({ nome }: { nome: string }) {
  console.log("🔴 TesteNome recebeu:", nome);
  console.log("🔴 Tipo do nome:", typeof nome);
  console.log("🔴 Comprimento do nome:", nome?.length);
  
  return (
    <div style={{ 
      backgroundColor: 'red', 
      padding: '20px', 
      margin: '20px 0',
      color: 'white',
      fontSize: '24px',
      fontWeight: 'bold',
      textAlign: 'center',
      borderRadius: '8px'
    }}>
      🔴 TESTE - O nome é: "{nome || "VAZIO"}"
    </div>
  );
}