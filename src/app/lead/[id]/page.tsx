import LeadView from "@/components/LeadView";

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { id } = await params;
  const { as } = await searchParams;
  return <LeadView leadId={id} initialRole={as === "parent" ? "parent" : "student"} />;
}
