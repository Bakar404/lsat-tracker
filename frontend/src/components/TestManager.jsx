import React, { useState, useEffect } from "react";
import { Calendar, FileText, Trash2, Download } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function TestManager({ user, onTestDeleted }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadTests();
  }, [user]);

  const loadTests = async () => {
    try {
      setLoading(true);
      const { data: meta, error } = await supabase
        .from("lsat_meta")
        .select("*")
        .eq("user_id", user.id)
        .order("exam_number", { ascending: true });

      if (error) throw error;

      // Get question counts for each test
      const { data: rows, error: rowsError } = await supabase
        .from("lsat_rows")
        .select("exam_number")
        .eq("user_id", user.id);

      if (rowsError) throw rowsError;

      const questionCounts = rows.reduce((acc, row) => {
        acc[row.exam_number] = (acc[row.exam_number] || 0) + 1;
        return acc;
      }, {});

      const testsWithCounts = (meta || []).map((test) => ({
        ...test,
        question_count: questionCounts[test.exam_number] || 0,
        // Mock filename and upload date since we don't store these currently
        filename: `LSAT_Test_${test.exam_number}.pdf`,
        uploaded_at: test.created_at || new Date().toISOString(),
      }));

      setTests(testsWithCounts);
    } catch (error) {
      console.error("Error loading tests:", error);
      alert("Failed to load tests");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTest = async (examNumber) => {
    if (
      !window.confirm(
        `Are you sure you want to delete Test ${examNumber}? This will remove all questions and metadata for this test. This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setLoading(true);

      // Delete from both tables
      const [{ error: rowsError }, { error: metaError }] = await Promise.all([
        supabase
          .from("lsat_rows")
          .delete()
          .eq("user_id", user.id)
          .eq("exam_number", examNumber),
        supabase
          .from("lsat_meta")
          .delete()
          .eq("user_id", user.id)
          .eq("exam_number", examNumber),
      ]);

      if (rowsError) throw rowsError;
      if (metaError) throw metaError;

      // Refresh the tests list
      await loadTests();

      // Notify parent component
      onTestDeleted?.(examNumber);

      alert(`Test ${examNumber} has been deleted successfully.`);
    } catch (error) {
      console.error("Error deleting test:", error);
      alert("Failed to delete test");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-lg border border-slate-200/50 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          <span className="ml-2 text-slate-600">Loading tests...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-lg border border-slate-200/50 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Uploaded Tests ({tests.length})
        </h3>
      </div>

      {tests.length === 0 ? (
        <div className="p-8 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-slate-900 mb-2">
            No tests uploaded
          </h4>
          <p className="text-slate-500">
            Upload your first LSAT test to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Test #
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Test Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  File Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Questions
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Scaled Score
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Date Uploaded
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tests.map((test) => (
                <tr key={test.exam_number} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {test.exam_number}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {formatDate(test.exam_date)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {test.filename}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {test.question_count} questions
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {test.scaled_score || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {formatDateTime(test.uploaded_at)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => handleDeleteTest(test.exam_number)}
                      className="flex items-center gap-1 px-3 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                      title={`Delete Test ${test.exam_number}`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
