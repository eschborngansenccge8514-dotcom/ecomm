export default function ReconcileLoading() {
  return (
    <div className="p-8 space-y-8">
      <div className="animate-pulse">
        <div className="h-10 w-64 bg-gray-100 rounded-xl mb-2" />
        <div className="h-4 w-48 bg-gray-50 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
           <div className="h-32 bg-white rounded-3xl border border-gray-100 animate-pulse" />
           <div className="h-[500px] bg-white rounded-[2.5rem] border border-gray-100 animate-pulse" />
        </div>
        <div className="lg:col-span-8">
           <div className="h-[650px] bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100 animate-pulse" />
        </div>
      </div>
    </div>
  )
}
