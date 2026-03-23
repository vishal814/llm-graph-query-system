import { LABEL_COLORS } from '@/lib/constants';

interface TopNavProps {
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    searchLoading: boolean;
    searchResults: any[];
    handleSearchResultClick: (res: any) => void;
}

export const TopNav = ({ searchQuery, setSearchQuery, searchLoading, searchResults, handleSearchResultClick }: TopNavProps) => {
    return (
        <div className="h-11 border-b border-slate-200 bg-white flex items-center px-5 shrink-0 z-10">
            <div className="flex items-center gap-2 text-sm flex-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                <span className="text-slate-400 font-medium">Mapping</span>
                <span className="text-slate-300">/</span>
                <span className="font-semibold text-slate-800">Order to Cash</span>
            </div>
            {/* Semantic Search */}
            <div className="relative ml-auto mr-3 w-64">
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 shrink-0"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <input
                        className="bg-transparent text-xs flex-1 outline-none text-slate-700 placeholder-slate-400"
                        placeholder="Search entities..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchLoading && <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />}
                </div>
                {searchResults.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                        {searchResults.map((r, i) => (
                            <button key={i} onClick={() => handleSearchResultClick(r)}
                                className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: LABEL_COLORS[r.label]?.dot || '#94a3b8' }} />
                                <div>
                                    <div className="text-xs font-semibold text-slate-800">{r.display}</div>
                                    <div className="text-[10px] text-slate-400">{r.label}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
