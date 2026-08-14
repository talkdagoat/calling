import { Contact } from '../types';

export const INITIAL_CONTACTS_JSON: Contact[] = [
  {
    id: 'user_alex_chen',
    name: 'Alex Chen',
    email: 'alex.chen@ciphercall.io',
    phone: '+1 (555) 234-8901',
    role: 'Cryptographic Lead',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    status: 'online',
    lastSeen: 'Just now',
    publicKeyFingerprint: '4E9A B7C2 91F0 33DA 8201',
    deviceList: ['MacBook Pro 16"', 'iPhone 15 Pro'],
    notes: 'Available for architecture review and E2EE key protocol audits.',
    isFavorite: true,
    tags: ['Security', 'Core Team', 'Engineering'],
  },
  {
    id: 'user_elena_rostova',
    name: 'Dr. Elena Rostova',
    email: 'elena.r@quantumsecure.org',
    phone: '+1 (555) 389-4029',
    role: 'Zero-Knowledge Researcher',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    status: 'online',
    lastSeen: '2m ago',
    publicKeyFingerprint: '99DA F102 77B4 4920 18EA',
    deviceList: ['iPad Pro', 'Pixel 9 Pro'],
    notes: 'Working on post-quantum signal lattice encryption.',
    isFavorite: true,
    tags: ['Research', 'E2EE', 'Advisor'],
  },
  {
    id: 'user_marcus_vance',
    name: 'Marcus Vance',
    email: 'marcus.v@hyperstream.dev',
    phone: '+1 (555) 712-9903',
    role: 'Realtime Audio Engineer',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'online',
    lastSeen: 'Just now',
    publicKeyFingerprint: '18FB 99C4 D21A 7731 44B9',
    deviceList: ['Studio Workstation', 'ThinkPad X1'],
    notes: 'Specializes in low-jitter WebRTC audio codecs and echo cancellation.',
    isFavorite: false,
    tags: ['Audio', 'WebRTC', 'Engineering'],
  },
  {
    id: 'user_sophia_alvarez',
    name: 'Sophia Alvarez',
    email: 'sophia.alvarez@securelink.net',
    phone: '+1 (555) 940-2184',
    role: 'Product Director',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    status: 'in-call',
    lastSeen: 'In a group conference',
    publicKeyFingerprint: '73DE 8891 CA24 1109 B7FE',
    deviceList: ['MacBook Air M3', 'Galaxy S24 Ultra'],
    notes: 'Leading confidential group syncs and client demo briefings.',
    isFavorite: true,
    tags: ['Product', 'Executive'],
  },
  {
    id: 'user_david_kim',
    name: 'David Kim',
    email: 'david.k@ciphercall.io',
    phone: '+1 (555) 441-6780',
    role: 'Infrastructure Architect',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    status: 'offline',
    lastSeen: '18m ago',
    publicKeyFingerprint: '52AA 04F1 88D9 31B2 C04E',
    deviceList: ['Linux Box', 'iPhone 14'],
    notes: 'Handles high availability signaling relays and TURN servers.',
    isFavorite: false,
    tags: ['DevOps', 'Infrastructure'],
  },
  {
    id: 'user_maya_patel',
    name: 'Maya Patel',
    email: 'maya.patel@nexuslabs.co',
    phone: '+1 (555) 830-5512',
    role: 'UX / Audio Design',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    status: 'online',
    lastSeen: 'Just now',
    publicKeyFingerprint: 'B301 EE44 9283 55AF 1902',
    deviceList: ['Mac Studio', 'iPhone 16'],
    notes: 'Designed the adaptive telephone ringtone synthesizers and call HUD.',
    isFavorite: false,
    tags: ['Design', 'Audio'],
  },
];

export const STORAGE_KEY_CONTACTS = 'ciphercall_contacts_json';
export const STORAGE_KEY_IDENTITY = 'ciphercall_user_identity';
export const STORAGE_KEY_CALL_LOGS = 'ciphercall_call_history';
export const STORAGE_KEY_SETTINGS = 'ciphercall_app_settings';

export function loadSavedContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONTACTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load contacts from localStorage', e);
  }
  return INITIAL_CONTACTS_JSON;
}

export function saveContactsToStorage(contacts: Contact[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts, null, 2));
  } catch (e) {
    console.error('Failed to save contacts', e);
  }
}
