import { getJournalEntries } from "../actions";
import { JournalLog } from "./_components/JournalLog";
import { BookOpen } from 'lucide-react'
import { ManualEntryDialog } from "./_components/ManualEntryDialog";

export default async function JournalPage() {
  const entries = await getJournalEntries();
  
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <BookOpen size={20} className="text-blue-600" />
            General Journal
          </h2>
          <p className="text-gray-500 font-medium mt-1">
            A chronological log of every business event. Sales, expenses, and payments are all recorded here.
          </p>
        </div>
        <ManualEntryDialog />
      </div>
      <JournalLog entries={entries} />
    </div>
  );
}
