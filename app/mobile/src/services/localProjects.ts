import * as FileSystem from 'expo-file-system/legacy';

export type LocalProject = {
  id: string;
  title: string;
  noteIds: string[];
  createdAt: number;
  updatedAt: number;
};

const PROJECTS_PATH = `${FileSystem.documentDirectory}note-projects.json`;

export async function listLocalProjects(): Promise<LocalProject[]> {
  try {
    const parsed: unknown = JSON.parse(await FileSystem.readAsStringAsync(PROJECTS_PATH));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is LocalProject =>
      value && typeof value.id === 'string' && typeof value.title === 'string' &&
      Array.isArray(value.noteIds) && typeof value.createdAt === 'number' &&
      typeof value.updatedAt === 'number'
    ).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

async function saveLocalProjects(projects: LocalProject[]) {
  await FileSystem.writeAsStringAsync(PROJECTS_PATH, JSON.stringify(projects));
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createLocalProject(title: string): Promise<LocalProject[]> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Enter a project name.');
  const projects = await listLocalProjects();
  const now = Date.now();
  return saveLocalProjects([{ id: `project-${now}-${Math.random().toString(36).slice(2, 8)}`, title: trimmed, noteIds: [], createdAt: now, updatedAt: now }, ...projects]);
}

export async function setProjectNote(projectId: string, noteId: string, included: boolean): Promise<LocalProject[]> {
  const projects = await listLocalProjects();
  return saveLocalProjects(projects.map((project) => {
    if (project.id !== projectId) return project;
    const noteIds = included ? Array.from(new Set([...project.noteIds, noteId])) : project.noteIds.filter((id) => id !== noteId);
    return { ...project, noteIds, updatedAt: Date.now() };
  }));
}

export async function removeNoteFromProjects(noteId: string): Promise<LocalProject[]> {
  const projects = await listLocalProjects();
  return saveLocalProjects(projects.map((project) => project.noteIds.includes(noteId)
    ? { ...project, noteIds: project.noteIds.filter((id) => id !== noteId), updatedAt: Date.now() }
    : project));
}

export async function deleteLocalProject(projectId: string): Promise<LocalProject[]> {
  return saveLocalProjects((await listLocalProjects()).filter((project) => project.id !== projectId));
}
