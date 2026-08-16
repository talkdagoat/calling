import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Phone, Video, UserPlus, Trash2, 
  X, AlertCircle, CheckCircle2, RefreshCw, RotateCcw,
  Database, UserCheck, ShieldCheck, Plus, Flame, Radio
} from 'lucide-react';
import { Contact, CallType } from '../types';
import { 
  FirestoreUser, 
  FirestoreContact,
  subscribeToRegisteredUsers,
  subscribeToUserContacts,
  findTalkUserByName,
  addContactToFirestore,
  deleteContactFromFirestore
} from '../lib/firebase';

interface ContactsManagerProps {
  contacts: Contact[];
  onSaveContacts: (newContacts: Contact[]) => void;
  onInitiateCall: (contact: Contact, type: CallType) => void;
  onInviteToRoom: (contact: Contact) => void;
  currentUserName: string;
  currentUserId: string;
}

export const ContactsManager: React.FC<ContactsManagerProps> = ({
  contacts,
  onSaveContacts,
  onInitiateCall,
  currentUserName,
  currentUserId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contactNameToAdd, setContactNameToAdd] = useState('');
  const [contactNoteToAdd, setContactNoteToAdd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'contacts' | 'directory'>('contacts');
  
  // Real-time Firestore Registered Users Directory State
  const [firestoreUsers, setFirestoreUsers] = useState<FirestoreUser[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);

  // 1. Subscribe in real-time to all registered Talk users in Firestore
  useEffect(() => {
    setIsLoadingDirectory(true);
    const unsubscribeUsers = subscribeToRegisteredUsers((users) => {
      setFirestoreUsers(users);
      setIsLoadingDirectory(false);
    });

    return () => {
      unsubscribeUsers();
    };
  }, []);

  // 2. Subscribe in real-time to current user's contacts in Firestore
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribeContacts = subscribeToUserContacts(currentUserId, (firestoreContacts) => {
      if (firestoreContacts && firestoreContacts.length > 0) {
        const formatted: Contact[] = firestoreContacts.map((fc) => ({
          id: fc.contactUserId,
          name: fc.name,
          phone: '',
          email: `${fc.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@talk.io`,
          role: fc.role || 'Talk Contact',
          avatar: fc.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(fc.name)}&background=059669&color=ffffff&bold=true`,
          status: 'online',
          publicKeyFingerprint: fc.publicKeyFingerprint || '4E9A B7C2 91F0 33DA 8201',
          deviceList: ['Primary Device'],
          notes: fc.notes || '',
          isFavorite: false,
          tags: [],
        }));

        // Merge with existing state
        onSaveContacts(formatted);
      }
    });

    return () => {
      unsubscribeContacts();
    };
  }, [currentUserId]);

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const filteredContacts = contacts.filter(c => {
    if (!trimmedQuery) return true;
    return (
      c.name.toLowerCase().includes(trimmedQuery) ||
      (c.role && c.role.toLowerCase().includes(trimmedQuery)) ||
      (c.notes && c.notes.toLowerCase().includes(trimmedQuery))
    );
  });

  const filteredDirectoryUsers = firestoreUsers.filter(u => {
    if (u.name.toLowerCase() === currentUserName.trim().toLowerCase()) return false;
    if (!trimmedQuery) return true;
    return u.name.toLowerCase().includes(trimmedQuery);
  });

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Delete single contact from Firestore and state
  const handleDeleteContact = async (contactUserId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const updated = contacts.filter(c => c.id !== contactUserId);
    onSaveContacts(updated);
    
    if (currentUserId) {
      await deleteContactFromFirestore(currentUserId, contactUserId);
    }
    showToast('Contact removed from Firestore');
  };

  // Reset all contacts
  const handleResetAllContacts = async () => {
    if (!window.confirm('Are you sure you want to clear all your saved contacts?')) return;
    
    // Delete each contact in Firestore
    for (const c of contacts) {
      await deleteContactFromFirestore(currentUserId, c.id);
    }
    onSaveContacts([]);
    showToast('All contacts cleared');
  };

  // Handle Form Submit in Add Contact Modal with STRICT FIRESTORE CHECK
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
      // 1. Strict Firestore verification: Check if target user is registered on Talk online database
      const verifiedTalkUser = await findTalkUserByName(rawName);

      if (!verifiedTalkUser) {
        setAddError(`User "${rawName}" does not exist on Talk. Only registered Talk users can be added as contacts. Ask your friend to open the Talk link so their account is registered online.`);
        setIsSubmitting(false);
        return;
      }

      // 2. Add to Firestore online database
      const result = await addContactToFirestore(
        currentUserId,
        verifiedTalkUser.name,
        contactNoteToAdd.trim() || 'Talk Contact',
        contactNoteToAdd.trim() || ''
      );

      if (!result.success) {
        setAddError(result.error || 'Failed to save contact in database.');
        setIsSubmitting(false);
        return;
      }

      const newContact: Contact = {
        id: verifiedTalkUser.id,
        name: verifiedTalkUser.name,
        phone: '',
        email: `${verifiedTalkUser.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@talk.io`,
        role: contactNoteToAdd.trim() || 'Talk Contact',
        avatar: verifiedTalkUser.avatar,
        status: 'online',
        publicKeyFingerprint: verifiedTalkUser.publicKeyFingerprint || '4E9A B7C2 91F0 33DA 8201',
        deviceList: ['Primary Device'],
        notes: contactNoteToAdd.trim() || '',
        isFavorite: false,
        tags: [],
      };

      const updated = [...contacts.filter(c => c.id !== newContact.id), newContact];
      onSaveContacts(updated);
      showToast(`Added ${verifiedTalkUser.name} to contacts in Firestore!`);
      setIsAddModalOpen(false);
      setContactNameToAdd('');
      setContactNoteToAdd('');
    } catch (err: any) {
      setAddError(err.message || 'Error communicating with Firestore online database');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Add Directly from the Live Talk Users Directory
  const handleQuickAddFromDirectory = async (user: FirestoreUser) => {
    if (contacts.some(c => c.id === user.id || c.name.toLowerCase() === user.name.toLowerCase())) {
      showToast(`"${user.name}" is already in your contacts!`);
      return;
    }

    try {
      const res = await addContactToFirestore(
        currentUserId,
        user.name,
        'Talk Contact',
        'Added from Online Directory'
      );

      if (res.success) {
        const newContact: Contact = {
          id: user.id,
          name: user.name,
          phone: '',
          email: `${user.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@talk.io`,
          role: 'Talk Contact',
          avatar: user.avatar,
          status: 'online',
          publicKeyFingerprint: user.publicKeyFingerprint,
          deviceList: ['Primary Device'],
          notes: 'Added from Online Directory',
          isFavorite: false,
          tags: [],
        };
        onSaveContacts([...contacts.filter(c => c.id !== newContact.id), newContact]);
        showToast(`Added ${user.name} to your contacts!`);
      } else {
        showToast(res.error || 'Failed to add contact');
      }
    } catch (e) {
      showToast('Database error adding contact');
    }
  };

  const handleOpenAddModal = (prefillName = '') => {
    setContactNameToAdd(prefillName);
    setContactNoteToAdd('');
    setAddError(null);
    setIsAddModalOpen(true);
  };

  return (
    <div id="contacts-manager-view" className="w-full max-w-4xl mx-auto px-4 py-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-950/95 border border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md text-xs font-semibold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header with Online Firestore Status Badge & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Contacts</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] font-semibold rounded-full shadow-xs">
                <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>Firestore Database</span>
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Online cloud storage. Only verified Talk profiles can be added.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {contacts.length > 0 && (
            <button
              id="reset-contacts-btn"
              onClick={handleResetAllContacts}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-500/30 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              title="Clear all saved contacts"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Contacts</span>
            </button>
          )}

          <button
            id="add-new-contact-btn"
            onClick={() => handleOpenAddModal()}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all active:scale-98 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Tabs: My Saved Contacts vs. Live Registered Users Directory on Talk */}
      <div className="flex items-center gap-2 p-1 bg-[#121216] border border-zinc-800 rounded-2xl mb-5">
        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'contacts'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>My Contacts ({contacts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('directory')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'directory'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Radio className="w-4 h-4 text-amber-400" />
          <span>Online Talk Directory ({firestoreUsers.length})</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="mb-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            id="filter-contacts-search"
            type="text"
            placeholder={
              activeTab === 'contacts'
                ? "Search your saved contacts..."
                : "Search online Talk users in Firestore..."
            }
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

      {/* TAB 1: SAVED CONTACTS LIST */}
      {activeTab === 'contacts' && (
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
                        <span className="px-1.5 py-0.2 bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono rounded flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Talk Verified</span>
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 truncate mt-0.5">
                        {contact.role || 'Talk Contact'}
                      </div>
                    </div>
                  </div>

                  {/* Right: Calling (WebSocket VoIP) & Delete Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Audio Call Button (WebSocket VoIP) */}
                    <button
                      id={`call-audio-${contact.id}`}
                      onClick={() => onInitiateCall(contact, 'audio')}
                      className="p-2.5 bg-emerald-950/70 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 hover:border-emerald-600 rounded-xl transition-all active:scale-95 shadow-xs flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                      title={`Audio Call ${contact.name}`}
                    >
                      <Phone className="w-4 h-4" />
                      <span className="hidden sm:inline">Audio</span>
                    </button>

                    {/* Video Call Button (WebSocket VoIP) */}
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
              <h3 className="text-base font-bold text-white">No saved contacts yet</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
                Add friends registered on Talk by typing their exact username or selecting them from the live online directory.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  onClick={() => handleOpenAddModal()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Contact</span>
                </button>
                <button
                  onClick={() => setActiveTab('directory')}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#1a1a22] hover:bg-[#22222c] border border-zinc-750 text-zinc-200 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Radio className="w-4 h-4 text-amber-400" />
                  <span>View Online Directory</span>
                </button>
              </div>
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
                <span>Search & Add "{searchQuery}"</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE ONLINE TALK USERS DIRECTORY (FIRESTORE) */}
      {activeTab === 'directory' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Live verified Talk users in Firestore online database:</span>
            </span>
          </div>

          {isLoadingDirectory ? (
            <div className="flex items-center justify-center py-12 text-zinc-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span className="text-xs font-medium">Loading online users from Firestore...</span>
            </div>
          ) : filteredDirectoryUsers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredDirectoryUsers.map((user) => {
                const isAlreadyContact = contacts.some(
                  c => c.id === user.id || c.name.toLowerCase() === user.name.toLowerCase()
                );

                return (
                  <div
                    key={user.id}
                    className="bg-[#121216] border border-zinc-800/80 hover:border-emerald-500/40 rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-colors shadow-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-xl object-cover border border-zinc-750 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-white truncate">{user.name}</h4>
                          <span className="text-[9px] px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-500/30 rounded font-mono">
                            On Talk
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                          Key: {user.publicKeyFingerprint ? user.publicKeyFingerprint.substring(0, 9) + '...' : 'E2EE Ready'}
                        </p>
                      </div>
                    </div>

                    <div>
                      {isAlreadyContact ? (
                        <span className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-zinc-400 text-[11px] font-medium rounded-xl flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Added</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleQuickAddFromDirectory(user)}
                          className="px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 bg-[#121216] border border-zinc-800 rounded-2xl p-6">
              <UserCheck className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-300 font-medium">No other users online yet.</p>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto">
                When your friends open Talk in their browser or mobile device, their profile automatically syncs to Firestore and will appear here in real-time!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add Contact Modal with Strict Firestore Online Verification */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
          <div className="w-full max-w-md bg-[#121216] border border-zinc-750/80 rounded-3xl p-6 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-950/80 border border-emerald-500/30 rounded-xl text-emerald-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Add Verified Talk Contact</h2>
                  <p className="text-[11px] text-zinc-400">Verified against online Firestore database</p>
                </div>
              </div>
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

            {/* Strict Constraint Alert / Error Message if user not on Talk */}
            {addError && (
              <div className="mb-4 p-3.5 bg-red-950/80 border border-red-500/50 rounded-2xl flex items-start gap-2.5 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-300">User Not Found on Talk</p>
                  <p className="text-[11px] leading-relaxed">{addError}</p>
                </div>
              </div>
            )}

            <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-2xl flex items-start gap-2 text-xs text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-zinc-300">
                <strong className="text-emerald-300">Strict Verification:</strong> You can only add contacts who have an active registered Talk profile in the online database.
              </p>
            </div>

            <form onSubmit={handleSaveContactModal} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Friend's Exact Registered Name *
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
                  placeholder="e.g. Sarah Chen, David Miller"
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
                  placeholder="e.g. Work, Family, Friend"
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
                      <span>Verifying in Firestore...</span>
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
