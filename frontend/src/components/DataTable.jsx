import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react";

export default function DataTable({ data }) {
  const [sortField, setSortField] = useState("exam_number");
  const [sortDirection, setSortDirection] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle numeric sorting for certain fields
      if (
        sortField === "exam_number" ||
        sortField === "question" ||
        sortField === "difficulty" ||
        sortField === "total_time_seconds"
      ) {
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
    if (sortField !== field)
      return <ChevronDown className="w-4 h-4 text-gray-400" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-4 h-4 text-slate-600" />
    ) : (
      <ChevronDown className="w-4 h-4 text-slate-600" />
    );
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="flex flex-col items-center space-y-3">
          <BarChart3 className="w-12 h-12 text-slate-400" />
          <p className="text-slate-500">No data to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">Data Table</h3>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {sortedData.length} questions • Click column headers to sort
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-slate-200">
          <thead className="bg-slate-50">
            <tr className="border-b-2 border-slate-300">
              {[
                { key: "exam_number", label: "Test #" },
                { key: "exam_date", label: "Test Date" },
                { key: "section", label: "Section" },
                { key: "question", label: "Question" },
                { key: "section_type", label: "Section Type" },
                { key: "subtype", label: "Subtype" },
                { key: "difficulty", label: "Difficulty" },
                { key: "total_time_seconds", label: "Time" },
                { key: "question_score", label: "Score" },
                { key: "flagged", label: "Flagged" },
                { key: "scaled_score", label: "Scaled Score" },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors border-r border-slate-300 last:border-r-0"
                  onClick={() => handleSort(key)}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    <SortIcon field={key} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {paginatedData.map((row, index) => (
              <tr
                key={`${row.exam_number}-${row.section}-${row.question}`}
                className={`hover:bg-blue-50 transition-colors border-b border-slate-200 ${
                  index % 2 === 0 ? "bg-white" : "bg-slate-50"
                }`}
              >
                <td className="px-4 py-3 text-sm font-medium text-slate-900 border-r border-slate-200">
                  {row.exam_number}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 border-r border-slate-200">
                  {row.exam_date}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 border-r border-slate-200">
                  {row.section}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 border-r border-slate-200">
                  {row.question}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 border-r border-slate-200">
                  {row.section_type}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 border-r border-slate-200">
                  {row.subtype}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 border-r border-slate-200">
                  {row.difficulty || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 border-r border-slate-200">
                  {formatTime(row.total_time_seconds)}
                </td>
                <td className="px-4 py-3 text-sm border-r border-slate-200">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      row.question_score
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {row.question_score ? "Correct" : "Incorrect"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm border-r border-slate-200">
                  {row.flagged ? (
                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Yes
                    </span>
                  ) : (
                    <span className="text-slate-400">No</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {row.scaled_score || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, sortedData.length)} of{" "}
            {sortedData.length} results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm rounded-lg border border-slate-300 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm rounded-lg border border-slate-300 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
