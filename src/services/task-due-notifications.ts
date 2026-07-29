import { appUrl } from "@/services/email";
import { notifyTaskDue } from "@/services/notifications";
import { Project } from "@/models/Project";
import { ProjectTask } from "@/models/ProjectTask";
import { User } from "@/models/User";

type Options = {
  organizationId?: string;
};

function elapsedSeconds(task: any, now = new Date()) {
  const accumulated = Number(task.accumulatedSeconds ?? 0);
  if (task.timerStatus !== "running" || !task.lastTimerStartedAt) return accumulated;
  const started = new Date(task.lastTimerStartedAt).getTime();
  if (Number.isNaN(started)) return accumulated;
  return accumulated + Math.max(0, Math.floor((now.getTime() - started) / 1000));
}

export async function sendDueTaskNotifications(options: Options = {}) {
  const now = new Date();
  const query: Record<string, unknown> = {
    timerStatus: "running",
    dueNotifiedAt: null,
    estimatedHours: { $gt: 0 },
    lastTimerStartedAt: { $ne: null }
  };
  if (options.organizationId) query.organizationId = options.organizationId;

  const tasks = await ProjectTask.find(query).limit(100).lean() as any[];
  let notified = 0;

  for (const task of tasks) {
    const estimateSeconds = Number(task.estimatedHours ?? 0) * 3600;
    const elapsed = elapsedSeconds(task, now);
    if (!estimateSeconds || elapsed < estimateSeconds) continue;

    const taskAssigneeIds = Array.from(new Set([task.assigneeId?.toString?.(), ...(task.assigneeIds ?? []).map((id: any) => id.toString())].filter(Boolean)));
    const [project, recipients] = await Promise.all([
      Project.findOne({ _id: task.projectId, organizationId: task.organizationId }).select("name").lean() as any,
      User.find({
        organizationId: task.organizationId,
        active: true,
        $or: [
          { role: { $in: ["owner", "admin"] } },
          ...(taskAssigneeIds.length ? [{ _id: { $in: taskAssigneeIds } }] : [])
        ]
      }).select("name email role").lean()
    ]);

    const uniqueRecipients = Array.from(new Map((recipients as any[]).map((recipient) => [recipient._id.toString(), { ...recipient, organizationId: task.organizationId.toString() }])).values());
    await notifyTaskDue(uniqueRecipients, {
      title: task.title,
      projectName: project?.name,
      estimatedHours: Number(task.estimatedHours ?? 0),
      elapsedHours: Math.round((elapsed / 3600) * 100) / 100,
      taskUrl: appUrl(`/tasks?projectId=${task.projectId.toString()}`)
    }).catch(() => undefined);
    await ProjectTask.updateOne({ _id: task._id, dueNotifiedAt: null }, { dueNotifiedAt: now });
    notified += 1;
  }

  return { checked: tasks.length, notified };
}
