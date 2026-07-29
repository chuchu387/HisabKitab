"use client";

import { TaskKanban } from "@/features/tasks/task-kanban";

export function ProjectTasksPanel({ projectId, tasks, folders, assignees, currentRole, taskPermissions }: { projectId: string; tasks: any[]; folders: any[]; assignees: any[]; currentRole: string; taskPermissions: any }) {
  return <TaskKanban projectId={projectId} tasks={tasks} projects={[]} folders={folders} assignees={assignees} currentRole={currentRole} taskPermissions={taskPermissions} title="Project Tasks" />;
}
