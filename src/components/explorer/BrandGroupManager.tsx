import { useState } from "react";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import type { BrandGroup } from "@/hooks/useBrandGroups";

interface BrandGroupManagerProps {
  groups: readonly BrandGroup[];
  onApplyGroup: (brands: readonly string[]) => void;
  onCreateGroup: (name: string, brands: readonly string[]) => void;
  onDeleteGroup: (id: string) => void;
  currentBrands: ReadonlySet<string>;
}

const BrandGroupManager = ({
  groups,
  onApplyGroup,
  onCreateGroup,
  onDeleteGroup,
  currentBrands,
}: BrandGroupManagerProps) => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const handleSave = () => {
    const name = newGroupName.trim();
    if (!name) return;
    onCreateGroup(name, [...currentBrands]);
    setNewGroupName("");
    setShowSaveDialog(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setShowSaveDialog(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Brand Groups
        </h3>
      </div>

      <div className="flex flex-wrap gap-1">
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => onApplyGroup(group.brands)}
            className="group flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-surface-1 border border-border text-muted-foreground hover:text-slate-300 hover:border-slate-600 transition-colors"
          >
            <span>{group.name}</span>
            <span className="text-[10px] opacity-60">({group.brands.length})</span>
            {!group.isDefault && (
              <Trash2
                className="w-3 h-3 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-400 ml-0.5 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteGroup(group.id);
                }}
              />
            )}
          </button>
        ))}
      </div>

      {showSaveDialog ? (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Group name..."
            autoFocus
            className="flex-1 px-2 py-1 rounded text-xs bg-surface-1 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-600"
          />
          <button
            onClick={handleSave}
            disabled={!newGroupName.trim()}
            className="px-2 py-1 rounded text-[11px] bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600/30 transition-colors disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={() => setShowSaveDialog(false)}
            className="px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSaveDialog(true)}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-blue-400 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Save current selection
        </button>
      )}
    </div>
  );
};

export default BrandGroupManager;
