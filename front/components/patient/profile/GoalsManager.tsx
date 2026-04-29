"use client";

import { useState, useEffect } from 'react';
import { PatientGoal, GoalType } from '@/types/patient';
import { api } from '@/lib/api';

interface GoalsManagerProps {
  patientId: number;
  initialGoals: PatientGoal[];
}

export function GoalsManager({ patientId, initialGoals }: GoalsManagerProps) {
  const [goals, setGoals] = useState<PatientGoal[]>(initialGoals);
  const [goalTypes, setGoalTypes] = useState<GoalType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedGoalType, setSelectedGoalType] = useState('');

  // Carregar tipos de objetivo
  useEffect(() => {
    loadGoalTypes();
  }, []);

  const loadGoalTypes = async () => {
    try {
      const types = await api('/api/patient/goals/types');
      setGoalTypes(types);
    } catch (err) {
      console.error('Erro ao carregar tipos de objetivo:', err);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalType) return;

    setLoading(true);
    setError(null);

    try {
      const newGoal = await api('/api/patient/goals', {
        method: 'POST',
        body: JSON.stringify({
          goal_type: selectedGoalType,
          is_active: true
        })
      });
      
      setGoals(prev => [...prev, newGoal]);
      setSelectedGoalType('');
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao adicionar objetivo');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (goal: PatientGoal) => {
    try {
      const updated = await api(`/api/patient/goals/${goal.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          is_active: !goal.is_active,
          completed_at: !goal.is_active ? new Date().toISOString() : null
        })
      });
      
      setGoals(prev => prev.map(g => g.id === goal.id ? updated : g));
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar objetivo');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja remover este objetivo?')) return;
    
    try {
      await api(`/api/patient/goals/${id}`, {
        method: 'DELETE'
      });
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (err: any) {
      setError(err.message || 'Erro ao remover objetivo');
    }
  };

  // Obter nome do tipo de objetivo (suporta string ou objeto)
  const getGoalTypeName = (goalType: string | { id: number; name: string; description?: string } | undefined) => {
    if (!goalType) return 'Objetivo';
    if (typeof goalType === 'string') return goalType;
    return goalType.name || 'Objetivo';
  };

  // Obter descrição do tipo de objetivo
  const getGoalTypeDescription = (goalType: string | { id: number; name: string; description?: string } | undefined) => {
    if (!goalType) return null;
    if (typeof goalType === 'string') {
      const found = goalTypes.find(gt => gt.name === goalType);
      return found?.description || null;
    }
    return goalType.description || null;
  };

  // Obter data de criação formatada
  const getCreatedDate = (goal: PatientGoal) => {
    return goal.selected_at || goal.created_at;
  };

  const activeGoals = goals.filter(g => g.is_active === true);
  const completedGoals = goals.filter(g => g.is_active === false);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Objetivos Terapêuticos</h3>
        {!showForm && goalTypes.length > 0 && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm"
          >
            + Novo Objetivo
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAddGoal} className="mb-6 p-4 bg-gray-50 rounded border">
          <h4 className="font-medium mb-3">Adicionar Objetivo</h4>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecione o tipo de objetivo
            </label>
            <select
              value={selectedGoalType}
              onChange={(e) => setSelectedGoalType(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-purple-500"
              required
            >
              <option value="">Escolha um objetivo</option>
              {goalTypes.map((type) => (
                <option key={type.id} value={type.name}>
                  {type.name} - {type.description}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setSelectedGoalType('');
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !selectedGoalType}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm disabled:opacity-50"
            >
              {loading ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      )}

      {/* Objetivos Ativos */}
      {activeGoals.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Em andamento</h4>
          <div className="space-y-2">
            {activeGoals.map((goal) => (
              <div
                key={goal.id}
                className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex justify-between items-center"
              >
                <div>
                  <p className="font-medium text-purple-900">
                    {getGoalTypeName(goal.goal_type)}
                  </p>
                  {getGoalTypeDescription(goal.goal_type) && (
                    <p className="text-xs text-purple-700">
                      {getGoalTypeDescription(goal.goal_type)}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Desde: {new Date(getCreatedDate(goal)).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(goal)}
                    className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                    title="Marcar como concluído"
                  >
                    ✅ Concluir
                  </button>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Objetivos Concluídos */}
      {completedGoals.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Concluídos</h4>
          <div className="space-y-2 opacity-75">
            {completedGoals.map((goal) => (
              <div
                key={goal.id}
                className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center"
              >
                <div>
                  <p className="font-medium text-gray-600 line-through">
                    {getGoalTypeName(goal.goal_type)}
                  </p>
                  {goal.completed_at && (
                    <p className="text-xs text-gray-500">
                      Concluído em: {new Date(goal.completed_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {goals.length === 0 && !showForm && (
        <p className="text-gray-500 text-center py-8">
          Nenhum objetivo terapêutico definido.
        </p>
      )}
    </div>
  );
}