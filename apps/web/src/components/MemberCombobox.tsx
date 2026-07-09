"use client";

import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react";
import type { OrgMember } from "@housepoints/contracts";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type MemberComboboxProps = {
  id?: string;
  label: string;
  members: OrgMember[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
};

function memberSearchText(member: OrgMember) {
  return [
    member.displayName,
    member.houseName,
    member.role,
  ].filter(Boolean).join(" ").toLowerCase();
}

export function MemberCombobox({
  id,
  label,
  members,
  value,
  onValueChange,
  placeholder = "Select member...",
  emptyMessage = "No members found.",
  disabled = false,
}: MemberComboboxProps) {
  const generatedId = useId();
  const comboboxId = id ?? `${generatedId}-member-picker`;
  const labelId = `${comboboxId}-label`;
  const listboxId = `${comboboxId}-listbox`;
  const searchId = `${comboboxId}-search`;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedMember = members.find((member) => member.id === value) ?? null;
  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return members;
    }

    return members.filter((member) => memberSearchText(member).includes(normalizedQuery));
  }, [members, query]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      searchRef.current?.focus();
    }
  }, [isOpen]);

  function selectMember(memberId: string) {
    onValueChange(memberId);
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div ref={rootRef} className="relative space-y-2">
      <label id={labelId} htmlFor={comboboxId} className="text-sm font-medium">{label}</label>
      <button
        id={comboboxId}
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={`${labelId} ${comboboxId}`}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5 text-left text-sm",
          "transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring",
          disabled ? "cursor-not-allowed opacity-60" : "",
        )}
      >
        {selectedMember ? (
          <span className="flex min-w-0 items-center gap-2">
            {selectedMember.houseColor ? (
              <span
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: selectedMember.houseColor }}
              />
            ) : null}
            <span className="truncate font-medium">{selectedMember.displayName}</span>
            {selectedMember.houseName ? (
              <span className="truncate text-xs text-muted-foreground">- {selectedMember.houseName}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <CaretDown size={16} className="flex-shrink-0 text-muted-foreground" />
      </button>

      {isOpen ? (
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-[70] mt-2 overflow-hidden rounded-xl border bg-popover shadow-xl",
            "max-h-[min(22rem,calc(100vh-12rem))]",
          )}
        >
          <div className="border-b p-2">
            <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
              <MagnifyingGlass size={16} className="text-muted-foreground" />
              <input
                id={searchId}
                ref={searchRef}
                type="search"
                role="searchbox"
                aria-label={`Search ${label.toLowerCase()}`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or house..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="max-h-[min(17rem,calc(100vh-17rem))] overflow-y-auto p-1"
          >
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const isSelected = member.id === value;

                return (
                  <button
                    key={member.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectMember(member.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                      "outline-none transition-colors hover:bg-accent/10 focus:bg-accent/10",
                      isSelected ? "bg-accent/10" : "",
                    )}
                  >
                    {member.houseColor ? (
                      <span
                        className="h-3 w-3 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: member.houseColor }}
                      />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{member.displayName}</span>
                      {member.houseName ? (
                        <span className="block truncate text-xs text-muted-foreground">{member.houseName}</span>
                      ) : null}
                    </span>
                    {isSelected ? <Check size={14} className="flex-shrink-0" /> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
