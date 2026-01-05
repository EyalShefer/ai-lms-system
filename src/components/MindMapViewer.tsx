import React, { useMemo } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import type { MindMapContent } from '../shared/types/courseTypes';

interface MindMapViewerProps {
    content: MindMapContent;
    title?: string;
    className?: string;
}

// Custom Node Component for Hebrew RTL support
const CustomNode = ({ data }: { data: { label: string; color?: string; description?: string } }) => {
    const bgColor = data.color || '#fff';
    // Calculate text color based on background brightness
    const isLightBg = bgColor.toLowerCase() === '#fff' || bgColor.toLowerCase() === '#ffffff' ||
        (bgColor.startsWith('#') && parseInt(bgColor.slice(1, 3), 16) > 180);
    const textColor = isLightBg ? '#1f2937' : '#ffffff';

    return (
        <div
            className="px-4 py-2 rounded-xl shadow-md border-2 min-w-[100px] text-center transition-transform hover:scale-105"
            style={{
                backgroundColor: bgColor,
                borderColor: `${bgColor}80`,
                direction: 'rtl'
            }}
        >
            <div className="font-bold text-sm" style={{ color: textColor }}>{data.label}</div>
            {data.description && (
                <div className="text-xs mt-1 opacity-80" style={{ color: textColor }}>{data.description}</div>
            )}
        </div>
    );
};

const nodeTypes = {
    default: CustomNode,
    topic: CustomNode,
    subtopic: CustomNode,
    detail: CustomNode,
    example: CustomNode
};

// MiniMap node color function
const nodeColor = (node: Node) => {
    return node.data?.color || '#94a3b8';
};

const MindMapViewerInner: React.FC<MindMapViewerProps> = ({ content, title, className }) => {
    const [nodes] = useNodesState(content.nodes as Node[]);
    const [edges] = useEdgesState(content.edges as Edge[]);

    const defaultViewport = content.viewport || { x: 0, y: 0, zoom: 0.8 };

    // Style edges for better visibility
    const styledEdges = useMemo(() => {
        return edges.map(edge => ({
            ...edge,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
            animated: false,
        }));
    }, [edges]);

    return (
        <div className={`bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl border border-gray-200 overflow-hidden ${className || ''}`} dir="rtl">
            {title && (
                <div className="p-4 bg-white/80 border-b border-gray-200">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <span className="text-2xl">🗺️</span>
                        {title}
                    </h3>
                </div>
            )}
            <div className="h-[400px]">
                <ReactFlow
                    nodes={nodes}
                    edges={styledEdges}
                    nodeTypes={nodeTypes}
                    defaultViewport={defaultViewport}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    panOnDrag={true}
                    zoomOnScroll={true}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    proOptions={{ hideAttribution: true }}
                >
                    <Controls showInteractive={false} position="bottom-left" />
                    <MiniMap
                        nodeColor={nodeColor}
                        maskColor="rgba(240, 240, 240, 0.8)"
                        position="bottom-right"
                        pannable
                        zoomable
                    />
                    <Background color="#e0e7ff" gap={16} />
                </ReactFlow>
            </div>
        </div>
    );
};

// Wrap with ReactFlowProvider
export const MindMapViewer: React.FC<MindMapViewerProps> = (props) => {
    return (
        <ReactFlowProvider>
            <MindMapViewerInner {...props} />
        </ReactFlowProvider>
    );
};

export default MindMapViewer;
