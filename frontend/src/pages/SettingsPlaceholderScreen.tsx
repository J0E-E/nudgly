/**
 * Settings placeholder: minimal screen with link back to profile.
 * Full settings (theme, timezone, notifications, change password) in Epic 14/15.
 */

import { Link } from 'react-router-dom'
import './ProfileScreen.css'

export function SettingsPlaceholderScreen() {
  return (
    <main id="settings-screen" className="profile-view" aria-label="Settings">
      <h1 id="settings-screen-title">Settings</h1>
      <p id="settings-placeholder-message">
        More options coming soon. You can manage your profile from the profile
        page.
      </p>
      <p id="settings-profile-link-wrap">
        <Link id="settings-profile-link" to="/profile">
          Back to profile
        </Link>
      </p>
    </main>
  )
}
