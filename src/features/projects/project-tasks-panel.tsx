"use client";

import { TaskKanban } from "@/features/tasks/task-kanban";

export function ProjectTasksPanel({ projectId, tasks, assignees, currentRole }: { projectId: string; tasks: any[]; assignees: any[]; currentRole: string }) {
  return <TaskKanban projectId={projectId} tasks={tasks} projects={[]} assignees={assignees} currentRole={currentRole} title="Project Tasks" />;
}
