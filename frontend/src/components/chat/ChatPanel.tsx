import React from 'react';

interface ChatPanelProps {
    messages: { role: 'user' | 'assistant'; content: string }[];
    input: string;
    setInput: (val: string) => void;
    loading: boolean;
    streamingMsg: string;
    handleSend: () => Promise<void>;
    chatEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ChatPanel = ({
    messages,
    input,
    setInput,
    loading,
    streamingMsg,
    handleSend,
    chatEndRef
}: ChatPanelProps) => {

    return (
        <div className="w-[340px] min-w-[300px] border-l border-slate-200 bg-white flex flex-col shrink-0">
            <div className="px-5 py-4 border-b border-slate-100 shrink-0">
                <h2 className="font-bold text-sm text-slate-800">Chat with Graph</h2>
                <p className="text-xs text-slate-400 mt-0.5">Order to Cash</p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map((m, i) => (
                    <div key={i}>
                        {m.role === 'assistant' ? (
                            <div className="flex items-start gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 text-white text-[10px] font-bold">AI</div>
                                <div>
                                    <div className="text-xs font-semibold text-slate-800">Dodge AI</div>
                                    <div className="text-[10px] text-slate-400 mb-1">Graph Agent</div>
                                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{m.content}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-end">
                                <div className="bg-slate-800 text-white text-sm px-3.5 py-2.5 rounded-xl rounded-tr-sm max-w-[85%] leading-relaxed">{m.content}</div>
                            </div>
                        )}
                    </div>
                ))}
                {(loading || streamingMsg) && (
                    <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-white text-[10px] font-bold">AI</div>
                        <div>
                            <div className="text-xs font-semibold text-slate-800">Dodge AI</div>
                            <div className="text-[10px] text-slate-400 mb-1">Graph Agent</div>
                            {streamingMsg ? (
                                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                    {streamingMsg}<span className="inline-block w-0.5 h-4 bg-slate-400 ml-0.5 animate-pulse" />
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 pt-1">
                                    {[0, 150, 300].map(d => (
                                        <div key={d} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <div ref={chatEndRef as React.RefObject<HTMLDivElement>} />
            </div>

            {messages.length <= 1 && !loading && (
                <div className="px-4 pb-2 space-y-1.5 shrink-0">
                    {[
                        "Which products have the most billing documents?",
                        "Trace the full flow of sales order 740556",
                        "Give me all delivery documents for sales order 740556",
                        "Give me all billing documents for sales order 740556",
                        "Show me the entire supply chain graph",
                        "What is the total net amount of all sales orders?",
                        "How many unique customers do we have?",
                    ].map((q, i) => (
                        <button key={i} onClick={() => setInput(q)}
                            className="block w-full text-left text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg font-medium transition">
                            {q}
                        </button>
                    ))}
                </div>
            )}

            <div className="border-t border-slate-100 p-3 shrink-0">
                <div className="flex items-center gap-1 mb-2">
                    <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                    <span className="text-[10px] text-slate-400 font-medium">
                        {loading ? 'Dodge AI is thinking...' : 'Dodge AI is awaiting instructions'}
                    </span>
                </div>
                <div className="flex items-end gap-2">
                    <textarea
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 resize-none min-h-[38px] max-h-[100px]"
                        placeholder="Analyze anything"
                        rows={1}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    />
                    <button className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-slate-700 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
                        onClick={handleSend} disabled={loading || !input.trim()}>Send</button>
                </div>
            </div>
        </div>
    );
};
