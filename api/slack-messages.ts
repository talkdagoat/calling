const SLACK_API = 'https://slack.com/api';
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID || 'C0C4FHW9J1F';

async function slackApi(method: string, body: Record<string, unknown> = {}) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('SLACK_BOT_TOKEN is not configured');
  const response = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const data = await response.json() as { ok?: boolean; error?: string; [key: string]: unknown };
  if (!response.ok || !data.ok) throw new Error(String(data.error || 'Slack API request failed'));
  return data;
}

function mapMessage(message: any) {
  const metadataType = message?.metadata?.event_type;
  const payload = message?.metadata?.event_payload || {};
  const isCall = metadataType === 'talk_call';
  return {
    id: message?.client_msg_id || message?.ts,
    ts: message?.ts,
    text: message?.text || '',
    senderId: payload.sender_id || payload.caller_id || message?.user,
    senderName: payload.display_name || payload.caller_name || message?.username || message?.user || 'Slack user',
    avatar: payload.avatar || payload.caller_avatar,
    kind: isCall ? 'call' : 'message',
    callType: isCall && payload.call_type === 'video' ? 'video' : 'audio',
  };
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const data = await slackApi('conversations.history', { channel: CHANNEL_ID, limit: 50 });
      const messages = (Array.isArray(data.messages) ? data.messages : [])
        .filter((message: any) => message.type === 'message' && !message.subtype)
        .reverse()
        .map(mapMessage);
      return res.status(200).json({ messages });
    }
    if (req.method === 'POST') {
      const messageText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      const sender = req.body?.sender;
      if (!messageText || messageText.length > 4000) return res.status(400).json({ error: 'Message must be between 1 and 4000 characters' });
      if (!sender?.id || !sender?.name) return res.status(400).json({ error: 'Sender identity is required' });
      const data = await slackApi('chat.postMessage', {
        channel: CHANNEL_ID,
        text: messageText,
        metadata: { event_type: 'talk_temporary_chat', event_payload: { display_name: String(sender.name).slice(0, 80), sender_id: String(sender.id).slice(0, 120), avatar: typeof sender.avatar === 'string' ? sender.avatar.slice(0, 500) : '' } },
      });
      return res.status(200).json({ ok: true, ts: data.ts });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : 'Unable to access Slack' });
  }
}