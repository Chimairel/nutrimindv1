import React, { useState, useEffect, useId, useRef } from 'react';

interface AutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
  maxItems?: number;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  id,
  value,
  onChange,
  suggestions,
  placeholder = 'Type to search or add custom item...',
  disabled = false,
  maxItems = 10,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = id ?? `autocomplete-${generatedId}`;
  const listboxId = `${inputId}-listbox`;

  // Parse chips from comma-separated value string
  const chips = value ? value.split(',').map((c) => c.trim()).filter(Boolean) : [];

  // Filter suggestions based on input value and already selected chips
  const filteredSuggestions = suggestions.filter((item) => {
    const isAlreadySelected = chips.some((chip) => chip.toLowerCase() === item.toLowerCase());
    const matchesInput = item.toLowerCase().includes(inputValue.toLowerCase());
    return !isAlreadySelected && matchesInput;
  }).slice(0, 8); // Limit suggestions dropdown to 8 items

  // Close dropdown if user clicks outside of container
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const addChip = (chipText: string) => {
    const trimmed = chipText.trim();
    if (!trimmed) return;

    // Check limit
    if (chips.length >= maxItems) return;

    // Prevent duplicates
    const alreadyExists = chips.some((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (!alreadyExists) {
      const newChips = [...chips, trimmed];
      onChange(newChips.join(', '));
    }

    setInputValue('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => 
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        addChip(filteredSuggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        addChip(inputValue);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === ',' || e.key === ';') {
      // Add custom entry when comma/semicolon is pressed
      e.preventDefault();
      if (inputValue.trim()) {
        addChip(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && chips.length > 0) {
      // Remove last chip if input is empty and backspace is pressed
      const newChips = chips.slice(0, -1);
      onChange(newChips.join(', '));
    }
  };

  const handleRemoveChip = (chipToRemove: string) => {
    if (disabled) return;
    const newChips = chips.filter((c) => c !== chipToRemove);
    onChange(newChips.join(', '));
  };

  return (
    <div ref={containerRef} className="relative flex flex-col w-full gap-2">
      {/* Render selected chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 p-1 border border-brand-border/40 rounded-xl bg-brand-bgAlt/30 min-h-[44px] items-center px-3">
          {chips.map((chip, index) => (
            <span
              key={index}
              className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-bold bg-brand-green/10 border border-brand-green/25 text-brand-green transition-all"
            >
              <span>{chip}</span>
              <button
                type="button"
                onClick={() => handleRemoveChip(chip)}
                disabled={disabled}
                aria-label={`Remove ${chip}`}
                className="hover:bg-brand-green/20 text-brand-green h-4 w-4 rounded flex items-center justify-center transition-colors text-[9px] font-black cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input textbox */}
      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={disabled ? 'Locked' : placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && !disabled}
          aria-controls={listboxId}
          aria-activedescendant={highlightedIndex >= 0 ? `${inputId}-option-${highlightedIndex}` : undefined}
          className={`
            w-full rounded-xl bg-brand-bgAlt border border-brand-border px-4 py-2.5 text-sm text-brand-text placeholder-brand-muted/50
            transition-all duration-200 outline-none
            focus:border-brand-green focus:ring-2 focus:ring-brand-green/25
            disabled:opacity-40 disabled:cursor-not-allowed
          `}
        />

        {/* Dropdown panel */}
        {isOpen && !disabled && (inputValue.trim() || filteredSuggestions.length > 0) && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute top-full left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-brand-border bg-brand-bgAlt/95 backdrop-blur-md shadow-2xl max-h-60 overflow-y-auto"
          >
            {filteredSuggestions.map((item, index) => {
              const isHighlighted = index === highlightedIndex;
              return (
                <button
                  key={item}
                  id={`${inputId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isHighlighted}
                  onClick={() => addChip(item)}
                  className={`
                    w-full px-4 py-2.5 text-left text-xs font-semibold transition-colors outline-none cursor-pointer flex items-center justify-between
                    ${isHighlighted 
                      ? 'bg-brand-green/15 text-brand-green' 
                      : 'text-brand-text hover:bg-brand-border/40 hover:text-brand-text'
                    }
                  `}
                >
                  <span>{item}</span>
                  <span className="text-[10px] text-brand-muted/60 font-medium">Suggestion</span>
                </button>
              );
            })}
            
            {/* Direct custom entry preview if input is custom */}
            {inputValue.trim() && !filteredSuggestions.some(s => s.toLowerCase() === inputValue.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => addChip(inputValue)}
                className={`
                  w-full px-4 py-2.5 text-left text-xs font-semibold transition-colors outline-none border-t border-brand-border/30 cursor-pointer flex items-center justify-between
                  ${highlightedIndex === -1 && filteredSuggestions.length === 0
                    ? 'bg-brand-green/10 text-brand-green'
                    : 'text-brand-text/80 hover:bg-brand-border/40'
                  }
                `}
              >
                <span className="truncate">Add custom: <strong className="text-brand-green">&quot;{inputValue.trim()}&quot;</strong></span>
                <span className="text-[10px] text-brand-green font-bold bg-brand-green/10 px-1.5 py-0.5 rounded">Enter ↵</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AutocompleteInput;
