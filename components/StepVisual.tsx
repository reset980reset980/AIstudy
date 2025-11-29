import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DiagramType, SolutionStep } from '../types';

interface StepVisualProps {
  visualData: SolutionStep['visualData'];
}

const StepVisual: React.FC<StepVisualProps> = ({ visualData }) => {
  if (!visualData || visualData.type === DiagramType.NONE) {
    return null;
  }

  // Handle Geometry/SVG type
  if ((visualData.type === DiagramType.GEOMETRY || visualData.svgCode) && visualData.svgCode) {
    return (
        <div className="w-full aspect-square max-h-64 bg-slate-50 rounded-lg p-4 border border-slate-100 flex items-center justify-center my-4">
             <div 
                className="w-full h-full [&>svg]:w-full [&>svg]:h-full object-contain"
                dangerouslySetInnerHTML={{ __html: visualData.svgCode }} 
             />
        </div>
    );
  }

  // Handle Bar Chart
  if (visualData.type === DiagramType.BAR && visualData.data) {
    return (
      <div className="h-32 w-full mt-4 bg-white rounded-lg p-2 border border-slate-100">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={visualData.data} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={80} tick={{fontSize: 12}} />
            <Tooltip cursor={{fill: 'transparent'}} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {visualData.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#60a5fa' : '#34d399'} />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
};

export default StepVisual;