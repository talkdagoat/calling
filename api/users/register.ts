type TemporaryUser = {
  id: string;
  name: string;
  avatar: string;
  publicKeyFingerprint: string;
  createdAt: string;
};

const users = new Map<string, TemporaryUser>();

function key(name: string) {
  return name.trim().toLowerCase();
}

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const id = `user_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const now = new Date().toISOString();
  const user: TemporaryUser = {
    id,
    name,
    avatar: typeof req.body?.avatar === 'string' ? req.body.avatar : '',
    publicKeyFingerprint: typeof req.body?.publicKeyFingerprint === 'string' ? req.body.publicKeyFingerprint : '',
    createdAt: now,
  };

  users.set(key(name), user);
  return res.status(200).json({ success: true, user });
}

export const config = { runtime: 'nodejs' };
