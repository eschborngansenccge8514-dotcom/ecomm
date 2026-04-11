import { getJournalEntry } from "../../actions";
import { JournalEntryDetail } from "./JournalEntryDetail";
import { notFound } from "next/navigation";

export default async function JournalEntryPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const entry = await getJournalEntry(params.id);

  if (!entry) {
    notFound();
  }

  return <JournalEntryDetail entry={entry} />;
}
