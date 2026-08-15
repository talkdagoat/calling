import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Phone, Video, UserPlus, Star, Edit2, Trash2, 
  X, AlertCircle, CheckCircle2, RefreshCw, UserCheck
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
  createdAt: string;
  publicKeyFingerprint: string;
}

export const ContactsManager: React.FC<ContactsManagerProps> = ({
  contacts,
  onSaveContacts,
  onInitiateCall,
  currentUserName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contactNameToAdd, setContactNameToAdd] = useState('');
  const [contactNoteToAdd, setContactNoteToAdd] = useState('');
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  
  // Available registered users on Talk
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Load registered users from server
  const fetchRegisteredUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setRegisteredUsers(data.users);
        }
      }
    } catch (e) {
      console.error('Failed to fetch registered users:', e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchRegisteredUsers();
  }, [isAddModalOpen]);

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const filteredContacts = contacts.filter(c => {
    if (!trimmedQuery) return true;
    return (
      c.name.toLowerCase().includes(trimmedQuery) ||
      (c.role && c.role.toLowerCase().includes(trimmedQuery)) ||
      (c.notes && c.notes.toLowerCase().includes(trimmedQuery))
    );
  });

  // Toggle favorite
  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = contacts.map(c => c.id === id ? { ...c, isFavorite: !c.isFavorite } : c);
    onSaveContacts(updated);
  };

  // Delete contact (Zero browser confirm block - instantly deletes!)
  const handleDeleteContact = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const updated = contacts.filter(c => c.id !== id);
    onSaveContacts(updated);
  };

  // Handle Add/Edit Contact
  const handleSaveContactModal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddError(null);

    const rawName = contactNameToAdd.trim();
    if (!rawName) return;

    if (rawName.toLowerCase() === currentUserName.trim().toLowerCase()) {
      setAddError('You cannot add yourself as a contact.');
      return;
    }

    // Check if contact already exists in your contact list
    if (!editingContact && contacts.some(c => c.name.toLowerCase() === rawName.toLowerCase())) {
      setAddError(`"${rawName}" is already in your contacts.`);
      return;
    }

    // Verify on server if the user has an existing account
    setIsCheckingUser(true);
    try {
      const res = await fetch(`/api/users/check?name=${encodeURIComponent(rawName)}`);
      const data = await res.json();

      if (!data.exists || !data.user) {
        setAddError(
          `Cannot add "${rawName}". This person has not created an account on Talk yet. Only registered Talk users can be added.`
        );
        setIsCheckingUser(false);
        return;
      }

      const verifiedUser: RegisteredUser = data.user;

      const updatedContact: Contact = {
        id: verifiedUser.id || `user_${verifiedUser.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: verifiedUser.name,
        phone: '',
        email: `${verifiedUser.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@talk.io`,
        role: contactNoteToAdd.trim() || 'Talk User',
        avatar: verifiedUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(verifiedUser.name)}&background=059669&color=ffffff&bold=true`,
        status: 'online',
        publicKeyFingerprint: verifiedUser.publicKeyFingerprint || '4E9A B7C2 91F0 33DA 8201',
        deviceList: ['Registered Device'],
        notes: contactNoteToAdd.trim(),
        isFavorite: editingContact ? editingContact.isFavorite : false,
        tags: [],
      };

      if (editingContact) {
        onSaveContacts(contacts.map(c => c.id === editingContact.id ? updatedContact : c));
      } else {
        onSaveContacts([...contacts, updatedContact]);
      }

      setIsAddModalOpen(false);
      setEditingContact(null);
      setContactNameToAdd('');
      setContactNoteToAdd('');
      setSearchQuery('');
    } catch (err) {
      setAddError('Network error checking Talk registered accounts. Please try again.');
    } finally {
      setIsCheckingUser(false);
    }
  };

  // Quick add from available registered users
  const handleQuickAddRegisteredUser = (user: RegisteredUser) => {
    if (contacts.some(c => c.id === user.id || c.name.toLowerCase() === user.name.toLowerCase())) {
      return;
    }
    const newContact: Contact = {
      id: user.id,
      name: user.name,
      phone: '',
      email: `${user.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@talk.io`,
      role: 'Talk User',
      avatar: user.avatar,
      status: 'online',
      publicKeyFingerprint: user.publicKeyFingerprint,
      deviceList: ['Registered Device'],
      isFavorite: false,
      tags: [],
    };
    onSaveContacts([...contacts, newContact]);
    setIsAddModalOpen(false);
  };

  const handleOpenAddModal = (prefillName = '') => {
    setEditingContact(null);
    setContactNameToAdd(prefillName);
    setContactNoteToAdd('');
    setAddError(null);
    setIsAddModalOpen(true);
    fetchRegisteredUsers();
  };

  // Other users on Talk excluding self & already added contacts
  const otherRegisteredUsers = registeredUsers.filter(
    u => u.name.toLowerCase() !== currentUserName.trim().toLowerCase() &&
         !contacts.some(c => c.name.toLowerCase() === u.name.toLowerCase() || c.id === u.id)
  );

  return (
    <div id="contacts-manager-view" className="w-full max-w-4xl mx-auto px-4 py-6">
      {/* 1. Header with Add Contact Button */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Contacts</h1>
            <p className="text-xs text-zinc-400">Verified Talk users saved in your encrypted directory</p>
          </div>
        </div>

        <button
          id="add-new-contact-btn"
          onClick={() => handleOpenAddModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all active:scale-98 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Contact</span>
        </button>
      </div>

      {/* 2. Search Contacts Input */}
      {contacts.length > 0 && (
        <div className="mb-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              id="filter-contacts-search"
              type="text"
              placeholder="Search contact by name to call..."
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
      )}

      {/* 3. Contacts List */}
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
                    <span className="px-1.5 py-0.2 bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono rounded">
                      Verified User
                    </span>
                    {contact.isFavorite && (
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    )}
                  </div>
                  {contact.role ? (
                    <div className="text-xs text-zinc-400 truncate mt-0.5">{contact.role}</div>
                  ) : (
                    <div className="text-xs text-zinc-500 truncate mt-0.5">Ready to call</div>
                  )}
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

                {/* Delete Contact (Direct 100% reliable delete) */}
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
        /* Empty State */
        <div className="text-center py-14 px-4 bg-[#121216] border border-zinc-800/90 rounded-3xl shadow-xl max-w-md mx-auto my-6">
          <div className="w-16 h-16 bg-emerald-950/80 border border-emerald-500/30 rounded-3xl flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-lg shadow-emerald-950/50">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white">No contacts saved yet</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1.5 mb-6 leading-relaxed">
            Add registered Talk users to your contact list to start voice and video calls.
          </p>

          <button
            id="empty-add-contact-action-btn"
            onClick={() => handleOpenAddModal()}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-950/50 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add a Contact</span>
          </button>
        </div>
      ) : (
        /* Contact not found in existing list */
        <div className="text-center py-12 px-4 bg-[#121216] border border-zinc-800/90 rounded-3xl max-w-md mx-auto my-6 shadow-xl">
          <div className="w-12 h-12 bg-amber-950/50 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">"{searchQuery}" is not in your contacts</h3>
          <p className="text-xs text-zinc-400 mt-1.5 mb-5 max-w-xs mx-auto">
            You can add this person to your contacts if they have created an account on Talk.
          </p>
          <button
            onClick={() => handleOpenAddModal(searchQuery.trim())}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add "{searchQuery}"</span>
          </button>
        </div>
      )}

      {/* Add / Edit Contact Modal with Account Verification */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
          <div className="w-full max-w-md bg-[#121216] border border-zinc-750/80 rounded-3xl p-6 shadow-2xl text-zinc-100">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>{editingContact ? 'Edit Contact' : 'Add Registered User'}</span>
              </h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingContact(null);
                  setContactNameToAdd('');
                  setAddError(null);
                }}
                className="text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message when user does not exist on Talk */}
            {addError && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-2xl flex items-start gap-2.5 text-xs text-red-200 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleSaveContactModal} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Contact's Talk Account Name *
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
                  placeholder="e.g. Alex or Sarah"
                  className="w-full bg-[#0c0c0e] border border-zinc-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Must be an active account registered on Talk.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">
                  Nickname / Note (Optional)
                </label>
                <input
                  name="role"
                  type="text"
                  value={contactNoteToAdd}
                  onChange={(e) => setContactNoteToAdd(e.target.value)}
                  placeholder="e.g. Work, Family, Friend"
                  className="w-full bg-[#0c0c0e] border border-zinc-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Other registered Talk users discoverable */}
              {otherRegisteredUsers.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Users on Talk:
                    </span>
                    <button
                      type="button"
                      onClick={fetchRegisteredUsers}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                    {otherRegisteredUsers.map((regUser) => (
                      <div
                        key={regUser.id}
                        onClick={() => {
                          setContactNameToAdd(regUser.name);
                          if (addError) setAddError(null);
                        }}
                        className="flex items-center justify-between p-2 bg-[#0c0c0e] hover:bg-[#18181d] border border-zinc-800 rounded-xl cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={regUser.avatar}
                            alt={regUser.name}
                            className="w-6 h-6 rounded-lg object-cover"
                          />
                          <span className="text-xs font-bold text-zinc-200">{regUser.name}</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          Select
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingContact(null);
                    setContactNameToAdd('');
                    setAddError(null);
                  }}
                  className="px-4 py-2 bg-[#18181d] hover:bg-[#222228] border border-zinc-800 text-zinc-300 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCheckingUser || !contactNameToAdd.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isCheckingUser ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Checking Account...</span>
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
