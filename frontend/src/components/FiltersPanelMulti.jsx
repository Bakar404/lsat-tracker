import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Check } from "lucide-react";

// Multi-select dropdown component
function MultiSelect({ options, selectedValues, onChange, placeholder, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleOption = (value) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const displayText = selectedValues.length === 0 
    ? placeholder 
    : selectedValues.length === 1 
      ? selectedValues[0]
      : `${selectedValues.length} selected`;

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="text-sm text-slate-600">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-left flex items-center justify-between"
      >
        <span className={selectedValues.length === 0 ? "text-gray-500" : "text-gray-900"}>
          {displayText}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2 border-b">
            <button
              onClick={handleClearAll}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              Clear All
            </button>
          </div>
          {options.map((option) => (
            <div
              key={option}
              onClick={() => handleToggleOption(option)}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between"
            >
              <span>{option}</span>
              {selectedValues.includes(option) && (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Selected values display */}
      {selectedValues.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedValues.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs"
            >
              {value}
              <button
                onClick={() => handleToggleOption(value)}
                className="hover:bg-blue-200 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FiltersPanel({
  rows,
  examFilter,
  setExamFilter,
  sectionFilter,
  setSectionFilter,
  flagFilter,
  setFlagFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onExport,
}) {
  // Get unique values for multi-select options
  const exams = Array.from(new Set(rows.map((r) => String(r.exam_number)))).sort((a, b) => {
    const numA = Number(a);
    const numB = Number(b);
    if (Number.isFinite(numA) && Number.isFinite(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });

  const sectionTypes = Array.from(new Set(rows.map((r) => r.section_type).filter(Boolean)));
  const subtypes = Array.from(new Set(rows.map((r) => r.subtype).filter(Boolean))).sort();
  const sections = Array.from(new Set(rows.map((r) => String(r.section)).filter(Boolean))).sort();

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Exam Numbers Multi-Select */}
        <MultiSelect
          label="Exams"
          options={exams}
          selectedValues={examFilter}
          onChange={setExamFilter}
          placeholder="All exams"
        />

        {/* Section Types Multi-Select */}
        <MultiSelect
          label="Section Types"
          options={sectionTypes}
          selectedValues={sectionFilter}
          onChange={setSectionFilter}
          placeholder="All section types"
        />

        {/* Sections Multi-Select */}
        <MultiSelect
          label="Sections"
          options={sections}
          selectedValues={Array.isArray(flagFilter) ? flagFilter : []}
          onChange={(values) => setFlagFilter(values)}
          placeholder="All sections"
        />

        {/* Subtypes Multi-Select */}
        <div className="sm:col-span-2 lg:col-span-1">
          <MultiSelect
            label="Subtypes"
            options={subtypes}
            selectedValues={Array.isArray(flagFilter) ? [] : []}
            onChange={() => {}} // We'll add subtype filter in useData hook
            placeholder="All subtypes"
          />
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm text-slate-600">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300"
            />
          </div>
        </div>

        {/* Flagged Filter */}
        <div>
          <label className="text-sm text-slate-600">Flagged Status</label>
          <select
            value={Array.isArray(flagFilter) ? "all" : flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300"
          >
            <option value="all">All</option>
            <option value="flagged">Only flagged</option>
            <option value="unflagged">Only un-flagged</option>
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all"
        >
          Export CSV
        </button>
        <button
          onClick={() => {
            setExamFilter([]);
            setSectionFilter([]);
            setFlagFilter("all");
            setDateFrom("");
            setDateTo("");
          }}
          className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition-all"
        >
          Clear All Filters
        </button>
      </div>

      {/* Filter Summary */}
      <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl">
        <strong>Active Filters:</strong>{" "}
        {examFilter.length > 0 && `Exams: ${examFilter.join(", ")} • `}
        {sectionFilter.length > 0 && `Section Types: ${sectionFilter.join(", ")} • `}
        {dateFrom && `From: ${dateFrom} • `}
        {dateTo && `To: ${dateTo} • `}
        {!Array.isArray(flagFilter) && flagFilter !== "all" && `Flagged: ${flagFilter} • `}
        {examFilter.length === 0 && sectionFilter.length === 0 && !dateFrom && !dateTo && (Array.isArray(flagFilter) || flagFilter === "all") && "None"}
      </div>
    </div>
  );
}
