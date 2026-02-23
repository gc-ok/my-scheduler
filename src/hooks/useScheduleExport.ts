import { ScheduleResult, Section } from "../types";

export function useScheduleExport(schedule: ScheduleResult | null) {
  const exportCSV = () => {
    if (!schedule?.sections) return;

    const headers = [
      "Course ID", "Course Name", "Section ID", "Section Number",
      "Teacher ID", "Teacher Name", "Room", "Period", "Term",
      "Enrollment", "Max Size"
    ];

    const safe = (val: string | number | null | undefined) =>
      `"${String(val || '').replace(/"/g, '""')}"`;

    const rows = schedule.sections.map((s: Section) => [
      safe(s.courseId), safe(s.courseName), safe(s.id), s.sectionNum,
      safe(s.teacher), safe(s.teacherName), safe(s.room), safe(s.period),
      s.term || "FY", s.enrollment, s.maxSize
    ].join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `master_schedule_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return { exportCSV };
}
