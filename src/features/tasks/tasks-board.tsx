"use client";

import { TaskKanban } from "@/features/tasks/task-kanban";

export function TasksBoard({ tasks, projects, folders, assignees, currentRole, taskPermissions }: { tasks: any[]; projects: any[]; folders: any[]; assignees: any[]; currentRole: string; taskPermissions: any }) {
  return <TaskKanban tasks={tasks} projects={projects} folders={folders} assignees={assignees} currentRole={currentRole} taskPermissions={taskPermissions} title="All Tasks" />;
}
