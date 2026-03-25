/**
 * Friends screen: list friends, send invitations, manage received/sent invitations.
 */

import { useState } from 'react'
import type { Friend, FriendInvitation } from '../types/friend'
import {
  useFriendList,
  useInvitationList,
  useSendInvite,
  useRespondToInvitation,
  useRemoveFriend,
} from '../hooks/useFriends'
import { ConfirmDialog } from '../components/ConfirmDialog'
import './FriendsScreen.css'

type Tab = 'friends' | 'received' | 'sent'

interface RemoveConfirmState {
  open: boolean
  friend?: Friend
}

export function FriendsScreen() {
  const [tab, setTab] = useState<Tab>('friends')
  const [inviteInput, setInviteInput] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [removeConfirm, setRemoveConfirm] = useState<RemoveConfirmState>({
    open: false,
  })

  const { data: friends, isLoading: friendsLoading } = useFriendList()
  const { data: received, isLoading: receivedLoading } = useInvitationList(
    'received',
    'pending'
  )
  const { data: sent, isLoading: sentLoading } = useInvitationList('sent')

  const sendInvite = useSendInvite()
  const respond = useRespondToInvitation()
  const removeFriend = useRemoveFriend()

  function handleSendInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    const value = inviteInput.trim()
    if (!value) return

    const payload = value.includes('@')
      ? { to_email: value }
      : { to_username: value }

    sendInvite.mutate(payload, {
      onSuccess: () => setInviteInput(''),
      onError: (err) =>
        setInviteError(
          err instanceof Error ? err.message : 'Failed to send invite.'
        ),
    })
  }

  function handleRespond(inv: FriendInvitation, action: 'accept' | 'decline') {
    respond.mutate({ id: inv.id, action })
  }

  function handleRemoveRequest(friend: Friend) {
    setRemoveConfirm({ open: true, friend })
  }

  function handleRemoveConfirm() {
    if (removeConfirm.friend) {
      removeFriend.mutate(removeConfirm.friend.id)
    }
    setRemoveConfirm({ open: false })
  }

  const pendingReceivedCount = received?.length ?? 0

  return (
    <main id="friends-screen" className="friends-screen" aria-label="Friends">
      <h1 id="friends-screen-title" className="friends-screen-title">
        Friends
      </h1>

      <form className="friends-invite-form" onSubmit={handleSendInvite}>
        <input
          id="friends-invite-input"
          type="text"
          className="friends-invite-input"
          placeholder="Enter email or username..."
          value={inviteInput}
          onChange={(e) => setInviteInput(e.target.value)}
          aria-label="Invite by email or username"
        />
        <button
          id="friends-invite-btn"
          type="submit"
          className="friends-invite-btn"
          disabled={sendInvite.isPending || !inviteInput.trim()}
        >
          {sendInvite.isPending ? 'Sending...' : 'Send invite'}
        </button>
      </form>
      {inviteError && (
        <div className="friends-error" role="alert">
          {inviteError}
        </div>
      )}
      {sendInvite.isError && !inviteError && (
        <div className="friends-error" role="alert">
          Failed to send invite. Please try again.
        </div>
      )}

      <div className="friends-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'friends'}
          className={`friends-tab${tab === 'friends' ? ' friends-tab--active' : ''}`}
          onClick={() => setTab('friends')}
        >
          Friends{friends ? ` (${friends.length})` : ''}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'received'}
          className={`friends-tab${tab === 'received' ? ' friends-tab--active' : ''}`}
          onClick={() => setTab('received')}
        >
          Received{pendingReceivedCount > 0 ? ` (${pendingReceivedCount})` : ''}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'sent'}
          className={`friends-tab${tab === 'sent' ? ' friends-tab--active' : ''}`}
          onClick={() => setTab('sent')}
        >
          Sent{sent ? ` (${sent.length})` : ''}
        </button>
      </div>

      <div className="friends-tab-content" role="tabpanel">
        {tab === 'friends' && (
          <>
            {friendsLoading && (
              <p className="friends-state">Loading friends...</p>
            )}
            {friends && friends.length === 0 && (
              <p className="friends-state">
                No friends yet. Send an invite to get started!
              </p>
            )}
            {friends && friends.length > 0 && (
              <ul className="friends-list">
                {friends.map((f) => (
                  <li key={f.id} className="friends-list-item">
                    <div className="friends-list-item-info">
                      <span className="friends-list-item-name">
                        {f.display_name || f.username}
                      </span>
                      <span className="friends-list-item-username">
                        @{f.username}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="friends-remove-btn"
                      onClick={() => handleRemoveRequest(f)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'received' && (
          <>
            {receivedLoading && (
              <p className="friends-state">Loading invitations...</p>
            )}
            {received && received.length === 0 && (
              <p className="friends-state">No pending invitations.</p>
            )}
            {received && received.length > 0 && (
              <ul className="friends-list">
                {received.map((inv) => (
                  <li key={inv.id} className="friends-list-item">
                    <div className="friends-list-item-info">
                      <span className="friends-list-item-name">
                        {inv.from_user.display_name || inv.from_user.username}
                      </span>
                      <span className="friends-list-item-username">
                        @{inv.from_user.username}
                      </span>
                    </div>
                    <div className="friends-invitation-actions">
                      <button
                        type="button"
                        className="friends-accept-btn"
                        onClick={() => handleRespond(inv, 'accept')}
                        disabled={respond.isPending}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="friends-decline-btn"
                        onClick={() => handleRespond(inv, 'decline')}
                        disabled={respond.isPending}
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'sent' && (
          <>
            {sentLoading && (
              <p className="friends-state">Loading invitations...</p>
            )}
            {sent && sent.length === 0 && (
              <p className="friends-state">No sent invitations.</p>
            )}
            {sent && sent.length > 0 && (
              <ul className="friends-list">
                {sent.map((inv) => (
                  <li key={inv.id} className="friends-list-item">
                    <div className="friends-list-item-info">
                      {inv.to_user ? (
                        <>
                          <span className="friends-list-item-name">
                            {inv.to_user.display_name || inv.to_user.username}
                          </span>
                          <span className="friends-list-item-username">
                            @{inv.to_user.username}
                          </span>
                        </>
                      ) : (
                        <span className="friends-list-item-name">
                          {inv.to_email}
                        </span>
                      )}
                    </div>
                    <span
                      className={`friends-invitation-status friends-invitation-status--${inv.status}`}
                    >
                      {inv.status === 'pending' && !inv.to_user
                        ? 'Awaiting signup'
                        : inv.status.charAt(0).toUpperCase() +
                          inv.status.slice(1)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={removeConfirm.open}
        title="Remove friend"
        message={
          removeConfirm.friend
            ? `Are you sure you want to remove ${removeConfirm.friend.display_name || removeConfirm.friend.username} from your friends?`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={handleRemoveConfirm}
        onCancel={() => setRemoveConfirm({ open: false })}
      />
    </main>
  )
}
