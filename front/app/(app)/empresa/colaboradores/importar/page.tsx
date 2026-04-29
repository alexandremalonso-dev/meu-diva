"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Upload,
  Download,
  FileSpreadsheet,
  Users,
  X,
  Mail,
  UserPlus,
  Trash2,
  Calendar,
  Phone,
  Building2,
  Briefcase,
  FileText
} from "lucide-react";

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  rosaEscuro: "#c02c5e",
  verde: "#10B981",
  vermelho: "#EF4444",
  laranja: "#F59E0B",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  cinzaBorda: "#E5E7EB",
  branco: "#FFFFFF",
};

interface ColaboradorImport {
  nome: string;
  email: string;
  cpf: string;
  data_nascimento: string;
  telefone?: string;
  departamento?: string;
  cargo?: string;
}

export default function ImportarColaboradoresPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [preview, setPreview] = useState<ColaboradorImport[]>([]);
  const [invalidRows, setInvalidRows] = useState<{ row: number; errors: string[]; data: any }[]>([]);
  const [importResult, setImportResult] = useState<{
    total: number;
    success: number;
    failed: number;
    results: any[];
  } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setPreview([]);
    setInvalidRows([]);
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/empresa/colaboradores/importar/preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Erro ao processar arquivo");
      }

      const data = await response.json();
      setPreview(data.validos || []);
      setInvalidRows(data.invalidos || []);
      
      if (data.validos?.length === 0) {
        setError("Nenhum registro válido encontrado no arquivo. Verifique o formato e os campos obrigatórios.");
      } else {
        setSuccess(`${data.validos.length} registros válidos encontrados. Revise e confirme a importação.`);
      }
    } catch (err: any) {
      console.error("Erro ao processar arquivo:", err);
      setError(err.message || "Erro ao processar arquivo");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (preview.length === 0) {
      setError("Nenhum registro para importar");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      const result = await apiCall({
        url: "/api/empresa/colaboradores/importar",
        method: "POST",
        body: { colaboradores: preview },
        requireAuth: true
      });
      
      setImportResult(result);
      setSuccess(`Importação concluída! ${result.success} colaboradores criados, ${result.failed} falhas.`);
      
      if (result.success > 0) {
        setTimeout(() => {
          router.push("/empresa/colaboradores");
        }, 3000);
      }
    } catch (err: any) {
      console.error("Erro ao importar:", err);
      setError(err.message || "Erro ao importar colaboradores");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    // Cabeçalhos com os campos obrigatórios destacados
    const headers = ["nome*", "email*", "cpf*", "data_nascimento*", "telefone", "departamento", "cargo"];
    const example = [
      ["João Silva", "joao@empresa.com", "12345678900", "1990-01-15", "(11) 99999-8888", "TI", "Analista"],
      ["Maria Santos", "maria@empresa.com", "98765432100", "1985-05-20", "(11) 98888-7777", "RH", "Coordenadora"]
    ];
    
    const csvContent = [headers, ...example].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "modelo_importacao_colaboradores.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const removeFromPreview = (index: number) => {
    setPreview(prev => prev.filter((_, i) => i !== index));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Cabeçalho */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-[#E03673]" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Importar Colaboradores</h1>
              <p className="text-gray-500 mt-1">
                Carregue múltiplos colaboradores de uma vez usando um arquivo CSV
              </p>
            </div>
          </div>
          <Link href="/empresa/colaboradores" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Instruções */}
      <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">📋 Instruções</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Baixe o modelo de planilha clicando no botão abaixo</li>
          <li>• Preencha os dados seguindo o formato do exemplo</li>
          <li>• <strong className="text-red-600">Campos obrigatórios:</strong> nome, email, CPF e data de nascimento</li>
          <li>• CPF: informe apenas números (ex: 12345678900)</li>
          <li>• Data de nascimento: formato YYYY-MM-DD (ex: 1990-01-15)</li>
          <li>• Telefone: pode ser informado com ou sem formatação</li>
          <li>• O sistema enviará um e-mail com senha temporária para cada colaborador</li>
        </ul>
      </div>

      {/* Passo 1: Download do modelo */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-[#E03673]" />
          Passo 1: Baixe o modelo de planilha
        </h2>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Baixar modelo CSV
          </button>
        </div>
      </div>

      {/* Passo 2: Upload do arquivo */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-[#E03673]" />
          Passo 2: Envie o arquivo preenchido
        </h2>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#E03673] transition-colors">
          <input
            type="file"
            id="file-upload"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            disabled={loading}
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            <FileSpreadsheet className="w-12 h-12 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">
              {loading ? "Processando..." : "Clique para selecionar o arquivo CSV"}
            </span>
            <span className="text-xs text-gray-400">Apenas arquivos .csv até 10MB</span>
          </label>
        </div>
      </div>

      {/* Passo 3: Pré-visualização e validação */}
      {(preview.length > 0 || invalidRows.length > 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#E03673]" />
            Passo 3: Revise os dados
          </h2>
          
          {invalidRows.length > 0 && (
            <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm font-medium text-yellow-800 mb-2">⚠️ Linhas com erro (serão ignoradas):</p>
              {invalidRows.map((item, idx) => (
                <div key={idx} className="text-xs text-yellow-700 mb-1">
                  Linha {item.row + 2}: {item.errors.join(", ")}
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Nome</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">CPF</th>
                  <th className="p-2 text-left">Data Nasc.</th>
                  <th className="p-2 text-left">Telefone</th>
                  <th className="p-2 text-left">Departamento</th>
                  <th className="p-2 text-left">Cargo</th>
                  <th className="p-2 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.slice(0, 10).map((colab, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-2 font-medium">{colab.nome}</td>
                    <td className="p-2 text-gray-600">{colab.email}</td>
                    <td className="p-2 font-mono text-xs">{colab.cpf || "-"}</td>
                    <td className="p-2">{formatDate(colab.data_nascimento)}</td>
                    <td className="p-2">{colab.telefone || "-"}</td>
                    <td className="p-2">{colab.departamento || "-"}</td>
                    <td className="p-2">{colab.cargo || "-"}</td>
                    <td className="p-2 text-center">
                      <button onClick={() => removeFromPreview(idx)} className="text-red-500 hover:text-red-700">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 10 && (
              <p className="text-xs text-gray-400 mt-2">+ {preview.length - 10} outros registros</p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => {
                setPreview([]);
                setInvalidRows([]);
                setImportResult(null);
              }}
              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Limpar
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={loading || preview.length === 0}
              className="px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Confirmar importação ({preview.length} colaboradores)
            </button>
          </div>
        </div>
      )}

      {/* Resultado da importação */}
      {importResult && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Resultado da Importação
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-800">{importResult.total}</p>
              <p className="text-xs text-gray-500">Total processado</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{importResult.success}</p>
              <p className="text-xs text-gray-500">Importados com sucesso</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
              <p className="text-xs text-gray-500">Falhas</p>
            </div>
          </div>
          
          {importResult.results.filter(r => !r.success).length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 mb-2">Erros encontrados:</p>
              {importResult.results.filter(r => !r.success).map((r, idx) => (
                <div key={idx} className="text-xs text-yellow-700">
                  {r.email}: {r.error}
                </div>
              ))}
            </div>
          )}
          
          <div className="flex justify-end mt-4">
            <Link
              href="/empresa/colaboradores"
              className="px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors"
            >
              Ir para lista de colaboradores
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}