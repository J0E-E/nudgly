import { useEffect, useRef, useState, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../contexts/NotificationContext'
import { useBrowserNotifications } from '../hooks/useBrowserNotifications'
import type { Notification } from '../types/notification'
import './NotificationPanel.css'

function formatRelativeTime(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffS = Math.floor((now - then) / 1000)
  if (diffS < 60) return 'just now'
  const diffM = Math.floor(diffS / 60)
  if (diffM < 60) return `${diffM}m ago`
  const diffH = Math.floor(diffM / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}d ago`
}

interface NotificationPanelProps {
  onClose: () => void
  bellRef: RefObject<HTMLButtonElement | null>
}

function canShowBrowserPermission(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default'
}

export function NotificationPanel({ onClose, bellRef }: NotificationPanelProps) {
  const { notifications, handleMarkRead, handleMarkAllRead, unreadCount } = useNotifications()
  const { requestPermission } = useBrowserNotifications()
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)
  const [showPermissionBtn, setShowPermissionBtn] = useState(canShowBrowserPermission)

  async function handleEnableBrowserNotifications() {
    await requestPermission()
    setShowPermissionBtn(canShowBrowserPermission())
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        bellRef.current && !bellRef.current.contains(target)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose, bellRef])

  async function handleItemClick(n: Notification) {
    if (!n.read_at) {
      await handleMarkRead(n.id)
    }
    navigate('/tasks')
    onClose()
  }

  async function handleMarkAllClick() {
    await handleMarkAllRead()
  }

  return (
    <div className="notification-panel" ref={panelRef} role="region" aria-label="Notifications">
      <div className="notification-panel-header">
        <strong className="notification-panel-title">Notifications</strong>
        {unreadCount > 0 && (
          <button
            type="button"
            className="notification-panel-mark-all"
            onClick={handleMarkAllClick}
          >
            Mark all read
          </button>
        )}
      </div>
      {showPermissionBtn && (
        <button
          type="button"
          className="notification-panel-permission-btn"
          onClick={handleEnableBrowserNotifications}
        >
          Enable browser notifications
        </button>
      )}
      {notifications.length === 0 ? (
        <p className="notification-panel-empty">No notifications yet</p>
      ) : (
        <ul className="notification-panel-list">
          {notifications.map(n => (
            <li
              key={n.id}
              className={`notification-panel-item${n.read_at ? '' : ' notification-panel-item--unread'}`}
            >
              <button
                type="button"
                className="notification-panel-item-btn"
                onClick={() => handleItemClick(n)}
              >
                <strong className="notification-panel-item-title">{n.title}</strong>
                <span className="notification-panel-item-body">{n.body}</span>
                <time className="notification-panel-item-time">
                  {formatRelativeTime(n.triggered_at)}
                </time>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
