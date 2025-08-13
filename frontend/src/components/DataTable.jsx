import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

export default function DataTable({ data, onDeleteTest }) {
  const [sortField, setSortField] = useState("exam_number");
  const [sortDirection, setSortDirection] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Handle numeric sorting for certain fields
      if (sortField === "exam_number" || sortField === "question" || sortField === "difficulty" || sortField === "total_time_seconds") {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      }
      
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, sortField, sortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="w-4 h-4 text-gray-400" />;
    return sortDirection === "asc" ? 
      <ChevronUp className="w-4 h-4 text-slate-600" /> : 
      <ChevronDown className="w-4 h-4 text-slate-600" />;
  };

  const handleDeleteTest = (examNumber) => {
    if (window.confirm(`Are you sure you want to delete all data for Test ${examNumber}? This action cannot be undone.`)) {
      onDeleteTest(examNumber);
    }
  };

  // Get unique exam numbers for delete buttons
  const uniqueExams = [...new Set(data.map(row => row.exam_number))];

  return (
    <div className="bg-white rounded-3xl shadow-lg border border-slate-200/50 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Filtered Data ({sortedData.length} questions)
          </h3>
          <div className="flex gap-2">
            {uniqueExams.map(examNumber => (
              <button
                key={examNumber}
                onClick={() => handleDeleteTest(examNumber)}
                className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                title={`Delete Test ${examNumber}`}
              >
                <Trash2 className="w-4 h-4" />
                Delete Test {examNumber}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              {[
                { key: "exam_number", label: "Test #" },
                { key: "exam_date", label: "Test Date" },
                { key: "section", label: "Section" },
                { key: "question", label: "Question" },
                { key: "section_type", label: "Section Type" },
                { key: "subtype", label: "Subtype" },
                { key: "difficulty", label: "Difficulty" },
                { key: "total_time_seconds", label: "Time (s)" },
                { key: "question_score", label: "Score" },
                { key: "flagged", label: "Flagged" },
                { key: "scaled_score", label: "Scaled Score" },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-3 text-left text-sm font-medium text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort(key)}
                >
                  <div className="flex items-center gap-2">
                    {label}
                    <SortIcon field={key} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginatedData.map((row, index) => (
              <tr key={`${row.exam_number}-${row.section}-${row.question}`} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.exam_number}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{row.exam_date}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{row.section}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{row.question}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{row.section_type}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{row.subtype}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{row.difficulty || "-"}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{row.total_time_seconds}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    row.question_score ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    {row.question_score ? "Correct" : "Incorrect"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {row.flagged ? (
                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Flagged
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{row.scaled_score || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
