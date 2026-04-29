"use client";

import type { Stats, FilterType } from '../../types';

interface StatsCardsProps {
  stats: Stats;
  activeFilter: FilterType;
  onFilterClick: (filter: FilterType) => void;
}

export function StatsCards({ stats, activeFilter, onFilterClick }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div 
        onClick={() => onFilterClick("upcoming")}
        className={`bg-white p-6 rounded-lg shadow cursor-pointer transition-all hover:shadow-lg ${
          activeFilter === "upcoming" ? "ring-2 ring-blue-500 bg-blue-50" : ""
        }`}
      >
        <p className="text-sm text-gray-500">Próximas sessões</p>
        <p className="text-2xl font-bold text-blue-600">{stats.upcoming}</p>
        <p className="text-xs text-gray-400 mt-1">Clique para filtrar</p>
      </div>
      
      <div 
        onClick={() => onFilterClick("completed")}
        className={`bg-white p-6 rounded-lg shadow cursor-pointer transition-all hover:shadow-lg ${
          activeFilter === "completed" ? "ring-2 ring-green-500 bg-green-50" : ""
        }`}
      >
        <p className="text-sm text-gray-500">Realizadas</p>
        <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        <p className="text-xs text-gray-400 mt-1">Clique para filtrar</p>
      </div>
      
      <div 
        onClick={() => onFilterClick("cancelled")}
        className={`bg-white p-6 rounded-lg shadow cursor-pointer transition-all hover:shadow-lg ${
          activeFilter === "cancelled" ? "ring-2 ring-red-500 bg-red-50" : ""
        }`}
      >
        <p className="text-sm text-gray-500">Canceladas</p>
        <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
        <p className="text-xs text-gray-400 mt-1">Clique para filtrar</p>
      </div>
      
      <div 
        onClick={() => onFilterClick("all")}
        className={`bg-white p-6 rounded-lg shadow cursor-pointer transition-all hover:shadow-lg ${
          activeFilter === "all" ? "ring-2 ring-gray-500 bg-gray-50" : ""
        }`}
      >
        <p className="text-sm text-gray-500">Total de sessões</p>
        <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        <p className="text-xs text-gray-400 mt-1">Clique para ver todas</p>
      </div>
    </div>
  );
}