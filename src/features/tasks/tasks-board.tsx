"use client";

import { TaskKanban } from "@/features/tasks/task-kanban";

export function TasksBoard({ tasks, projects, assignees, currentRole }: { tasks: any[]; projects: any[]; assignees: any[]; currentRole: string }) {
  return <TaskKanban tasks={tasks} projects={projects} assignees={assignees} currentRole={currentRole} title="All Tasks" />;
}
