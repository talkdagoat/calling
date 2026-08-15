import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Phone, Video, UserPlus, Star, Trash2, 
  X, AlertCircle, CheckCircle2, RefreshCw, RotateCcw,
  Sparkles, Plus, ArrowRight
} from 'lucide-react';
import { Contact, CallType } from '../types';

interface ContactsManagerProps {
  contacts: Contact[];
  onSaveContacts: (newContacts: Contact[]) => void;
  onInitiateCall: (contact: Contact, type: CallType) => void;
  onInviteToRoom: (contact: Contact) => void;
  currentUserName: string;
}

interface RegisteredUser {
  id: string;
  name: string;
  avatar: string;
  createdAt?: string;
  publicKeyFingerprint?: string;
}

export const ContactsManager: React.FC<ContactsManagerProps> = ({
  contacts,
  onSaveContacts,
  onInitiateCall,
  currentUserName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contactNameToAdd, setContactNameToAdd] = useState('');
  const [contactNoteToAdd, setContactNoteToAdd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);

  // Fetch registered users
  const fetchRegisteredUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setRegisteredUsers(data.users);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchRegisteredUsers();
  }, []);

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const filteredContacts = contacts.filter(c => {
    if (!trimmedQuery) return true;
    return (
      c.name.toLowerCase().includes(trimmedQuery) ||
      (c.role && c.role.toLowerCase().includes(trimmedQuery)) ||
      (c.notes && c.notes.toLowerCase().includes(trimmedQuery))
    );
  });

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Delete single contact
  const handleDeleteContact = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const updated = contacts.filter(c => c.id !== id);
    onSaveContacts(updated);
    showToast('Contact removed');
  };

  // Reset all contacts completely
  const handleResetAllContacts = async () => {
    onSaveContacts([]);
    try {
      await fetch('/api/reset-all', { method: 'POST' });
    } catch (e) {
      // local reset still works
    }
    showToast('All contacts reset clean');
  };

  // Handle Form Submit in Add Contact Modal
  const handleSaveContactModal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddError(null);

    const rawName = contactNameToAdd.trim();
    if (!rawName) return;

    if (rawName.toLowerCase() === currentUserName.trim().toLowerCase()) {
      setAddError('You cannot add yourself as a contact.');
      return;
    }

    // Check if already in contacts list
    if (contacts.some(c => c.name.toLowerCase() === rawName.toLowerCase())) {
      setAddError(`"${rawName}" is already in your contacts list.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/users/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: rawName,
          role: contactNoteToAdd.trim() || 'Talk User',
        }),
      });

      let targetUser: RegisteredUser;

      if (res.ok) {
        const data = await res.json();
        targetUser = data.user || {
          id: `user_${rawName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`,
          name: rawName,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&background=059669&color=ffffff&bold=true`,
          publicKeyFingerprint: '4E9A B7C2 91F0 33DA 8201',
        };
      } else {
        targetUser = {
          id: `user_${rawName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`,
          name: rawName,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&background=059669&color=ffffff&bold=true`,
          publicKeyFingerprint: '4E9A B7C2 91F0 33DA 8201',
        };
      }

      const newContact: Contact = {
        id: targetUser.id || `user_${rawName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: targetUser.name,
        phone: '',
        email: `${targetUser.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@talk.io`,
        role: contactNoteToAdd.trim() || 'Talk User',
        avatar: targetUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&background=059669&color=ffffff&bold=true`,
        status: 'online',
        publicKeyFingerprint: targetUser.publicKeyFingerprint || '4E9A B7C2 91F0 33DA 8201',
        deviceList: ['Primary Device'],
        notes: contactNoteToAdd.trim() || '',
        isFavorite: false,
        tags: [],
      };

      const updated = [...contacts, newContact];
      onSaveContacts(updated);
      showToast(`Added ${rawName} to contacts!`);
      setIsAddModalOpen(false);
      setContactNameToAdd('');
      setContactNoteToAdd('');
    } catch (err) {
      const fallbackContact: Contact = {
        id: `user_${rawName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`,
        name: rawName,
        phone: '',
        email: `${rawName.toLowerCase().replace(/[^a-z0-9]/g, '')}@talk.io`,
        role: contactNoteToAdd.trim() || 'Talk User',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&background=059669&color=ffffff&bold=true`,
        status: 'online',
        publicKeyFingerprint: '4E9A B7C2 91F0 33DA 8201',
        deviceList: ['Primary Device'],
        notes: contactNoteToAdd.trim() || '',
        isFavorite: false,
        tags: [],
      };
      onSaveContacts([...contacts, fallbackContact]);
      showToast(`Added ${rawName} to contacts!`);
      setIsAddModalOpen(false);
      setContactNameToAdd('');
      setContactNoteToAdd('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddModal = (prefillName = '') => {
    setContactNameToAdd(prefillName);
    setContactNoteToAdd('');
    setAddError(null);
    setIsAddModalOpen(true);
    fetchRegisteredUsers();
  };

  return (
    <div id="contacts-manager-view" className="w-full max-w-4xl mx-auto px-4 py-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-950/90 border border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md text-xs font-semibold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header with Add Contact & Reset Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Contacts</h1>
            <p className="text-xs text-zinc-400">Manage your saved contacts and start calls</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {contacts.length > 0 && (
            <button
              id="reset-contacts-btn"
              onClick={handleResetAllContacts}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-500/30 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              title="Reset and clear all saved contacts"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Contacts</span>
            </button>
          )}

          <button
            id="add-new-contact-btn"
            onClick={() => handleOpenAddModal()}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all active:scale-98 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Contact</span>
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="mb-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            id="filter-contacts-search"
            type="text"
            placeholder="Search your contacts by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121216] border border-zinc-800/90 hover:border-zinc-700 rounded-2xl pl-11 pr-10 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Contacts List */}
      <div>
        {filteredContacts.length > 0 ? (
          <div className="space-y-2.5">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                id={`contact-item-${contact.id}`}
                className="bg-[#121216] border border-zinc-800/80 hover:border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all duration-150 shadow-md shadow-black/20 group"
              >
                {/* Left: Avatar + Name + Note */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-zinc-750/80 shadow-md"
                    />
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#121216] bg-emerald-500 shadow-xs shadow-emerald-500/50" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-zinc-100 truncate group-hover:text-emerald-300 transition-colors">
                        {contact.name}
                      </h3>
                      <span className="px-1.5 py-0.2 bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono rounded">
                        Online
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 truncate mt-0.5">
                      {contact.role || 'Ready to call'}
                    </div>
                  </div>
                </div>

                {/* Right: Calling & Delete Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Audio Call Button */}
                  <button
                    id={`call-audio-${contact.id}`}
                    onClick={() => onInitiateCall(contact, 'audio')}
                    className="p-2.5 bg-emerald-950/70 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 hover:border-emerald-600 rounded-xl transition-all active:scale-95 shadow-xs flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                    title={`Audio Call ${contact.name}`}
                  >
                    <Phone className="w-4 h-4" />
                    <span className="hidden sm:inline">Audio</span>
                  </button>

                  {/* Video Call Button */}
                  <button
                    id={`call-video-${contact.id}`}
                    onClick={() => onInitiateCall(contact, 'video')}
                    className="p-2.5 bg-teal-950/70 hover:bg-teal-600 text-teal-300 hover:text-white border border-teal-500/30 hover:border-teal-600 rounded-xl transition-all active:scale-95 shadow-xs flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                    title={`Video Call ${contact.name}`}
                  >
                    <Video className="w-4 h-4" />
                    <span className="hidden sm:inline">Video</span>
                  </button>

                  {/* Delete Contact */}
                  <button
                    id={`delete-contact-${contact.id}`}
                    onClick={(e) => handleDeleteContact(contact.id, e)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                    title="Delete Contact"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          /* Empty Contacts */
          <div className="text-center py-12 px-4 bg-[#121216] border border-zinc-800/90 rounded-3xl shadow-xl max-w-md mx-auto my-4">
            <div className="w-14 h-14 bg-emerald-950/80 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-400 shadow-lg shadow-emerald-950/50">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">No contacts saved</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
              Add your friend by typing their name below.
            </p>

            <button
              onClick={() => handleOpenAddModal()}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Friend to Contacts</span>
            </button>
          </div>
        ) : (
          /* Search filter empty */
          <div className="text-center py-10 px-4 bg-[#121216] border border-zinc-800 rounded-2xl max-w-md mx-auto my-4">
            <p className="text-xs text-zinc-400 mb-3">No contact matched "{searchQuery}"</p>
            <button
              onClick={() => handleOpenAddModal(searchQuery.trim())}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add "{searchQuery}" as Contact</span>
            </button>
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
          <div className="w-full max-w-md bg-[#121216] border border-zinc-750/80 rounded-3xl p-6 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>Add Friend to Contacts</span>
              </h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setContactNameToAdd('');
                  setContactNoteToAdd('');
                  setAddError(null);
                }}
                className="text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message if any */}
            {addError && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-2xl flex items-start gap-2 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleSaveContactModal} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Friend's Name *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  autoFocus
                  value={contactNameToAdd}
                  onChange={(e) => {
                    setContactNameToAdd(e.target.value);
                    if (addError) setAddError(null);
                  }}
                  placeholder="Enter your friend's name"
                  className="w-full bg-[#0c0c0e] border border-zinc-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  Nickname / Note (Optional)
                </label>
                <input
                  name="role"
                  type="text"
                  value={contactNoteToAdd}
                  onChange={(e) => setContactNoteToAdd(e.target.value)}
                  placeholder="e.g. Friend, Work, Family"
                  className="w-full bg-[#0c0c0e] border border-zinc-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setContactNameToAdd('');
                    setContactNoteToAdd('');
                    setAddError(null);
                  }}
                  className="px-4 py-2 bg-[#18181d] hover:bg-[#222228] border border-zinc-800 text-zinc-300 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !contactNameToAdd.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <span>Add to Contacts</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
