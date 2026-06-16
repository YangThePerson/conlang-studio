import SideBar from './side-bar';

export default async function LanguageLayout({
  children,
  params,
}: LayoutProps<'/languages/[id]'>) {
  const { id } = await params;

  return (
    <div className="flex flex-1">
      <SideBar languageId={id} />
      <div className="flex-1">
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
