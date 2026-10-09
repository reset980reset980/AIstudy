import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { VisualData } from '../types';
import SafeSvg from './SafeSvg';

const StepVisual: React.FC<{ visualData?: VisualData | null }> = ({ visualData }) => {
  if (!visualData || visualData.type === 'NONE') return null;

  if (visualData.svgCode && visualData.svgCode.includes('<svg')) {
    return (
      // 다크 모드에서도 그림 선이 보이도록 흰 배경 유지
      <div className="w-full aspect-square max-h-64 bg-white rounded-lg p-3 border border-slate-200 dark:border-slate-600 flex items-center justify-center my-4">
        <SafeSvg svg={visualData.svgCode} />
      </div>
    );
  }

  if (visualData.type === 'BAR' && visualData.data && visualData.data.length > 0) {
    return (
      <div className="h-36 w-full mt-4 bg-white dark:bg-slate-800 rounded-lg p-2 border border-slate-100 dark:border-slate-700">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={visualData.data} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12, fill: '#64748b' }} />
            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {visualData.data.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#60a5fa' : '#34d399'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return null;
};

export default StepVisual;
