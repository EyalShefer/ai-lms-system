import React, { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    Controls,
    Background,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    Handle,
    Position,
} from 'reactflow';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from 'reactflow';
import 'reactflow/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import type { MindMapContent, MindMapNode, MindMapEdge } from '../shared/types/courseTypes';
import { IconPlus, IconTrash, IconPalette, IconCheck, IconX } from '@tabler/icons-react';

interface MindMapEditorProps {
    content: MindMapContent;
    onChange: (content: MindMapContent) => void;
    onSave?: () => void;
}

const NODE_COLORS = [
    { name: 'כחול', value: '#3B82F6' },
    { name: 'ירוק', value: '#10B981' },
    { name: 'כתום', value: '#F59E0B' },
    { name: 'אדום', value: '#EF4444' },
    { name: 'סגול', value: '#8B5CF6' },
    { name: 'ורוד', value: '#EC4899' },
    { name: 'ציאן', value: '#06B6D4' },
    { name: 'אפור', value: '#6B7280' },
];

// Editable Custom Node with connection handles
const EditableNode = ({ data, id, selected }: { data: any; id: string; selected: boolean }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [label, setLabel] = useState(data.label);

    const bgColor = data.color || '#fff';
    const isLightBg = bgColor.toLowerCase() === '#fff' || bgColor.toLowerCase() === '#ffffff' ||
        (bgColor.startsWith('#') && parseInt(bgColor.slice(1, 3), 16) > 180);
    const textColor = isLightBg ? '#1f2937' : '#ffffff';

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (data.onLabelChange && label !== data.label) {
            data.onLabelChange(id, label);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur();
        }
        if (e.key === 'Escape') {
            setLabel(data.label);
            setIsEditing(false);
        }
    };

    return (
        <div
            className={`px-4 py-2 rounded-xl shadow-md border-2 min-w-[100px] text-center cursor-pointer transition-all ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                }`}
            style={{
                backgroundColor: bgColor,
                borderColor: selected ? '#3B82F6' : `${bgColor}80`,
                direction: 'rtl'
            }}
            onDoubleClick={handleDoubleClick}
        >
            {/* Connection handles */}
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-blue-400" />
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-blue-400" />
            <Handle type="target" position={Position.Right} className="w-3 h-3 !bg-blue-400" />
            <Handle type="source" position={Position.Left} className="w-3 h-3 !bg-blue-400" />

            {isEditing ? (
                <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent border-none outline-none text-center font-bold text-sm"
                    style={{ color: textColor }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <div className="font-bold text-sm" style={{ color: textColor }}>{data.label}</div>
            )}
        </div>
    );
};

const nodeTypes = {
    default: EditableNode,
    topic: EditableNode,
    subtopic: EditableNode,
    detail: EditableNode,
    example: EditableNode
};

// MiniMap node color function
const nodeColor = (node: Node) => {
    return node.data?.color || '#94a3b8';
};

const MindMapEditorInner: React.FC<MindMapEditorProps> = ({ content, onChange, onSave }) => {
    const [nodes, setNodes] = useNodesState(content.nodes as Node[]);
    const [edges, setEdges] = useEdgesState(content.edges as Edge[]);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const onNodesChange = useCallback((changes: NodeChange[]) => {
        setNodes((nds) => applyNodeChanges(changes, nds));
    }, [setNodes]);

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        setEdges((eds) => applyEdgeChanges(changes, eds));
    }, [setEdges]);

    const onConnect = useCallback((params: Connection) => {
        setEdges((eds) => addEdge({
            ...params,
            id: `e-${uuidv4()}`,
            style: { stroke: '#94a3b8', strokeWidth: 2 }
        }, eds));
    }, [setEdges]);

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNode(node.id);
        setShowColorPicker(false);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
        setShowColorPicker(false);
    }, []);

    const handleAddNode = () => {
        // Find center position or offset from selected node
        let newX = 400;
        let newY = 300;

        if (selectedNode) {
            const selected = nodes.find(n => n.id === selectedNode);
            if (selected) {
                newX = selected.position.x - 150;
                newY = selected.position.y + 100;
            }
        }

        const newNode: Node = {
            id: uuidv4(),
            type: 'subtopic',
            data: { label: 'צומת חדש', color: '#10B981' },
            position: { x: newX, y: newY },
        };
        setNodes((nds) => [...nds, newNode]);

        // If a node was selected, connect the new node to it
        if (selectedNode) {
            setEdges((eds) => [...eds, {
                id: `e-${uuidv4()}`,
                source: selectedNode,
                target: newNode.id,
                style: { stroke: '#94a3b8', strokeWidth: 2 }
            }]);
        }

        setSelectedNode(newNode.id);
    };

    const handleDeleteSelected = () => {
        if (!selectedNode) return;

        // Don't delete the root node (first node)
        if (nodes.length > 0 && nodes[0].id === selectedNode) {
            alert('לא ניתן למחוק את הצומת הראשי');
            return;
        }

        setNodes((nds) => nds.filter((n) => n.id !== selectedNode));
        setEdges((eds) => eds.filter((e) => e.source !== selectedNode && e.target !== selectedNode));
        setSelectedNode(null);
    };

    const handleColorChange = (color: string) => {
        if (!selectedNode) return;
        setNodes((nds) =>
            nds.map((n) => (n.id === selectedNode ? { ...n, data: { ...n.data, color } } : n))
        );
        setShowColorPicker(false);
    };

    const handleLabelChange = useCallback((nodeId: string, newLabel: string) => {
        setNodes((nds) =>
            nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n))
        );
    }, [setNodes]);

    // Inject onLabelChange into node data
    const nodesWithHandlers = useMemo(() => {
        return nodes.map((n) => ({
            ...n,
            data: { ...n.data, onLabelChange: handleLabelChange },
        }));
    }, [nodes, handleLabelChange]);

    // Style edges
    const styledEdges = useMemo(() => {
        return edges.map(edge => ({
            ...edge,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
        }));
    }, [edges]);

    const handleSave = () => {
        const updatedContent: MindMapContent = {
            ...content,
            nodes: nodes as MindMapNode[],
            edges: edges as MindMapEdge[],
        };
        onChange(updatedContent);
        onSave?.();
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" dir="rtl">
            <div className="h-[500px] relative">
                <ReactFlow
                    nodes={nodesWithHandlers}
                    edges={styledEdges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    proOptions={{ hideAttribution: true }}
                    snapToGrid
                    snapGrid={[15, 15]}
                >
                    <Controls position="bottom-left" />
                    <MiniMap
                        nodeColor={nodeColor}
                        maskColor="rgba(240, 240, 240, 0.8)"
                        position="bottom-right"
                        pannable
                        zoomable
                    />
                    <Background color="#e0e7ff" gap={16} />

                    {/* Toolbar Panel */}
                    <Panel position="top-right" className="flex gap-2 bg-white/95 p-3 rounded-xl shadow-lg border border-gray-200">
                        <button
                            onClick={handleAddNode}
                            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                            title="הוסף צומת"
                        >
                            <IconPlus className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleDeleteSelected}
                            disabled={!selectedNode}
                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                            title="מחק צומת נבחר"
                        >
                            <IconTrash className="w-5 h-5" />
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setShowColorPicker(!showColorPicker)}
                                disabled={!selectedNode}
                                className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                title="שנה צבע"
                            >
                                <IconPalette className="w-5 h-5" />
                            </button>
                            {showColorPicker && selectedNode && (
                                <div className="absolute top-full left-0 mt-2 p-2 bg-white rounded-xl shadow-xl border border-gray-200 flex flex-wrap gap-1 z-50 w-[140px]">
                                    {NODE_COLORS.map((c) => (
                                        <button
                                            key={c.value}
                                            onClick={() => handleColorChange(c.value)}
                                            className="w-7 h-7 rounded-full border-2 border-white shadow-md hover:scale-110 transition-transform"
                                            style={{ backgroundColor: c.value }}
                                            title={c.name}
                                        />
                                    ))}
                                    <button
                                        onClick={() => setShowColorPicker(false)}
                                        className="w-full mt-1 p-1 text-xs text-gray-500 hover:text-gray-700"
                                    >
                                        <IconX className="w-4 h-4 mx-auto" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="w-px bg-gray-300 mx-1" />
                        <button
                            onClick={handleSave}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 px-3"
                        >
                            <IconCheck className="w-5 h-5" />
                            <span className="text-sm font-medium">שמור</span>
                        </button>
                    </Panel>
                </ReactFlow>
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 text-center">
                לחץ פעמיים על צומת לעריכת טקסט | גרור צמתים כדי לסדר | חבר בין צמתים על ידי גרירה מנקודת החיבור
            </div>
        </div>
    );
};

// Wrap with ReactFlowProvider
export const MindMapEditor: React.FC<MindMapEditorProps> = (props) => {
    return (
        <ReactFlowProvider>
            <MindMapEditorInner {...props} />
        </ReactFlowProvider>
    );
};

export default MindMapEditor;
