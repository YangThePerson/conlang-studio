export default async function LanguagePage({
  params,
}: PageProps<'/languages/[id]'>) {
  const { id } = await params;

  return <div>{id}</div>;
}
