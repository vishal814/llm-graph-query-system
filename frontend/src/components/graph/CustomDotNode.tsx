import { Handle, Position } from '@xyflow/react';
import { LABEL_COLORS } from '@/lib/constants';

export const CustomDotNode = ({ data, selected }: any) => {
    const neo4j = data.neo4j;
    const label: string = neo4j?.labels?.[0] || '';
    const colors = LABEL_COLORS[label];
    const isHub = data.isHub;
    const isHighlighted = data.highlighted;
    const size = isHub ? 'w-[12px] h-[12px]' : 'w-[7px] h-[7px]';

    return (
        <div className={`flex flex-col items-center transition-transform ${selected ? 'scale-[1.5]' : ''}`}>
            <Handle type="target" position={Position.Top} className="opacity-0" />
            <div
                className={`${size} rounded-full transition-all duration-300`}
                style={{
                    background: colors?.dot || '#94a3b8',
                    border: `1.5px solid ${colors?.border || '#64748b'}`,
                    boxShadow: isHighlighted
                        ? `0 0 0 4px ${colors?.dot || '#94a3b8'}55, 0 0 12px ${colors?.dot || '#94a3b8'}`
                        : selected
                            ? `0 0 0 3px ${colors?.dot || '#94a3b8'}44`
                            : undefined,
                }}
            />
            {(selected || isHighlighted) && (
                <div className="text-[7px] mt-0.5 font-semibold whitespace-nowrap text-slate-600 bg-white/90 px-0.5 rounded">
                    {neo4j?.properties?.id || label}
                </div>
            )}
            <Handle type="source" position={Position.Bottom} className="opacity-0" />
        </div>
    );
};
