import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import { TasksBoard } from "@/features/tasks/tasks-board";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { Project } from "@/models/Project";
import { ProjectTask } from "@/models/ProjectTask";
import { User } from "@/models/User";

void Project;
void User;

export default async function TasksPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const q = params?.q ?? "";
  const query: any = { organizationId };
  if (q) query.$or = [{ title: new RegExp(q, "i") }, { description: new RegExp(q, "i") }];
  if (params?.status) query.status = params.status;
  if (params?.projectId) query.projectId = params.projectId;
  if (params?.assigneeId) query.assigneeId = params.assigneeId;

  const [tasks, projects, assignees] = await Promise.all([
    ProjectTask.find(query).populate("projectId assigneeId").sort({ createdAt: -1 }).lean(),
    Project.find({ organizationId }).sort({ name: 1 }).lean(),
    User.find({ organizationId, active: true, role: { $in: ["admin", "staff"] } }).sort({ name: 1 }).lean()
  ]);

  return (
    <PageShell title="To Do Checklist" description="Manage project tasks across all projects with status, assignee, time estimate, and images.">
      <form className="flex flex-wrap gap-2">
        <SearchBar placeholder="Search tasks" defaultValue={q} />
        <select name="status" defaultValue={params?.status ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">All statuses</option>
          <option value="to_do">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="in_review">In Review</option>
          <option value="complete">Complete</option>
        </select>
        <select name="projectId" defaultValue={params?.projectId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">All projects</option>
          {projects.map((project: any) => <option key={project._id.toString()} value={project._id.toString()}>{project.name}</option>)}
        </select>
        <select name="assigneeId" defaultValue={params?.assigneeId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">All assignees</option>
          {assignees.map((user: any) => <option key={user._id.toString()} value={user._id.toString()}>{user.name}</option>)}
        </select>
        <Button variant="outline">Filter</Button>
      </form>
      <TasksBoard tasks={JSON.parse(JSON.stringify(tasks))} projects={JSON.parse(JSON.stringify(projects))} assignees={JSON.parse(JSON.stringify(assignees))} />
    </PageShell>
  );
}
