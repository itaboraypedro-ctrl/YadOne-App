import { SettingsSubNav } from '@/components/settings/SettingsSubNav'
import { getWorkspaceRole } from '@/lib/permissions-server'

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const role = await getWorkspaceRole()

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="container max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-6">Configurações</h1>
        <div className="flex gap-8">
          <aside className="w-56 shrink-0">
            <SettingsSubNav role={role} />
          </aside>
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  )
}
