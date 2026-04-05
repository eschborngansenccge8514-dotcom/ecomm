import { Skeleton } from "@/components/ui/skeleton";

export default function LalamoveLoading() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-4 w-[300px]" />
        </div>
      </div>
      <div className="grid gap-6">
        <div className="border rounded-xl p-6">
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="border rounded-md">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 border-b last:border-0 flex items-center justify-between">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
