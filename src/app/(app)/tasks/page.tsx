import Link from "next/link";
import { FolderKanban, ListChecks } from "lucide-react";
import { Types } from "mongoose";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { FilterForm } from "@/components/filter-form";
import { Button } from "@/components/ui/button";
import { TasksBoard } from "@/features/tasks/tasks-board";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { safeObjectId } from "@/lib/utils";
import { Project } from "@/models/Project";
import { ProjectTask } from "@/models/ProjectTask";
import { TaskFolder } from "@/models/TaskFolder";
import { User } from "@/models/User";

void Project;
void User;

export default async function TasksPage({ searchParams }: any) {
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q : "";
  const query: any = { organizationId };
  if (q) query.$or = [{ title: new RegExp(q, "i") }, { description: new RegExp(q, "i") }];
  if (params?.status) query.status = params.status;
  if (params?.priority) query.priority = params.priority;
  if (params?.severity) query.severity = params.severity;
  if (params?.milestone) query.milestone = new RegExp(params.milestone, "i");
  if (params?.due) {
    const today = new Date();
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    if (params.due === "overdue") query.dueDate = { $lt: today };
    if (params.due === "today") query.dueDate = { $gte: new Date(today.toDateString()), $lte: end };
    if (params.due === "upcoming") query.dueDate = { $gt: end };
  }
  if (params?.projectId) {
    const projectId = safeObjectId(params.projectId);
    if (projectId) query.projectId = projectId;
  }
  if (params?.folderId) {
    const folderId = safeObjectId(params.folderId);
    if (folderId) query.folderId = folderId;
  }
  if (params?.assigneeId) {
    const assigneeId = safeObjectId(params.assigneeId);
    if (assigneeId) query.$and = [{ $or: [{ assigneeId }, { assigneeIds: assigneeId }] }];
  }

  const [tasks, projects, folders, assignees, currentUser, folderTaskCounts] = await Promise.all([
    ProjectTask.find(query).populate("projectId folderId assigneeId assigneeIds createdBy comments.userId activity.userId").sort({ createdAt: -1 }).lean(),
    Project.find({ organizationId }).sort({ name: 1 }).lean(),
    TaskFolder.find({ organizationId, active: true }).populate("projectIds createdBy").sort({ name: 1 }).lean(),
    User.find({ organizationId, active: true, role: { $in: ["owner", "admin", "staff"] } }).sort({ name: 1 }).lean(),
    User.findOne({ _id: session.user.userId, organizationId }).select("taskPermissions").lean(),
    ProjectTask.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), folderId: { $ne: null } } },
      { $group: { _id: { folderId: "$folderId", status: "$status" }, count: { $sum: 1 } } }
    ])
  ]);
  const fallbackTaskPermissions = session.user.role === "staff"
    ? { canCreateTask: true, canAssignTask: false, canCreateFolder: false, canManageFolderProjects: false }
    : { canCreateTask: true, canAssignTask: true, canCreateFolder: true, canManageFolderProjects: true };
  const taskPermissions = session.user.role === "owner" ? fallbackTaskPermissions : { ...fallbackTaskPermissions, ...((currentUser as any)?.taskPermissions ?? {}) };

  return (
    <PageShell title="To Do Checklist" description="Manage project tasks across all projects with status, assignee, time estimate, and images.">
      <TaskFolderLauncher folders={JSON.parse(JSON.stringify(folders))} counts={JSON.parse(JSON.stringify(folderTaskCounts))} />
      <FilterForm className="filter-bar">
        <SearchBar placeholder="Search tasks" defaultValue={q} />
        <select name="status" defaultValue={params?.status ?? ""} className="native-control">
          <option value="">All statuses</option>
          <option value="to_do">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="in_review">In Review</option>
          <option value="complete">Complete</option>
        </select>
        <select name="priority" defaultValue={params?.priority ?? ""} className="native-control">
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <select name="severity" defaultValue={params?.severity ?? ""} className="native-control">
          <option value="">All severities</option>
          <option value="minor">Minor</option>
          <option value="normal">Normal</option>
          <option value="major">Major</option>
          <option value="critical">Critical</option>
        </select>
        <select name="due" defaultValue={params?.due ?? ""} className="native-control">
          <option value="">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="upcoming">Upcoming</option>
        </select>
        <input name="milestone" defaultValue={params?.milestone ?? ""} placeholder="Milestone" className="native-control" />
        <select name="projectId" defaultValue={params?.projectId ?? ""} className="native-control">
          <option value="">All projects</option>
          {projects.map((project: any) => <option key={project._id.toString()} value={project._id.toString()}>{project.name}</option>)}
        </select>
        <select name="folderId" defaultValue={params?.folderId ?? ""} className="native-control">
          <option value="">All folders</option>
          {folders.map((folder: any) => <option key={folder._id.toString()} value={folder._id.toString()}>{folder.name}</option>)}
        </select>
        <select name="assigneeId" defaultValue={params?.assigneeId ?? ""} className="native-control">
          <option value="">All assignees</option>
          {assignees.map((user: any) => <option key={user._id.toString()} value={user._id.toString()}>{user.name}</option>)}
        </select>
        <Button variant="outline">Filter</Button>
      </FilterForm>
      <TasksBoard tasks={JSON.parse(JSON.stringify(tasks))} projects={JSON.parse(JSON.stringify(projects))} folders={JSON.parse(JSON.stringify(folders))} assignees={JSON.parse(JSON.stringify(assignees))} currentRole={session.user.role} taskPermissions={taskPermissions} />
    </PageShell>
  );
}

function TaskFolderLauncher({ folders, counts }: { folders: any[]; counts: any[] }) {
  const countMap = new Map<string, Record<string, number>>();
  for (const row of counts) {
    const folderId = row._id?.folderId?.toString?.() ?? String(row._id?.folderId ?? "");
    const status = String(row._id?.status ?? "to_do");
    const current = countMap.get(folderId) ?? {};
    current[status] = Number(row.count ?? 0);
    countMap.set(folderId, current);
  }

  return (
    <section className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Task Folders</p>
          <p className="text-xs text-muted-foreground">Open a folder to work in that project-specific Kanban board.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/tasks">
            <ListChecks className="h-4 w-4" />
            All Tasks
          </Link>
        </Button>
      </div>
      {folders.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {folders.map((folder) => {
            const id = folder._id?.toString?.() ?? String(folder._id);
            const stats = countMap.get(id) ?? {};
            const total = Object.values(stats).reduce((sum, value) => sum + Number(value), 0);
            const projectCount = (folder.projectIds ?? []).length;
            return (
              <Link
                key={id}
                href={`/tasks/folders/${id}`}
                className="group rounded-lg border bg-background p-3 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{folder.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{folder.description || `${projectCount} project${projectCount === 1 ? "" : "s"}`}</p>
                  </div>
                  <span className="rounded-md bg-primary/10 p-2 text-primary">
                    <FolderKanban className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <FolderMetric label="Tasks" value={total} />
                  <FolderMetric label="Doing" value={stats.in_progress ?? 0} />
                  <FolderMetric label="Review" value={stats.in_review ?? 0} />
                  <FolderMetric label="Done" value={stats.complete ?? 0} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{projectCount} project{projectCount === 1 ? "" : "s"}</span>
                  <span className="font-medium text-primary group-hover:underline">Open Kanban</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No folders yet. Use Task Folders inside the board to create your first project folder.
        </div>
      )}
    </section>
  );
}

function FolderMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted px-2 py-1.5">
      <p className="text-sm font-semibold">{value}</p>
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
