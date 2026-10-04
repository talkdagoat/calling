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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const sender = req.body?.sender;
    const target = req.body?.target;
    const callType = req.body?.callType === 'video' ? 'video' : 'audio';
    if (!sender?.id || !sender?.name || !target?.id || !target?.name) {
      return res.status(400).json({ error: 'Caller and target identities are required' });
    }
    const data = await slackApi('chat.postMessage', {
      channel: CHANNEL_ID,
      text: callType === 'video'
        ? `📹 ${String(sender.name).slice(0, 80)} started a video call with ${String(target.name).slice(0, 80)}.`
        : `📞 ${String(sender.name).slice(0, 80)} started a call with ${String(target.name).slice(0, 80)}.`,
      metadata: {
        event_type: 'talk_call',
        event_payload: {
          call_type: callType,
          caller_id: String(sender.id).slice(0, 120),
          caller_name: String(sender.name).slice(0, 80),
          caller_avatar: typeof sender.avatar === 'string' ? sender.avatar.slice(0, 500) : '',
          target_id: String(target.id).slice(0, 120),
          target_name: String(target.name).slice(0, 80),
          target_avatar: typeof target.avatar === 'string' ? target.avatar.slice(0, 500) : '',
        },
      },
    });
    return res.status(200).json({ ok: true, ts: data.ts });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : 'Unable to post Slack call event' });
  }
}
