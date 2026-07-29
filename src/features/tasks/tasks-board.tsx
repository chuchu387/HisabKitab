"use client";

import { TaskKanban } from "@/features/tasks/task-kanban";

export function TasksBoard({ tasks, projects, assignees }: { tasks: any[]; projects: any[]; assignees: any[] }) {
  return <TaskKanban tasks={tasks} projects={projects} assignees={assignees} title="All Tasks" />;
}
