"use client";

import { TaskKanban } from "@/features/tasks/task-kanban";

export function ProjectTasksPanel({ projectId, tasks, assignees }: { projectId: string; tasks: any[]; assignees: any[] }) {
  return <TaskKanban projectId={projectId} tasks={tasks} projects={[]} assignees={assignees} title="Project Tasks" />;
}
