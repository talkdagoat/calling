import React, { useState } from 'react';
import { 
  Users, Search, Phone, Video, UserPlus, Star, Edit2, Trash2, 
  Lock, PhoneCall, Hash, X, Check, Smartphone
} from 'lucide-react';
import { Contact, CallType } from '../types';

interface ContactsManagerProps {
  contacts: Contact[];
  onSaveContacts: (newContacts: Contact[]) => void;
  onInitiateCall: (contact: Contact, type: CallType) => void;
  onInviteToRoom: (contact: Contact) => void;
}

export const ContactsManager: React.FC<ContactsManagerProps> = ({
  contacts,
  onSaveContacts,
  onInitiateCall,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDialpadOpen, setIsDialpadOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState('');

  const filteredContacts = contacts.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(searchQuery) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  // Toggle favorite
  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = contacts.map(c => c.id === id ? { ...c, isFavorite: !c.isFavorite } : c);
    onSaveContacts(updated);
  };

  // Delete contact
  const handleDeleteContact = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this contact?')) {
      const updated = contacts.filter(c => c.id !== id);
      onSaveContacts(updated);
    }
  };

  // Save Add/Edit Contact
  const handleSaveContactModal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = editingContact ? editingContact.id : `user_${Date.now()}`;
    const name = (formData.get('name') as string).trim();
    const phone = (formData.get('phone') as string).trim();
    const email = (formData.get('email') as string)?.trim() || `${phone.replace(/[^0-9]/g, '') || 'user'}@talk.io`;
    const role = (formData.get('role') as string)?.trim() || '';
    const avatar = (formData.get('avatar') as string)?.trim() || '';
    const notes = (formData.get('notes') as string)?.trim() || '';

    const randomFp = `${Math.random().toString(36).substring(2, 6).toUpperCase()} ${Math.random().toString(36).substring(2, 6).toUpperCase()} ${Math.random().toString(36).substring(2, 6).toUpperCase()} ${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const updatedContact: Contact = {
      id,
      name,
      phone,
      email,
      role,
      avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=059669&color=ffffff&bold=true`,
      status: editingContact ? editingContact.status : 'online',
      publicKeyFingerprint: editingContact?.publicKeyFingerprint || randomFp,
      deviceList: ['Primary Device'],
      notes,
      isFavorite: editingContact ? editingContact.isFavorite : false,
      tags: [],
    };

    if (editingContact) {
      onSaveContacts(contacts.map(c => c.id === id ? updatedContact : c));
    } else {
      onSaveContacts([...contacts, updatedContact]);
    }

    setIsAddModalOpen(false);
    setEditingContact(null);
  };

  // Direct Dial from Keypad
  const handleDirectDial = (type: CallType) => {
    if (!dialNumber.trim()) return;
    const cleanNum = dialNumber.trim();
    // Find matching contact or create a temporary contact object for calling
    const existing = contacts.find(c => c.phone === cleanNum || c.name.toLowerCase() === cleanNum.toLowerCase());
    if (existing) {
      onInitiateCall(existing, type);
    } else {
      const tempContact: Contact = {
        id: `dial_${cleanNum.replace(/[^a-zA-Z0-9]/g, '') || Date.now()}`,
        name: cleanNum,
        phone: cleanNum,
        role: '',
        email: `${cleanNum}@talk.io`,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanNum)}&background=059669&color=ffffff&bold=true`,
        status: 'online',
        publicKeyFingerprint: '99DA F102 77B4 4920 18EA',
        deviceList: ['Direct Dial Device'],
        isFavorite: false,
        tags: [],
      };
      onInitiateCall(tempContact, type);
    }
  };

  return (
    <div id="contacts-manager-view" className="w-full max-w-5xl mx-auto px-4 py-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <PhoneCall className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
              Contacts
            </h1>
            <span className="px-2.5 py-0.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono rounded-full shadow-xs">
              {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            End-to-end encrypted calling directly stored to your Google Drive.
          </p>
        </div>

        {/* Action Buttons: Dial Keypad & Add Contact */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Dialpad Toggle */}
          <button
            id="open-dialpad-btn"
            onClick={() => setIsDialpadOpen(!isDialpadOpen)}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors shadow-xs ${
              isDialpadOpen
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
                : 'bg-[#18181d] hover:bg-[#222228] text-zinc-200 border-zinc-800'
            }`}
          >
            <Hash className="w-4 h-4 text-emerald-400" />
            <span>{isDialpadOpen ? 'Hide Keypad' : 'Dial Number'}</span>
          </button>

          {/* Add Contact Button */}
          <button
            id="add-contact-btn"
            onClick={() => {
              setEditingContact(null);
              setIsAddModalOpen(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Direct Dial Keypad Panel (WhatsApp Style) */}
      {isDialpadOpen && (
        <div className="bg-[#121216] border border-emerald-500/30 rounded-2xl p-5 mb-6 shadow-xl shadow-black/40 animate-fade-in">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Direct Phone / ID Dialer
              </span>
              <button
                onClick={() => setIsDialpadOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative mb-4">
              <input
                id="dialpad-number-input"
                type="text"
                value={dialNumber}
                onChange={(e) => setDialNumber(e.target.value)}
                placeholder="Type phone number or ID to call..."
                className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-4 py-3 text-lg font-mono text-center text-emerald-300 focus:outline-none focus:border-emerald-500 tracking-wider shadow-inner"
              />
              {dialNumber && (
                <button
                  onClick={() => setDialNumber('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Keypad Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => setDialNumber((prev) => prev + digit)}
                  className="py-3 bg-[#18181d] hover:bg-[#222228] active:bg-emerald-950/60 border border-zinc-800 text-zinc-200 hover:text-white rounded-xl text-base font-bold transition-colors font-mono"
                >
                  {digit}
                </button>
              ))}
            </div>

            {/* Call Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                id="dialpad-audio-call-btn"
                onClick={() => handleDirectDial('audio')}
                disabled={!dialNumber.trim()}
                className="py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-98"
              >
                <Phone className="w-4 h-4" />
                <span>Call Audio</span>
              </button>
              <button
                id="dialpad-video-call-btn"
                onClick={() => handleDirectDial('video')}
                disabled={!dialNumber.trim()}
                className="py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:hover:bg-teal-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-950/50 transition-all active:scale-98"
              >
                <Video className="w-4 h-4" />
                <span>Call Video</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Input (Only shown if contacts exist) */}
      {contacts.length > 0 && (
        <div className="bg-[#121216] border border-zinc-800/80 rounded-2xl p-3 mb-5 shadow-md">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              id="contacts-search-input"
              type="text"
              placeholder="Search contacts by name or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Contacts List (WhatsApp / Phone Calls Style) */}
      {filteredContacts.length > 0 ? (
        <div className="space-y-2.5">
          {filteredContacts.map(contact => (
            <div
              key={contact.id}
              id={`contact-row-${contact.id}`}
              className="bg-[#121216] border border-zinc-800/80 hover:border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all duration-150 shadow-md shadow-black/20 group"
            >
              {/* Left: Avatar + Name + Phone */}
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-12 h-12 rounded-2xl object-cover border border-zinc-750/80 shadow-md"
                  />
                  <span
                    className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#121216] ${
                      contact.status === 'online'
                        ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                        : 'bg-zinc-500'
                    }`}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-100 truncate group-hover:text-emerald-300 transition-colors">
                      {contact.name}
                    </h3>
                    {contact.isFavorite && (
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 font-mono mt-0.5 truncate">
                    {contact.phone}
                    {contact.role && (
                      <span className="text-zinc-500 ml-2 font-sans">· {contact.role}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Quick Action Calling Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* 1:1 Audio Call Button */}
                <button
                  id={`call-audio-${contact.id}`}
                  onClick={() => onInitiateCall(contact, 'audio')}
                  className="p-2.5 bg-emerald-950/70 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 hover:border-emerald-600 rounded-xl transition-all active:scale-95 shadow-xs flex items-center gap-1 text-xs font-semibold"
                  title="Start Audio Call"
                >
                  <Phone className="w-4 h-4" />
                </button>

                {/* HD Video Call Button */}
                <button
                  id={`call-video-${contact.id}`}
                  onClick={() => onInitiateCall(contact, 'video')}
                  className="p-2.5 bg-teal-950/70 hover:bg-teal-600 text-teal-300 hover:text-white border border-teal-500/30 hover:border-teal-600 rounded-xl transition-all active:scale-95 shadow-xs flex items-center gap-1 text-xs font-semibold"
                  title="Start Video Call"
                >
                  <Video className="w-4 h-4" />
                </button>

                {/* Edit Contact */}
                <button
                  onClick={() => {
                    setEditingContact(contact);
                    setIsAddModalOpen(true);
                  }}
                  className="p-2 text-zinc-500 hover:text-zinc-200 rounded-xl hover:bg-[#18181d] transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                {/* Delete Contact */}
                <button
                  onClick={(e) => handleDeleteContact(contact.id, e)}
                  className="p-2 text-zinc-500 hover:text-red-400 rounded-xl hover:bg-[#18181d] transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : contacts.length === 0 ? (
        /* Empty State: WhatsApp Calling Style */
        <div className="text-center py-16 px-4 bg-[#121216] border border-zinc-800 rounded-3xl shadow-xl max-w-lg mx-auto my-8">
          <div className="w-16 h-16 bg-emerald-950/80 border border-emerald-500/30 rounded-3xl flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-lg shadow-emerald-950/50">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100">No contacts added yet</h2>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1.5 mb-6 leading-relaxed">
            Add people by name and phone number to start end-to-end encrypted voice and video calls. Your contacts are saved privately to your Google Drive.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              id="empty-add-contact-btn"
              onClick={() => {
                setEditingContact(null);
                setIsAddModalOpen(true);
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add First Contact</span>
            </button>

            <button
              id="empty-open-dialpad-btn"
              onClick={() => setIsDialpadOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#18181d] hover:bg-[#222228] border border-zinc-800 text-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Hash className="w-4 h-4 text-emerald-400" />
              <span>Dial a Number Directly</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-[#121216] border border-zinc-800 rounded-2xl">
          <Search className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-zinc-200">No matching contacts</h3>
          <p className="text-xs text-zinc-400 mt-1">No contact matches "{searchQuery}"</p>
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
          <div className="w-full max-w-md bg-[#121216] border border-zinc-750/80 rounded-3xl p-6 shadow-2xl text-zinc-100">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>{editingContact ? 'Edit Contact' : 'New Contact'}</span>
              </h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingContact(null);
                }}
                className="text-zinc-500 hover:text-zinc-300 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContactModal} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Contact Name *</label>
                <input
                  name="name"
                  type="text"
                  required
                  autoFocus
                  defaultValue={editingContact?.name || ''}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Phone Number or ID *</label>
                <input
                  name="phone"
                  type="text"
                  required
                  defaultValue={editingContact?.phone || ''}
                  placeholder="+1 (555) 123-4567 or user_id"
                  className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Note / Description (Optional)</label>
                <input
                  name="role"
                  type="text"
                  defaultValue={editingContact?.role || ''}
                  placeholder="e.g. Work, Family, Team Lead"
                  className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingContact(null);
                  }}
                  className="px-4 py-2 bg-[#18181d] hover:bg-[#222228] border border-zinc-800 text-zinc-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50"
                >
                  {editingContact ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
