import { getAccounts } from "../actions";
import { CoATree } from "./_components/CoATree";
import { ListTree } from 'lucide-react'

export default async function CoAPage() {
  const accounts = await getAccounts();
  
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <ListTree size={20} className="text-blue-600" />
          Chart of Accounts
        </h2>
        <p className="text-gray-500 font-medium mt-1">
          Think of this as your business's "filing cabinet". Every transaction is filed into one of these accounts.
        </p>
      </div>
      <CoATree accounts={accounts} />
    </div>
  );
}
