import { Skeleton } from "@/components/ui/skeleton";

export default function POSLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <div className="flex-1 flex flex-col p-4 space-y-4">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 flex-shrink-0 rounded-full" />
          ))}
        </div>
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="border rounded-xl p-2 space-y-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="w-96 border-l bg-gray-50 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex space-x-3">
              <Skeleton className="h-16 w-16 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t bg-white space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
