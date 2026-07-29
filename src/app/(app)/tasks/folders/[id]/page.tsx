import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { TaskKanban } from "@/features/tasks/task-kanban";
import { connectToDatabase } from "@/lib/db";
import { isObjectId } from "@/lib/utils";
import { requireTenant } from "@/lib/permissions";
import { Project } from "@/models/Project";
import { ProjectTask } from "@/models/ProjectTask";
import { TaskFolder } from "@/models/TaskFolder";
import { User } from "@/models/User";
import { sendDueTaskNotifications } from "@/services/task-due-notifications";

void Project;
void User;

export default async function TaskFolderPage({ params }: any) {
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const routeParams = await params;
  const folderId = routeParams.id;
  if (!isObjectId(folderId)) notFound();

  const folder = await TaskFolder.findOne({ _id: folderId, organizationId, active: true }).populate("projectIds createdBy").lean() as any;
  if (!folder) notFound();

  const projectIds = (folder.projectIds ?? []).map((project: any) => project._id ?? project);
  const [tasks, assignees, currentUser] = await Promise.all([
    ProjectTask.find({ organizationId, folderId, projectId: { $in: projectIds } }).populate("projectId folderId assigneeId assigneeIds createdBy comments.userId activity.userId").sort({ createdAt: -1 }).lean(),
    User.find({ organizationId, active: true, role: { $in: ["admin", "staff"] } }).sort({ name: 1 }).lean(),
    User.findOne({ _id: session.user.userId, organizationId }).select("taskPermissions").lean(),
    sendDueTaskNotifications({ organizationId }).catch(() => undefined)
  ]);
  const fallbackTaskPermissions = session.user.role === "staff"
    ? { canCreateTask: true, canAssignTask: false, canCreateFolder: false, canManageFolderProjects: false }
    : { canCreateTask: true, canAssignTask: true, canCreateFolder: true, canManageFolderProjects: true };
  const taskPermissions = session.user.role === "owner" ? fallbackTaskPermissions : { ...fallbackTaskPermissions, ...((currentUser as any)?.taskPermissions ?? {}) };

  return (
    <PageShell
      title={folder.name}
      description={folder.description || "Project task folder"}
      breadcrumb={[{ label: "Tasks", href: "/tasks" }, { label: folder.name }]}
    >
      <TaskKanban
        tasks={JSON.parse(JSON.stringify(tasks))}
        projects={JSON.parse(JSON.stringify(folder.projectIds ?? []))}
        folders={JSON.parse(JSON.stringify([folder]))}
        assignees={JSON.parse(JSON.stringify(assignees))}
        currentRole={session.user.role}
        taskPermissions={taskPermissions}
        defaultFolderId={folder._id.toString()}
        title={`${folder.name} Tasks`}
      />
    </PageShell>
  );
}
