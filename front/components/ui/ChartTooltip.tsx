"use client";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color?: string;
    payload?: any;
  }>;
  label?: string;
  formatter?: (value: number) => string;
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  
  const formatValue = (value: number): string => {
    if (formatter) return formatter(value);
    return String(value);
  };
  
  return (
    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-xs min-w-[120px]">
      <p className="font-semibold mb-1 border-b border-gray-700 pb-1">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex justify-between gap-4 mt-1">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || '#E03673' }}></span>
            <span>{entry.name}:</span>
          </span>
          <span className="font-medium">{formatValue(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}