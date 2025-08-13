import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Filter, Download, Calendar } from "lucide-react";

const MultiSelectDropdown = ({
  label,
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select...",
  icon: Icon = Filter,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (value) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter((v) => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  const toggleAll = () => {
    if (selectedValues.length === options.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(options);
    }
  };

  const allSelected = selectedValues.length === options.length;
  const someSelected =
    selectedValues.length > 0 && selectedValues.length < options.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {label}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-slate-300 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
      >
        <span className="text-slate-700">
          {selectedValues.length === 0
            ? placeholder
            : selectedValues.length === options.length
            ? "All selected"
            : `${selectedValues.length} selected`}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {/* Select All option */}
          <label className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(input) => {
                if (input) input.indeterminate = someSelected;
              }}
              onChange={toggleAll}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm font-medium text-slate-700">
              {allSelected ? "Deselect All" : "Select All"}
            </span>
          </label>

          {/* Individual options */}
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedValues.includes(option)}
                onChange={() => toggleOption(option)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-slate-700">{option}</span>
              {selectedValues.includes(option) && (
                <Check className="w-4 h-4 ml-auto text-blue-600" />
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default function FiltersPanelMulti({
  rows,
  examFilter,
  setExamFilter,
  sectionFilter,
  setSectionFilter,
  sectionTypeFilter,
  setSectionTypeFilter,
  subtypeFilter,
  setSubtypeFilter,
  flagFilter,
  setFlagFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onExport,
}) {
  // Get unique options for each filter
  const examOptions = [...new Set(rows.map((r) => String(r.exam_number)))].sort(
    (a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      return Number.isFinite(numA) && Number.isFinite(numB)
        ? numA - numB
        : a.localeCompare(b);
    }
  );

  const sectionOptions = [...new Set(rows.map((r) => r.section))]
    .filter(Boolean)
    .sort();

  const sectionTypeOptions = [...new Set(rows.map((r) => r.section_type))]
    .filter(Boolean)
    .sort();

  const subtypeOptions = [...new Set(rows.map((r) => r.subtype))]
    .filter(Boolean)
    .sort();

  const flagOptions = ["Flagged", "Not Flagged"];

  const clearAllFilters = () => {
    setExamFilter([]);
    setSectionFilter([]);
    setSectionTypeFilter([]);
    setSubtypeFilter([]);
    setFlagFilter([]);
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    examFilter.length > 0 ||
    sectionFilter.length > 0 ||
    sectionTypeFilter.length > 0 ||
    subtypeFilter.length > 0 ||
    flagFilter.length > 0 ||
    dateFrom ||
    dateTo;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Test Number Filter */}
        <MultiSelectDropdown
          label="Test Numbers"
          options={examOptions}
          selectedValues={examFilter}
          onSelectionChange={setExamFilter}
          placeholder="All tests"
          icon={Filter}
        />

        {/* Section Filter */}
        <MultiSelectDropdown
          label="Sections"
          options={sectionOptions}
          selectedValues={sectionFilter}
          onSelectionChange={setSectionFilter}
          placeholder="All sections"
          icon={Filter}
        />

        {/* Section Type Filter */}
        <MultiSelectDropdown
          label="Section Types"
          options={sectionTypeOptions}
          selectedValues={sectionTypeFilter}
          onSelectionChange={setSectionTypeFilter}
          placeholder="All section types"
          icon={Filter}
        />

        {/* Subtype Filter */}
        <MultiSelectDropdown
          label="Subtypes"
          options={subtypeOptions}
          selectedValues={subtypeFilter}
          onSelectionChange={setSubtypeFilter}
          placeholder="All subtypes"
          icon={Filter}
        />

        {/* Flag Filter */}
        <MultiSelectDropdown
          label="Flag Status"
          options={flagOptions}
          selectedValues={flagFilter}
          onSelectionChange={setFlagFilter}
          placeholder="All questions"
          icon={Filter}
        />
      </div>

      {/* Date Range Filters */}
      <div className="grid md:grid-cols-2 gap-4 pt-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            From Date
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            To Date
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Export Button */}
      <div className="pt-4 border-t border-slate-200">
        <button
          onClick={onExport}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export Filtered Data
        </button>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="pt-4 border-t border-slate-200">
          <h4 className="text-sm font-medium text-slate-700 mb-2">
            Active Filters:
          </h4>
          <div className="flex flex-wrap gap-2">
            {examFilter.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Tests:{" "}
                {examFilter.length === examOptions.length
                  ? "All"
                  : examFilter.join(", ")}
              </span>
            )}
            {sectionFilter.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Sections:{" "}
                {sectionFilter.length === sectionOptions.length
                  ? "All"
                  : sectionFilter.join(", ")}
              </span>
            )}
            {sectionTypeFilter.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                Section Types:{" "}
                {sectionTypeFilter.length === sectionTypeOptions.length
                  ? "All"
                  : sectionTypeFilter.join(", ")}
              </span>
            )}
            {subtypeFilter.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Subtypes:{" "}
                {subtypeFilter.length === subtypeOptions.length
                  ? "All"
                  : subtypeFilter.join(", ")}
              </span>
            )}
            {flagFilter.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Flag: {flagFilter.join(", ")}
              </span>
            )}
            {(dateFrom || dateTo) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                Date: {dateFrom || "..."} to {dateTo || "..."}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
