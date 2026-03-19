import ProjectsDashboard from "./_components/projects-dashboard";

export default async function ProjectsPage({
  searchParams
}: {
  searchParams?: Promise<{ courseId?: string | string[] }>;
}) {
  const params = await searchParams;
  const courseId = typeof params?.courseId === "string" ? params.courseId : null;
  return <ProjectsDashboard initialCourseId={courseId} />;
}
