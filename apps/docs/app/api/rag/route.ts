import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { neon, neonConfig } from '@neondatabase/serverless';

neonConfig.fetchConnectionCache = true;
const sql = neon(process.env.DATABASE_URL!);

export const runtime = 'edge';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function createEmbedding(text: string) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  const json = await res.json();
  return json.data[0].embedding as number[];
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const question = messages?.at(-1)?.content ?? '';

  const vec = await createEmbedding(question);
  const vecStr = `[${vec.join(',')}]`;

  const rows = await sql<{ content: string; url: string }>`
    SELECT e.content, d.url
    FROM embeddings e
    JOIN documents d ON e.document_id = d.id
    ORDER BY e.embedding <-> ${vecStr}::vector
    LIMIT 3
  `;

  const context = rows
    .map((r) => `- ${r.content}\n  ${r.url}`)
    .join('\n');

  const system = `Answer the question using the documentation context below.\n${context}`;

  const result = streamText({
    model: openai('gpt-3.5-turbo'),
    messages: [
      { role: 'system', content: system },
      ...messages,
    ],
  });

  return result.toDataStreamResponse();
}
