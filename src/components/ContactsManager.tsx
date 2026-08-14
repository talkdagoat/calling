import React, { useState, useRef } from 'react';
import { 
  Users, Search, Phone, Video, UserPlus, Download, Upload, Code2, 
  Star, ShieldCheck, Tag, MoreVertical, Edit2, Trash2, Check, AlertCircle,
  FileJson, RefreshCw, Smartphone, Laptop, Lock
} from 'lucide-react';
import { Contact, CallType } from '../types';
import { INITIAL_CONTACTS_JSON } from '../data/defaultContacts';

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
  onInviteToRoom,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isJsonDrawerOpen, setIsJsonDrawerOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter tags extracted from contacts
  const allTags = Array.from(
    new Set(contacts.flatMap(c => c.tags || []))
  );

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.role && c.role.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTag = filterTag === 'all' || (c.tags && c.tags.includes(filterTag));
    const matchesFav = !showOnlyFavorites || c.isFavorite;
    return matchesSearch && matchesTag && matchesFav;
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
    if (confirm('Delete this contact from the JSON database?')) {
      const updated = contacts.filter(c => c.id !== id);
      onSaveContacts(updated);
    }
  };

  // Open JSON Editor Drawer
  const handleOpenJsonEditor = () => {
    setJsonText(JSON.stringify(contacts, null, 2));
    setJsonError(null);
    setIsJsonDrawerOpen(true);
  };

  // Save JSON from raw editor
  const handleSaveJsonEditor = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        throw new Error('Contacts JSON must be an array of contact objects.');
      }
      // Simple validation
      for (const item of parsed) {
        if (!item.id || !item.name) {
          throw new Error('Every contact must contain at least an "id" and "name".');
        }
      }
      onSaveContacts(parsed);
      setIsJsonDrawerOpen(false);
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON syntax');
    }
  };

  // Export Contacts as JSON file
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(contacts, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ciphercall_contacts_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import Contacts from JSON file
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          onSaveContacts(parsed);
          alert(`Successfully imported ${parsed.length} contacts from JSON!`);
        } else {
          alert('Imported JSON must be a non-empty array of contacts.');
        }
      } catch (err) {
        alert('Failed to parse uploaded JSON file. Please verify format.');
      }
    };
    reader.readAsText(file);
  };

  // Save Add/Edit Contact
  const handleSaveContactModal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = (editingContact ? editingContact.id : `user_${Date.now()}`);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const role = formData.get('role') as string;
    const avatar = (formData.get('avatar') as string) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
    const tagsStr = (formData.get('tags') as string) || '';
    const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
    const notes = formData.get('notes') as string;

    const updatedContact: Contact = {
      id,
      name,
      email,
      phone,
      role,
      avatar,
      status: editingContact ? editingContact.status : 'online',
      publicKeyFingerprint: editingContact?.publicKeyFingerprint || `${Math.random().toString(36).substring(2, 6).toUpperCase()} ${Math.random().toString(36).substring(2, 6).toUpperCase()} ${Math.random().toString(36).substring(2, 6).toUpperCase()} ${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      deviceList: ['Primary Device'],
      notes,
      isFavorite: editingContact ? editingContact.isFavorite : false,
      tags,
    };

    if (editingContact) {
      onSaveContacts(contacts.map(c => c.id === id ? updatedContact : c));
    } else {
      onSaveContacts([...contacts, updatedContact]);
    }

    setIsAddModalOpen(false);
    setEditingContact(null);
  };

  return (
    <div id="contacts-manager-view" className="w-full max-w-7xl mx-auto px-4 py-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
              Encrypted JSON Directory
            </h1>
            <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono rounded-full shadow-xs">
              {contacts.length} Contacts
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Store, import, export, and call contacts securely with zero-knowledge E2EE key fingerprints.
          </p>
        </div>

        {/* JSON Actions & Add Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Direct Raw JSON Editor Drawer Button */}
          <button
            id="open-json-editor-btn"
            onClick={handleOpenJsonEditor}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#18181d] hover:bg-[#222228] text-zinc-200 border border-zinc-800 rounded-xl text-xs font-medium transition-colors shadow-xs"
            title="View and edit raw contacts JSON"
          >
            <FileJson className="w-4 h-4 text-emerald-400" />
            <span>Raw JSON</span>
          </button>

          {/* Export JSON Button */}
          <button
            id="export-contacts-json-btn"
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#18181d] hover:bg-[#222228] text-zinc-200 border border-zinc-800 rounded-xl text-xs font-medium transition-colors shadow-xs"
            title="Download contacts.json"
          >
            <Download className="w-4 h-4 text-teal-400" />
            <span>Export JSON</span>
          </button>

          {/* Import JSON Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJsonFile}
            accept=".json,application/json"
            className="hidden"
          />
          <button
            id="import-contacts-json-btn"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#18181d] hover:bg-[#222228] text-zinc-200 border border-zinc-800 rounded-xl text-xs font-medium transition-colors shadow-xs"
            title="Upload contacts.json"
          >
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>Import JSON</span>
          </button>

          {/* Add New Contact Button */}
          <button
            id="add-contact-btn"
            onClick={() => {
              setEditingContact(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-950/50 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-[#121216] border border-zinc-800/80 rounded-2xl p-4 mb-6 space-y-3 shadow-md">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              id="contacts-search-input"
              type="text"
              placeholder="Search by name, role, email, phone, or fingerprint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Favorite Toggle */}
          <button
            id="toggle-favorites-filter-btn"
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
              showOnlyFavorites
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${showOnlyFavorites ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span>Favorites</span>
          </button>
        </div>

        {/* Tag Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-zinc-500 flex items-center gap-1 whitespace-nowrap">
            <Tag className="w-3 h-3" /> Filter:
          </span>
          <button
            onClick={() => setFilterTag('all')}
            className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
              filterTag === 'all'
                ? 'bg-emerald-600 text-white font-medium shadow-xs'
                : 'bg-[#18181d] text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            All Tags
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag)}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                filterTag === tag
                  ? 'bg-emerald-600 text-white font-medium shadow-xs'
                  : 'bg-[#18181d] text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts.map(contact => (
          <div
            key={contact.id}
            id={`contact-card-${contact.id}`}
            className="bg-[#121216] border border-zinc-800/80 hover:border-emerald-500/40 rounded-2xl p-5 shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between group"
          >
            <div>
              {/* Top Row: Avatar, Status, Favorite */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="relative">
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-zinc-700/80 shadow-md"
                  />
                  {/* Status Dot */}
                  <span
                    className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#121216] ${
                      contact.status === 'online'
                        ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                        : contact.status === 'in-call'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-zinc-500'
                    }`}
                    title={`Status: ${contact.status}`}
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleToggleFavorite(contact.id, e)}
                    className="p-1.5 text-zinc-500 hover:text-amber-400 rounded-lg hover:bg-[#1c1c22] transition-colors"
                  >
                    <Star className={`w-4 h-4 ${contact.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </button>
                  <button
                    onClick={() => {
                      setEditingContact(contact);
                      setIsAddModalOpen(true);
                    }}
                    className="p-1.5 text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-[#1c1c22] transition-colors"
                    title="Edit Contact"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteContact(contact.id, e)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-[#1c1c22] transition-colors"
                    title="Delete Contact"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Name & Role */}
              <h3 className="text-base font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors">
                {contact.name}
              </h3>
              <p className="text-xs text-zinc-400 mb-2">
                {contact.role || 'CipherCall Member'}
              </p>

              {/* Phone & Email */}
              <div className="space-y-1 text-xs text-zinc-400 font-mono mb-3">
                <div className="truncate text-zinc-300">{contact.phone}</div>
                <div className="truncate text-zinc-500">{contact.email}</div>
              </div>

              {/* Security Key Fingerprint Badge */}
              <div className="bg-[#0c0c0e] border border-zinc-800/90 rounded-xl p-2 mb-3 shadow-inner">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-0.5">
                  <span className="flex items-center gap-1 font-semibold text-emerald-400">
                    <Lock className="w-2.5 h-2.5" /> E2EE Key Fingerprint
                  </span>
                  <span>SHA-256</span>
                </div>
                <code className="text-[11px] font-mono text-emerald-300/90 block truncate">
                  {contact.publicKeyFingerprint}
                </code>
              </div>

              {/* Tags */}
              {contact.tags && contact.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {contact.tags.map(t => (
                    <span key={t} className="px-2 py-0.5 bg-[#1a1a20] border border-zinc-800 text-zinc-400 rounded-md text-[10px]">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Calling Action Buttons (1-Click Call) */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-800/80">
              {/* 1:1 Audio Call Button */}
              <button
                id={`call-audio-${contact.id}`}
                onClick={() => onInitiateCall(contact, 'audio')}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#18181d] hover:bg-teal-600/25 text-zinc-200 hover:text-teal-300 border border-zinc-800 hover:border-teal-500/40 rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-xs"
              >
                <Phone className="w-3.5 h-3.5 text-teal-400" />
                <span>1:1 Audio</span>
              </button>

              {/* HD Video Call Button */}
              <button
                id={`call-video-${contact.id}`}
                onClick={() => onInitiateCall(contact, 'video')}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 hover:border-emerald-600 rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-xs"
              >
                <Video className="w-3.5 h-3.5" />
                <span>HD Video</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredContacts.length === 0 && (
        <div className="text-center py-16 bg-[#121216] border border-zinc-800 rounded-2xl shadow-md">
          <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-100">No contacts found</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
            No contacts matched your search query or active filter tags.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterTag('all');
              setShowOnlyFavorites(false);
            }}
            className="px-4 py-2 bg-[#18181d] hover:bg-[#222228] border border-zinc-800 text-white rounded-xl text-xs font-medium"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Raw JSON Editor Drawer / Modal */}
      {isJsonDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
          <div className="w-full max-w-3xl bg-[#121216] border border-zinc-700/80 rounded-3xl p-6 shadow-2xl text-zinc-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Contacts JSON Storage</h2>
              </div>
              <span className="text-xs text-zinc-400 font-mono">Format: JSON Array of Contacts</span>
            </div>

            {jsonError && (
              <div className="mt-3 p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}

            <div className="my-4 flex-1 min-h-[300px]">
              <textarea
                id="raw-json-textarea"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full h-80 bg-[#0c0c0e] border border-zinc-800 rounded-2xl p-4 font-mono text-xs text-emerald-300 focus:outline-none focus:border-emerald-500 resize-none shadow-inner"
                spellCheck={false}
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
              <button
                onClick={() => {
                  setJsonText(JSON.stringify(INITIAL_CONTACTS_JSON, null, 2));
                  setJsonError(null);
                }}
                className="flex items-center gap-1 px-3 py-2 bg-[#18181d] hover:bg-[#222228] border border-zinc-800 text-zinc-300 rounded-xl text-xs font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Sample Directory</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsJsonDrawerOpen(false)}
                  className="px-4 py-2 bg-[#18181d] hover:bg-[#222228] border border-zinc-800 text-zinc-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  id="save-raw-json-btn"
                  onClick={handleSaveJsonEditor}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50"
                >
                  Save JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
          <div className="w-full max-w-md bg-[#121216] border border-zinc-750/80 rounded-3xl p-6 shadow-2xl text-zinc-100">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              <span>{editingContact ? 'Edit Contact' : 'Add New Contact'}</span>
            </h2>

            <form onSubmit={handleSaveContactModal} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Full Name</label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={editingContact?.name || ''}
                  placeholder="e.g. Satoshi Nakamoto"
                  className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Phone / Extension</label>
                  <input
                    name="phone"
                    type="text"
                    required
                    defaultValue={editingContact?.phone || ''}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Email</label>
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={editingContact?.email || ''}
                    placeholder="user@domain.com"
                    className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Role / Department</label>
                <input
                  name="role"
                  type="text"
                  defaultValue={editingContact?.role || ''}
                  placeholder="e.g. Lead Cryptographer"
                  className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Avatar Image URL</label>
                <input
                  name="avatar"
                  type="url"
                  defaultValue={editingContact?.avatar || ''}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Tags (Comma-separated)</label>
                <input
                  name="tags"
                  type="text"
                  defaultValue={editingContact?.tags?.join(', ') || ''}
                  placeholder="Security, Core Team, Design"
                  className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editingContact?.notes || ''}
                  placeholder="Custom notes or cryptographic identity details..."
                  className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
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
