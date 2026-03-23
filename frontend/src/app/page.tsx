"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ReactFlow, Background, Controls, Node, Edge, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import * as d3 from 'd3-force';

// Extracted Components & Constants
import { LABEL_COLORS, CLUSTER_CENTERS, HUB_LABELS } from '@/lib/constants';
import { CustomDotNode } from '@/components/graph/CustomDotNode';
import { TopNav } from '@/components/layout/TopNav';
import { ChatPanel } from '@/components/chat/ChatPanel';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function App() {
    return <ReactFlowProvider><Home /></ReactFlowProvider>;
}

function Home() {
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: "Hi! I can help you analyze the **Order to Cash** process." }
    ]);
    const [input, setInput] = useState('');
    const [allNodes, setAllNodes] = useState<Node[]>([]);
    const [allEdges, setAllEdges] = useState<Edge[]>([]);
    const [loading, setLoading] = useState(false);
    const [cypher, setCypher] = useState('');
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [showCypher, setShowCypher] = useState(false);
    const [showLegend, setShowLegend] = useState(false);
    const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
    const [streamingMsg, setStreamingMsg] = useState('');
    const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
    const [clusterMode, setClusterMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { fitView } = useReactFlow();
    
    const nodeTypes = useMemo(() => ({ customDot: CustomDotNode }), []);

    // Visible nodes/edges after filter, with highlight data merged in
    const nodes = useMemo(() => allNodes
        .filter(n => !hiddenTypes.has((n.data?.neo4j as any)?.labels?.[0]))
        .map(n => ({ ...n, data: { ...n.data, highlighted: highlightIds.has(n.id) } })),
        [allNodes, hiddenTypes, highlightIds]);

    const edges = useMemo(() => {
        const visibleIds = new Set(nodes.map(n => n.id));
        return allEdges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
    }, [allEdges, nodes]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, streamingMsg]);

    // Semantic search with debounce
    useEffect(() => {
        if (!searchQuery.trim()) { setSearchResults([]); return; }
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(searchQuery)}`);
                const data = await res.json();
                setSearchResults(data.results || []);
            } catch { setSearchResults([]); }
            finally { setSearchLoading(false); }
        }, 350);
    }, [searchQuery]);

    const applyForceLayout = useCallback((newNodes: Node[], newEdges: Edge[], cluster: boolean) => {
        const simNodes = newNodes.map(n => ({
            ...n,
            x: n.position.x,
            y: n.position.y,
            label: (n.data?.neo4j as any)?.labels?.[0] || '',
        }));
        const simEdges = newEdges.map(e => ({ source: e.source, target: e.target }));

        const sim = d3.forceSimulation(simNodes as any)
            .force('link', d3.forceLink(simEdges).id((d: any) => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(cluster ? -300 : -600))
            .force('center', d3.forceCenter(0, 0))
            .force('collision', d3.forceCollide().radius(16));

        if (cluster) {
            sim.force('clusterX', d3.forceX((d: any) => CLUSTER_CENTERS[d.label]?.x ?? 0).strength(0.25));
            sim.force('clusterY', d3.forceY((d: any) => CLUSTER_CENTERS[d.label]?.y ?? 0).strength(0.25));
        }

        sim.stop();
        for (let i = 0; i < 300; i++) sim.tick();

        const laidOut = simNodes.map((n: any) => ({
            ...newNodes.find(orig => orig.id === n.id)!,
            position: { x: n.x, y: n.y }
        }));
        setAllNodes(laidOut);
        setAllEdges(newEdges);
        setTimeout(() => fitView({ padding: 0.15, duration: 800 }), 100);
    }, [fitView]);

    const parseGraphData = useCallback((neo4jData: any[], merge = false) => {
        const nMap = new Map<string, any>();
        const eMap = new Map<string, any>();
        if (merge) {
            allNodes.forEach(n => { if (n.data?.neo4j) nMap.set(n.id, n.data.neo4j); });
            allEdges.forEach(e => { eMap.set(e.id, { id: e.id, source: e.source, target: e.target, label: (e as any).data?.relType }); });
        }
        neo4jData.forEach((row) => {
            const rowNodes: any[] = [];
            let hasExplicitEdges = false;
            const extract = (obj: any) => {
                if (!obj) return;
                if (obj.labels && obj.properties && obj.elementId) { if (!nMap.has(obj.elementId)) nMap.set(obj.elementId, obj); rowNodes.push(obj); }
                else if (obj.type && obj.startNodeElementId && obj.endNodeElementId && obj.elementId) {
                    hasExplicitEdges = true;
                    if (!eMap.has(obj.elementId)) eMap.set(obj.elementId, { id: obj.elementId, source: obj.startNodeElementId, target: obj.endNodeElementId, label: obj.type });
                }
                else if (obj.segments && Array.isArray(obj.segments)) { hasExplicitEdges = true; obj.segments.forEach((s: any) => { extract(s.start); extract(s.relationship); extract(s.end); }); }
                else if (typeof obj === 'object') Object.values(obj).forEach(extract);
            };
            extract(row);
            if (!hasExplicitEdges && rowNodes.length > 1) {
                for (let i = 0; i < rowNodes.length - 1; i++) {
                    const src = rowNodes[i].elementId, tgt = rowNodes[i + 1].elementId;
                    const eid = `h-${src}-${tgt}`;
                    if (!eMap.has(eid) && src !== tgt) eMap.set(eid, { id: eid, source: src, target: tgt });
                }
            }
        });
        const newNodes: Node[] = Array.from(nMap.values()).map((n: any) => ({
            id: n.elementId, position: { x: Math.random() * 400, y: Math.random() * 400 },
            data: { neo4j: n, isHub: HUB_LABELS.has(n.labels?.[0]) }, type: 'customDot',
        }));
        const newEdges: Edge[] = Array.from(eMap.values()).map((e: any) => ({
            id: e.id, source: e.source, target: e.target, data: { relType: e.label },
            style: { stroke: '#a8d4f0', strokeWidth: 1, opacity: 0.45 }, type: 'straight'
        }));
        applyForceLayout(newNodes, newEdges, clusterMode);
    }, [allNodes, allEdges, clusterMode, applyForceLayout]);

    const expandNode = async (nodeId: string) => {
        try {
            const res = await fetch(`${API_URL}/api/expand`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodeId })
            });
            const data = await res.json();
            if (data.graphData?.length > 0) parseGraphData(data.graphData, true);
        } catch (e) { console.error('Expand failed:', e); }
    };

    const toggleCluster = () => {
        const next = !clusterMode;
        setClusterMode(next);
        if (allNodes.length > 0) {
            const simNodes = allNodes.map(n => ({ ...n, x: n.position.x, y: n.position.y, label: (n.data?.neo4j as any)?.labels?.[0] || '' }));
            const simEdges = allEdges.map(e => ({ source: e.source, target: e.target }));
            const sim = d3.forceSimulation(simNodes as any)
                .force('link', d3.forceLink(simEdges).id((d: any) => d.id).distance(100))
                .force('charge', d3.forceManyBody().strength(next ? -300 : -600))
                .force('center', d3.forceCenter(0, 0))
                .force('collision', d3.forceCollide().radius(16));
            if (next) {
                sim.force('clusterX', d3.forceX((d: any) => CLUSTER_CENTERS[d.label]?.x ?? 0).strength(0.25));
                sim.force('clusterY', d3.forceY((d: any) => CLUSTER_CENTERS[d.label]?.y ?? 0).strength(0.25));
            }
            sim.stop();
            for (let i = 0; i < 300; i++) sim.tick();
            setAllNodes(simNodes.map((n: any) => ({
                ...allNodes.find(orig => orig.id === n.id)!, position: { x: n.x, y: n.y }
            })));
            setTimeout(() => fitView({ padding: 0.15, duration: 800 }), 100);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);
        setStreamingMsg('');
        setSelectedNode(null);
        setHighlightIds(new Set());
        const history = messages.slice(1).map(m => ({ role: m.role, content: m.content }));

        try {
            const resp = await fetch(`${API_URL}/api/chat/stream`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg, history })
            });
            if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '', accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.cypher) setCypher(data.cypher);
                        if (data.graphData) parseGraphData(data.graphData);
                        if (data.highlightIds) setHighlightIds(new Set(data.highlightIds));
                        if (data.token) { accumulated += data.token; setStreamingMsg(accumulated); }
                    } catch { /* skip malformed */ }
                }
            }

            const finalMsg = accumulated.trim() || "Done!";
            setMessages(prev => [...prev, { role: 'assistant', content: finalMsg }]);
            setStreamingMsg('');
        } catch (streamErr: any) {
            console.warn('Stream failed, using fallback:', streamErr.message);
            try {
                const res = await fetch(`${API_URL}/api/chat`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: userMsg, history })
                });
                const data = await res.json();
                setMessages(prev => [...prev, { role: 'assistant', content: data.answer || data.error || 'No response.' }]);
                if (data.cypher) setCypher(data.cypher);
                if (data.graphData) parseGraphData(data.graphData);
                if (data.highlightIds) setHighlightIds(new Set(data.highlightIds));
            } catch (e: any) {
                setMessages(prev => [...prev, { role: 'assistant', content: "Error: Could not reach backend server." }]);
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleType = (label: string) => setHiddenTypes(prev => {
        const next = new Set(prev);
        next.has(label) ? next.delete(label) : next.add(label);
        return next;
    });

    const activeTypes = useMemo(() => {
        const types = new Set<string>();
        allNodes.forEach(n => { const l = (n.data?.neo4j as any)?.labels?.[0]; if (l) types.add(l); });
        return Array.from(types);
    }, [allNodes]);

    const handleSearchResultClick = (result: any) => {
        setHighlightIds(new Set([result.elementId]));
        setSelectedNode({ ...result, labels: [result.label], properties: result.properties });
        setSearchQuery('');
        setSearchResults([]);
    };

    return (
        <div className="flex flex-col h-screen w-full bg-[#fafbfc] text-slate-900 overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <TopNav 
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchLoading={searchLoading}
                searchResults={searchResults}
                handleSearchResultClick={handleSearchResultClick}
            />

            <div className="flex flex-1 overflow-hidden">
                {/* ── LEFT: Graph Canvas ── */}
                <div className="flex-1 h-full relative overflow-hidden">
                    <div className="absolute top-3 left-3 z-20 flex items-center gap-2 flex-wrap">
                        <button onClick={() => setShowCypher(!showCypher)}
                            className="bg-white border border-slate-200 text-xs px-3 py-1.5 rounded-md shadow-sm flex items-center gap-1.5 font-medium text-slate-600 hover:bg-slate-50 transition">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                            Cypher
                        </button>
                        <button onClick={() => setShowLegend(!showLegend)}
                            className={`border text-xs px-3 py-1.5 rounded-md shadow-sm flex items-center gap-1.5 font-medium transition ${showLegend ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                            Legend
                        </button>
                        <button onClick={toggleCluster}
                            className={`border text-xs px-3 py-1.5 rounded-md shadow-sm flex items-center gap-1.5 font-medium transition ${clusterMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M12 8v5m-3.5 3.5L12 13l3.5 3.5"/></svg>
                            {clusterMode ? 'Clustered' : 'Cluster'}
                        </button>
                        {allNodes.length > 0 && (
                            <span className="text-[10px] text-slate-400 font-medium">
                                {nodes.length}/{allNodes.length} nodes · {edges.length} edges
                                {highlightIds.size > 0 && ` · ${highlightIds.size} highlighted`}
                            </span>
                        )}
                    </div>

                    {showCypher && cypher && (
                        <div className="absolute top-12 left-3 z-20 bg-slate-900 text-green-400 font-mono text-[11px] rounded-lg p-3 shadow-xl max-w-[500px] max-h-[110px] overflow-auto border border-slate-700">
                            {cypher}
                        </div>
                    )}

                    {showLegend && activeTypes.length > 0 && (
                        <div className="absolute z-20 bg-white rounded-xl border border-slate-200 shadow-xl p-4 min-w-[200px]"
                            style={{ top: showCypher && cypher ? '130px' : '48px', left: '12px' }}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Node Types · click to hide</div>
                            <div className="space-y-1">
                                {activeTypes.map(label => {
                                    const colors = LABEL_COLORS[label];
                                    const hidden = hiddenTypes.has(label);
                                    return (
                                        <button key={label} onClick={() => toggleType(label)}
                                            className={`flex items-center gap-2 w-full text-left rounded px-2 py-1 transition ${hidden ? 'opacity-35' : 'hover:bg-slate-50'}`}>
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colors?.dot || '#94a3b8', border: `1.5px solid ${colors?.border || '#64748b'}` }} />
                                            <span className="text-xs text-slate-700">{label}</span>
                                            {hidden && <span className="text-[10px] text-slate-400 ml-auto">hidden</span>}
                                        </button>
                                    );
                                })}
                            </div>
                            <button onClick={() => setHiddenTypes(new Set())} className="mt-2 text-[10px] text-indigo-600 hover:underline w-full text-left">Show all</button>
                        </div>
                    )}

                    <ReactFlow
                        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
                        onNodeClick={(_, node) => setSelectedNode((node.data as any).neo4j)}
                        onNodeDoubleClick={(_, node) => expandNode(node.id)}
                        onPaneClick={() => setSelectedNode(null)}
                        proOptions={{ hideAttribution: true }}
                        style={{ background: '#f5f7fa' }}
                    >
                        <Background color="#e0e4ea" gap={24} size={1} />
                        <Controls className="bg-white shadow-lg rounded-lg overflow-hidden m-3 border border-slate-100" showInteractive={false} />
                    </ReactFlow>

                    {selectedNode && (
                        <div className="absolute top-14 left-3 w-[310px] bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-50 text-sm">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: LABEL_COLORS[(selectedNode.labels as string[])?.[0]]?.dot || '#94a3b8' }} />
                                    <h3 className="font-bold text-sm text-slate-900">{(selectedNode.labels as string[])?.[0]}</h3>
                                </div>
                                <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
                            </div>
                            <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
                                {Object.entries(selectedNode.properties).map(([key, value]) => (
                                    <div key={key} className="flex gap-2 text-xs items-start">
                                        <span className="font-semibold text-slate-500 min-w-[110px] shrink-0">{key}:</span>
                                        <span className="text-slate-800 break-words">{String(value)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 italic">
                                Connections: {edges.filter(e => e.source === selectedNode.elementId || e.target === selectedNode.elementId).length}
                                &nbsp;·&nbsp;Double-click node to expand
                            </div>
                        </div>
                    )}

                    {allNodes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-white/90 backdrop-blur-sm p-8 rounded-xl shadow-lg border border-slate-100 text-center">
                                <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                                </div>
                                <h3 className="text-base font-bold text-slate-700">Visual Explorer</h3>
                                <p className="text-slate-400 mt-1 text-xs">Ask a question or search entities above.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Chat Panel ── */}
                <ChatPanel 
                    messages={messages}
                    input={input}
                    setInput={setInput}
                    loading={loading}
                    streamingMsg={streamingMsg}
                    handleSend={handleSend}
                    chatEndRef={chatEndRef}
                />
            </div>
        </div>
    );
}
