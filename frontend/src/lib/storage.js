import { clear, createStore, delMany, setMany, values } from "idb-keyval";

// One IndexedDB database per browser profile; exams are keyed by exam number.
const store = createStore("lsat-tracker", "exams");

export function listExams() {
  return values(store);
}

export function saveExams(exams) {
  return setMany(
    exams.map((exam) => [exam.exam_number, exam]),
    store,
  );
}

export function deleteExams(examNumbers) {
  return delMany(examNumbers, store);
}

export function clearExams() {
  return clear(store);
}
