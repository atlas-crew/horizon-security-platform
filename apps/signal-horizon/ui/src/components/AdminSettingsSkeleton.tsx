import { Skeleton } from './LoadingStates';
import { Panel, Stack } from '@/ui';

export function AdminSettingsSkeleton() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="border-b border-border-subtle pb-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Stack direction="column" gap="xl" className="lg:!flex-row">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <nav className="flex flex-col space-y-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton
                key={i}
                className={`h-12 w-full ${i === 0 ? 'opacity-80' : 'opacity-50'}`}
              />
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-8">
          <Panel tone="info">
            <Skeleton className="h-6 w-64 mb-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </Panel>

          <Panel tone="destructive">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-12 w-48 mt-4" />
          </Panel>
        </main>
      </Stack>
    </div>
  );
}

export default AdminSettingsSkeleton;
