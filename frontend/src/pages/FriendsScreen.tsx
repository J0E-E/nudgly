/**
 * Friends screen: list friends, send invitations, manage received/sent invitations.
 */

import { useState } from 'react'
import type { Friend, FriendInvitation } from '../types/friend'
import {
  useFriendList,
  useInvitationList,
  useRespondToInvitation,
  useRemoveFriend,
} from '../hooks/useFriends'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AddFriendModal } from '../components/AddFriendModal'
import { PageCard } from '../components/PageCard'
import './FriendsScreen.css'

type Tab = 'friends' | 'received' | 'sent'

interface RemoveConfirmState {
  open: boolean
  friend?: Friend
}

export function FriendsScreen() {
  const [tab, setTab] = useState<Tab>('friends')
  const [addFriendOpen, setAddFriendOpen] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState<RemoveConfirmState>({
    open: false,
  })

  const { data: friends, isLoading: friendsLoading } = useFriendList()
  const { data: received, isLoading: receivedLoading } = useInvitationList(
    'received',
    'pending'
  )
  const { data: sent, isLoading: sentLoading } = useInvitationList('sent')

  const respond = useRespondToInvitation()
  const removeFriend = useRemoveFriend()

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
    <PageCard id="friends-screen" ariaLabel="Friends">
      <div id="friends-screen-header" className="friends-header">
        <h1 id="friends-screen-title" className="friends-screen-title">
          Friends
        </h1>
        <button
          id="friends-add-btn"
          type="button"
          className="friends-add-btn"
          onClick={() => setAddFriendOpen(true)}
        >
          Add Friends
        </button>
      </div>

      <div id="friends-tabs" className="friends-tabs" role="tablist">
        <button
          id="friends-tab-friends"
          role="tab"
          aria-selected={tab === 'friends'}
          className={`friends-tab${tab === 'friends' ? ' friends-tab--active' : ''}`}
          onClick={() => setTab('friends')}
        >
          Friends{friends ? ` (${friends.length})` : ''}
        </button>
        <button
          id="friends-tab-received"
          role="tab"
          aria-selected={tab === 'received'}
          className={`friends-tab${tab === 'received' ? ' friends-tab--active' : ''}`}
          onClick={() => setTab('received')}
        >
          Received{pendingReceivedCount > 0 ? ` (${pendingReceivedCount})` : ''}
        </button>
        <button
          id="friends-tab-sent"
          role="tab"
          aria-selected={tab === 'sent'}
          className={`friends-tab${tab === 'sent' ? ' friends-tab--active' : ''}`}
          onClick={() => setTab('sent')}
        >
          Sent{sent ? ` (${sent.length})` : ''}
        </button>
      </div>

      <div id="friends-tab-content" className="friends-tab-content" role="tabpanel">
        {tab === 'friends' && (
          <>
            {friendsLoading && (
              <p id="friends-loading" className="friends-state">Loading friends...</p>
            )}
            {friends && friends.length === 0 && (
              <p id="friends-empty" className="friends-state">
                No friends yet. Send an invite to get started!
              </p>
            )}
            {friends && friends.length > 0 && (
              <ul id="friends-list" className="friends-list">
                {friends.map((f) => (
                  <li key={f.id} id={`friend-${f.id}`} className="friends-list-item">
                    <div id={`friend-${f.id}-info`} className="friends-list-item-info">
                      <span id={`friend-${f.id}-name`} className="friends-list-item-name">
                        {f.display_name || f.username}
                      </span>
                      <span id={`friend-${f.id}-username`} className="friends-list-item-username">
                        @{f.username}
                      </span>
                    </div>
                    <button
                      id={`friend-${f.id}-remove-btn`}
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
              <p id="friends-received-loading" className="friends-state">Loading invitations...</p>
            )}
            {received && received.length === 0 && (
              <p id="friends-received-empty" className="friends-state">No pending invitations.</p>
            )}
            {received && received.length > 0 && (
              <ul id="friends-received-list" className="friends-list">
                {received.map((inv) => (
                  <li key={inv.id} id={`invitation-${inv.id}`} className="friends-list-item">
                    <div id={`invitation-${inv.id}-info`} className="friends-list-item-info">
                      <span id={`invitation-${inv.id}-from-name`} className="friends-list-item-name">
                        {inv.from_user.display_name || inv.from_user.username}
                      </span>
                      <span id={`invitation-${inv.id}-from-username`} className="friends-list-item-username">
                        @{inv.from_user.username}
                      </span>
                    </div>
                    <div id={`invitation-${inv.id}-actions`} className="friends-invitation-actions">
                      <button
                        id={`invitation-${inv.id}-accept-btn`}
                        type="button"
                        className="friends-accept-btn"
                        onClick={() => handleRespond(inv, 'accept')}
                        disabled={respond.isPending}
                      >
                        Accept
                      </button>
                      <button
                        id={`invitation-${inv.id}-decline-btn`}
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
              <p id="friends-sent-loading" className="friends-state">Loading invitations...</p>
            )}
            {sent && sent.length === 0 && (
              <p id="friends-sent-empty" className="friends-state">No sent invitations.</p>
            )}
            {sent && sent.length > 0 && (
              <ul id="friends-sent-list" className="friends-list">
                {sent.map((inv) => (
                  <li key={inv.id} id={`sent-invitation-${inv.id}`} className="friends-list-item">
                    <div id={`sent-invitation-${inv.id}-info`} className="friends-list-item-info">
                      {inv.to_user ? (
                        <>
                          <span id={`sent-invitation-${inv.id}-name`} className="friends-list-item-name">
                            {inv.to_user.display_name || inv.to_user.username}
                          </span>
                          <span id={`sent-invitation-${inv.id}-username`} className="friends-list-item-username">
                            @{inv.to_user.username}
                          </span>
                        </>
                      ) : (
                        <span id={`sent-invitation-${inv.id}-name`} className="friends-list-item-name">
                          {inv.to_email}
                        </span>
                      )}
                    </div>
                    <span
                      id={`sent-invitation-${inv.id}-status`}
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

      <AddFriendModal
        open={addFriendOpen}
        onClose={() => setAddFriendOpen(false)}
      />

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
    </PageCard>
  )
}
