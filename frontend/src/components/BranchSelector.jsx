import React, { useState, useRef, useEffect } from 'react';
import { Building2, Check, ChevronDown, Globe } from 'lucide-react';
import { useBranch } from '@/contexts/BranchContext';

export default function BranchSelector({ compact = false }) {
  const { branches, currentBranchId, currentBranch, canSwitch, setBranch } = useBranch();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const label = currentBranch ? currentBranch.name : 'Semua Cabang';
  const code = currentBranch ? currentBranch.code : 'ALL';

  if (!canSwitch) {
    return (
      <div className="inline-flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-card text-sm" data-testid="branch-selector-locked">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0">
          <div className="text-[10px] text-muted-foreground leading-none">Cabang</div>
          <div className="font-semibold text-xs leading-tight truncate max-w-[140px]">{label}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        data-testid="branch-selector"
        className="inline-flex items-center gap-2.5 h-10 px-3 rounded-md border border-border bg-card hover:bg-accent transition-colors text-sm min-w-[180px]"
      >
        {currentBranch ? <Building2 className="h-4 w-4 text-primary" /> : <Globe className="h-4 w-4 text-primary" />}
        <div className="text-left flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none font-semibold">{code}</div>
          <div className="font-semibold text-xs leading-tight truncate">{label}</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-md border border-border bg-card shadow-lg z-50 overflow-hidden animate-fade-in" data-testid="branch-dropdown">
          <button
            onClick={() => { setBranch(null); setOpen(false); }}
            data-testid="branch-option-all"
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent transition-colors ${!currentBranchId ? 'bg-accent' : ''}`}
          >
            <Globe className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 text-left">
              <div className="font-semibold">Semua Cabang</div>
              <div className="text-[10px] text-muted-foreground">Tampilkan data gabungan</div>
            </div>
            {!currentBranchId && <Check className="h-4 w-4 text-primary shrink-0" />}
          </button>
          <div className="border-t border-border" />
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => { setBranch(b.id); setOpen(false); }}
              data-testid={`branch-option-${b.id}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent transition-colors ${currentBranchId === b.id ? 'bg-accent' : ''}`}
            >
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 text-left min-w-0">
                <div className="font-semibold truncate flex items-center gap-1.5">
                  {b.name}
                  {b.is_default && <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">DEFAULT</span>}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">{b.code}</div>
              </div>
              {currentBranchId === b.id && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
