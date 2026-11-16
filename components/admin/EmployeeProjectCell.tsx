import type { EmployeeProjectCellProps } from "@/types/admin";

export function EmployeeProjectCell({ project, projects }: EmployeeProjectCellProps) {
  if (projects && projects.length > 1) {
    return (
      <div className="flex flex-col gap-1">
        {projects.map((name) => (
          <span key={name} className="text-[14px] font-semibold text-[var(--color-ink)]">
            {name}
          </span>
        ))}
      </div>
    );
  }
  if (!project) {
    return <span className="text-[14px] text-[var(--color-muted)]">—</span>;
  }

  return (
    <span className="text-[14px] font-semibold text-[var(--color-ink)]">
      {project}
    </span>
  );
}
