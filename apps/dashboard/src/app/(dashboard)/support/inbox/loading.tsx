import { Skeleton } from "@/components/ui/skeleton";

export default function SupportInboxLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] border-t">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="p-4 border-b last:border-0 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="flex-1 p-8 space-y-8">
          <div className="flex justify-end">
            <Skeleton className="h-20 w-[60%] rounded-2xl" />
          </div>
          <div className="flex justify-start">
            <Skeleton className="h-16 w-[45%] rounded-2xl" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-24 w-[70%] rounded-2xl" />
          </div>
        </div>
        <div className="p-4 border-t">
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
