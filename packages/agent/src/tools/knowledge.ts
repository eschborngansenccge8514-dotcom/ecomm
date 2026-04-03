import { tool } from 'ai'
import { z } from 'zod'

// Gemini File Search is wired at the model level in the orchestrator.
// This tool signals to the agent that it should use grounded retrieval
// when answering regulatory questions.
export const searchKnowledgeBase = tool({
  description: 'Search Malaysia e-invoicing regulatory knowledge base. Use this for any question about LHDN rules, e-invoice requirements, implementation phases, tax codes, submission deadlines, penalties, or compliance obligations.',
  parameters: z.object({
    query: z.string().describe('The regulatory question to search for')
  }),
  execute: async ({ query }) => ({
    search_query: query,
    instruction: 'Answer using the connected File Search store. Cite the source document and section.'
  })
})
