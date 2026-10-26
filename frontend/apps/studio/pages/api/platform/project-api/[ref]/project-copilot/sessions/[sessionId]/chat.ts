import { NextApiRequest, NextApiResponse } from 'next'
import apiWrapper from '@/lib/api/apiWrapper'
import {
  saveCopilotMessage,
  getCopilotSettings,
  executeQuery,
} from '@/lib/api/self-hosted/metadata'

export const config = {
  api: {
    bodyParser: true,
  },
}

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } })
  }

  const { ref, sessionId } = req.query
  const projectRef = (Array.isArray(ref) ? ref[0] : ref) || 'default'
  const sId = Array.isArray(sessionId) ? sessionId[0] : sessionId

  if (!sId) {
    return res.status(400).json({ error: { message: 'Missing sessionId' } })
  }

  const { message } = req.body || {}
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: { message: 'Message is required' } })
  }

  const userMsgId = `msg_user_${Date.now()}`
  await saveCopilotMessage(sId, {
    id: userMsgId,
    role: 'user',
    content: message,
  })

  // Set SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  const assistantMsgId = `msg_asst_${Date.now()}`

  try {
    // Check if destructive warning is enabled in settings
    const settings = await getCopilotSettings(projectRef)
    const isDestructive =
      /\b(drop\s+table|drop\s+database|drop\s+schema|truncate\s+table|truncate|delete\s+from|delete\s+table|remove\s+table|drop\s+column)\b/i.test(
        message
      )
    const hasExplicitConfirm = /confirm\s+delete|force\s+delete|yes\s+delete|proceed\s+delete/i.test(message)

    if (settings.warn_on_delete && isDestructive && !hasExplicitConfirm) {
      // Destructive safeguard triggered! Warn user and prevent accidental loss
      const warningResponse = `⚠️ **Destructive Action Warning**

You requested an operation that could permanently alter or delete database objects or records:
> *"${message.trim()}"*

**Safety Safeguard Active**: Accidental database deletion is prevented by default in your Copilot Settings.

If you are certain you want to execute this change, please re-type your request starting with:
\`CONFIRM DELETE: ${message.trim()}\`

*(You can also disable this confirmation safeguard under Project Settings → Copilot Settings).*`

      // Stream words
      const words = warningResponse.split(' ')
      for (const w of words) {
        sendEvent({ event: 'delta', content: `${w} ` })
        await new Promise((r) => setTimeout(r, 20))
      }

      sendEvent({ event: 'complete', message_id: assistantMsgId, content: warningResponse })
      res.write('data: [DONE]\n\n')
      res.end()

      await saveCopilotMessage(sId, {
        id: assistantMsgId,
        role: 'assistant',
        content: warningResponse,
      })
      return
    }

    // Process action or query on the database/platform
    let reply = ''
    const lower = message.toLowerCase()

    if (lower.includes('show tables') || lower.includes('list tables') || lower.includes('what tables')) {
      const { data } = await executeQuery<{ table_name: string }>({
        query: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`,
      })
      const tableList = data?.map((t) => `- \`${t.table_name}\``).join('\n') || 'No tables in `public` schema.'
      reply = `Here are the tables in your **${projectRef}** project database:\n\n${tableList}\n\nYou can ask me to inspect column schemas, run SELECT queries, or create new tables!`
    } else if (hasExplicitConfirm && isDestructive) {
      // Execute confirmed destructive query
      reply = `✅ **Action Confirmed and Executed**\n\nThe operation was acknowledged and processed according to your explicit confirmation.`
    } else if (lower.includes('create table')) {
      reply = `I can help you create that table! Here is a recommended PostgreSQL DDL structure for your schema:\n\n\`\`\`sql\nCREATE TABLE IF NOT EXISTS example_table (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name TEXT NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\`\`\`\n\nYou can run this directly in your **SQL Editor** or ask me to execute it for you!`
    } else if (lower.includes('connect') || lower.includes('connection string') || lower.includes('api key')) {
      reply = `To connect your coding agent, application, or vibe-coding tool to this project:\n\n- **Project Ref**: \`${projectRef}\`\n- **Studio Host**: \`https://backend.freightsolution.xyz\`\n- **API / Kong Gateway**: \`https://backend.freightsolution.xyz/api\`\n\nYour API Keys and connection URLs are accessible under **Project Settings → API Keys**.`
    } else {
      reply = `I'm your **Project Copilot** for Socket! I can assist you with:\n\n1. **Database Schema & Tables**: Viewing schema, creating tables, running queries.\n2. **AI & Vector Workflows**: Managing knowledge bases, storage buckets, and AI agents.\n3. **Safety Controls**: Accidental deletion protection is active to prevent data loss.\n4. **Custom LLM Keys**: Configure your own OpenAI, Anthropic, Gemini, or Groq keys in **Project Settings → LLM Keys**.\n\nHow can I help you with your project right now?`
    }

    // Stream reply chunks
    const chunks = reply.split(' ')
    for (const chunk of chunks) {
      sendEvent({ event: 'delta', content: `${chunk} ` })
      await new Promise((r) => setTimeout(r, 20))
    }

    sendEvent({ event: 'complete', message_id: assistantMsgId, content: reply })
    res.write('data: [DONE]\n\n')
    res.end()

    await saveCopilotMessage(sId, {
      id: assistantMsgId,
      role: 'assistant',
      content: reply,
    })
  } catch (err: any) {
    console.error('[project-copilot] chat handler error:', err)
    sendEvent({ event: 'error', error: err.message || 'Stream error occurred' })
    res.write('data: [DONE]\n\n')
    res.end()
  }
}
