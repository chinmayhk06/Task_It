import { useState, useEffect } from "react";
import {
  FiUser, FiLock, FiBell, FiMoon, FiBriefcase,
  FiSave, FiCheckCircle
} from "react-icons/fi";
import {
  getProfile, updateProfile, changePassword,
  getNotificationPrefs, updateNotificationPrefs
} from "../../services/settingsService";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("Profile");
  
  // Profile State
  const [profile, setProfile] = useState({ fullName: "", email: "", phone: "", department: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });

  // Password State
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passLoading, setPassLoading] = useState(false);
  const [passMessage, setPassMessage] = useState({ type: "", text: "" });

  // Notifications State
  const [notifs, setNotifs] = useState({
    taskAssigned: true, taskCompleted: true, deadlineReminder: true, projectUpdates: true
  });
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [notifsMessage, setNotifsMessage] = useState({ type: "", text: "" });

  // Appearance State
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Fetch initial data
  useEffect(() => {
    getProfile().then(res => setProfile(res.data.data)).catch(console.error);
    getNotificationPrefs().then(res => setNotifs(res.data.data)).catch(console.error);
    setIsDarkMode(document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark");
  }, []);

  // Handlers
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileLoading(true); setProfileMessage({ type: "", text: "" });
    try {
      const res = await updateProfile(profile);
      setProfileMessage({ type: "success", text: "Profile updated successfully!" });
      // Update local storage user info if name changed
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...user, ...res.data.data }));
      window.dispatchEvent(new Event("storage"));
    } catch (err) {
      setProfileMessage({ type: "error", text: err.response?.data?.message || "Update failed." });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPassLoading(true); setPassMessage({ type: "", text: "" });
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPassMessage({ type: "error", text: "New passwords do not match." });
      setPassLoading(false); return;
    }
    try {
      await changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      setPassMessage({ type: "success", text: "Password changed successfully!" });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPassMessage({ type: "error", text: err.response?.data?.message || "Failed to change password." });
    } finally {
      setPassLoading(false);
    }
  };

  const handleNotifsSave = async (e) => {
    e.preventDefault();
    setNotifsLoading(true); setNotifsMessage({ type: "", text: "" });
    try {
      await updateNotificationPrefs(notifs);
      setNotifsMessage({ type: "success", text: "Preferences saved!" });
    } catch {
      setNotifsMessage({ type: "error", text: "Failed to save preferences." });
    } finally {
      setNotifsLoading(false);
    }
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const tabs = [
    { name: "Profile", icon: FiUser },
    { name: "Security", icon: FiLock },
    { name: "Notifications", icon: FiBell },
    { name: "Appearance", icon: FiMoon },
    { name: "Organization", icon: FiBriefcase },
  ];

  return (
    <div className="app-page">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold text-[var(--title-color)] dark:text-[var(--title-color)] mb-6">Settings</h1>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Tabs */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <div className="rounded-lg border border-[var(--border-color)] dark:border-gray-800 bg-[var(--surface-card)] dark:bg-gray-800  p-2 flex flex-col gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition
                    ${activeTab === tab.name 
                      ? "bg-[var(--surface-muted)] text-[var(--title-color)] dark:bg-[var(--hover-bg)] dark:text-[var(--title-color)]" 
                      : "text-[var(--subtitle-color)] dark:text-[var(--muted-color)] hover:bg-[var(--surface-muted)] dark:hover:bg-gray-700/50 hover:text-[var(--title-color)] dark:hover:text-[var(--title-color)]"
                    }`}
                >
                  <tab.icon size={18} />
                  {tab.name}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            <div className="rounded-lg border border-[var(--border-color)] dark:border-gray-800 bg-[var(--surface-card)] dark:bg-gray-800  p-8">
              
              {/* PROFILE TAB */}
              {activeTab === "Profile" && (
                <form onSubmit={handleProfileSave} className="space-y-6 max-w-xl">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--title-color)] dark:text-[var(--title-color)] mb-1">Profile Details</h2>
                    <p className="text-sm text-[var(--subtitle-color)] dark:text-[var(--muted-color)]">Update your personal information.</p>
                  </div>

                  {profileMessage.text && (
                    <div className={`p-3 rounded-md text-sm ${profileMessage.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {profileMessage.text}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--title-color)] dark:text-[var(--muted-color)] mb-1">Full Name</label>
                      <input type="text" required value={profile.fullName} onChange={e => setProfile({...profile, fullName: e.target.value})}
                        className="w-full rounded-md border border-[var(--border-color)] dark:border-gray-700 bg-[var(--surface-card)] dark:bg-gray-900 px-4 py-2.5 text-[var(--title-color)] dark:text-[var(--title-color)] outline-none focus:border-[var(--title-color)] focus:ring-1 focus:ring-gray-300 transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--title-color)] dark:text-[var(--muted-color)] mb-1">Email Address</label>
                      <input type="email" required value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})}
                        className="w-full rounded-md border border-[var(--border-color)] dark:border-gray-700 bg-[var(--surface-card)] dark:bg-gray-900 px-4 py-2.5 text-[var(--title-color)] dark:text-[var(--title-color)] outline-none focus:border-[var(--title-color)] focus:ring-1 focus:ring-gray-300 transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--title-color)] dark:text-[var(--muted-color)] mb-1">Phone Number</label>
                      <input type="tel" value={profile.phone || ""} onChange={e => setProfile({...profile, phone: e.target.value})}
                        className="w-full rounded-md border border-[var(--border-color)] dark:border-gray-700 bg-[var(--surface-card)] dark:bg-gray-900 px-4 py-2.5 text-[var(--title-color)] dark:text-[var(--title-color)] outline-none focus:border-[var(--title-color)] focus:ring-1 focus:ring-gray-300 transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--title-color)] dark:text-[var(--muted-color)] mb-1">Department</label>
                      <input type="text" value={profile.department || ""} onChange={e => setProfile({...profile, department: e.target.value})}
                        className="w-full rounded-md border border-[var(--border-color)] dark:border-gray-700 bg-[var(--surface-card)] dark:bg-gray-900 px-4 py-2.5 text-[var(--title-color)] dark:text-[var(--title-color)] outline-none focus:border-[var(--title-color)] focus:ring-1 focus:ring-gray-300 transition" />
                    </div>
                  </div>

                  <label className="block text-sm">Job title (optional)
                    <input maxLength={100} value={profile.jobTitle || ""} onChange={e => setProfile({...profile, jobTitle: e.target.value})} className="mt-1 w-full rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] px-4 py-2.5" />
                  </label>
                  <button type="submit" disabled={profileLoading} className="flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] transition disabled:opacity-70">
                    {profileLoading ? "Saving..." : <><FiSave size={16} /> Save Changes</>}
                  </button>
                </form>
              )}

              {/* SECURITY TAB */}
              {activeTab === "Security" && (
                <form onSubmit={handlePasswordSave} className="space-y-6 max-w-xl">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--title-color)] dark:text-[var(--title-color)] mb-1">Change Password</h2>
                    <p className="text-sm text-[var(--subtitle-color)] dark:text-[var(--muted-color)]">Ensure your account is using a long, random password.</p>
                  </div>

                  {passMessage.text && (
                    <div className={`p-3 rounded-md text-sm ${passMessage.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {passMessage.text}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--title-color)] dark:text-[var(--muted-color)] mb-1">Current Password</label>
                      <input type="password" required value={passwords.currentPassword} onChange={e => setPasswords({...passwords, currentPassword: e.target.value})}
                        className="w-full rounded-md border border-[var(--border-color)] dark:border-gray-700 bg-[var(--surface-card)] dark:bg-gray-900 px-4 py-2.5 text-[var(--title-color)] dark:text-[var(--title-color)] outline-none focus:border-[var(--title-color)] focus:ring-1 focus:ring-gray-300 transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--title-color)] dark:text-[var(--muted-color)] mb-1">New Password</label>
                      <input type="password" required minLength={6} value={passwords.newPassword} onChange={e => setPasswords({...passwords, newPassword: e.target.value})}
                        className="w-full rounded-md border border-[var(--border-color)] dark:border-gray-700 bg-[var(--surface-card)] dark:bg-gray-900 px-4 py-2.5 text-[var(--title-color)] dark:text-[var(--title-color)] outline-none focus:border-[var(--title-color)] focus:ring-1 focus:ring-gray-300 transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--title-color)] dark:text-[var(--muted-color)] mb-1">Confirm New Password</label>
                      <input type="password" required minLength={6} value={passwords.confirmPassword} onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})}
                        className="w-full rounded-md border border-[var(--border-color)] dark:border-gray-700 bg-[var(--surface-card)] dark:bg-gray-900 px-4 py-2.5 text-[var(--title-color)] dark:text-[var(--title-color)] outline-none focus:border-[var(--title-color)] focus:ring-1 focus:ring-gray-300 transition" />
                    </div>
                  </div>

                  <button type="submit" disabled={passLoading} className="flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] transition disabled:opacity-70">
                    {passLoading ? "Updating..." : <><FiLock size={16} /> Update Password</>}
                  </button>
                </form>
              )}

              {/* NOTIFICATIONS TAB */}
              {activeTab === "Notifications" && (
                <form onSubmit={handleNotifsSave} className="space-y-6 max-w-xl">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--title-color)] dark:text-[var(--title-color)] mb-1">Notification Preferences</h2>
                    <p className="text-sm text-[var(--subtitle-color)] dark:text-[var(--muted-color)]">Manage what alerts you receive via email and in-app.</p>
                  </div>

                  {notifsMessage.text && (
                    <div className={`p-3 rounded-md text-sm ${notifsMessage.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {notifsMessage.text}
                    </div>
                  )}

                  <div className="space-y-4">
                    {Object.keys(notifs).map(key => (
                      <div key={key} className="flex items-center justify-between p-4 rounded-md border border-[var(--border-color)] dark:border-gray-700 bg-[var(--surface-muted)] dark:bg-gray-800/50">
                        <div>
                          <p className="font-medium text-[var(--title-color)] dark:text-[var(--title-color)] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                          <p className="text-xs text-[var(--subtitle-color)] dark:text-[var(--muted-color)]">Receive alerts when {key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} occurs.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={notifs[key]} onChange={() => setNotifs({...notifs, [key]: !notifs[key]})} />
                          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--surface-card)] after:border-[var(--border-color)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-gray-200"></div>
                        </label>
                      </div>
                    ))}
                  </div>

                  <button type="submit" disabled={notifsLoading} className="flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] transition disabled:opacity-70">
                    {notifsLoading ? "Saving..." : <><FiCheckCircle size={16} /> Save Preferences</>}
                  </button>
                </form>
              )}

              {/* APPEARANCE TAB */}
              {activeTab === "Appearance" && (
                <div className="space-y-6 max-w-xl">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--title-color)] dark:text-[var(--title-color)] mb-1">Appearance Settings</h2>
                    <p className="text-sm text-[var(--subtitle-color)] dark:text-[var(--muted-color)]">Customize how Task It looks on your device.</p>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-md border border-[var(--border-color)] dark:border-gray-700 bg-[var(--surface-muted)] dark:bg-gray-800/50">
                    <div>
                      <p className="font-medium text-[var(--title-color)] dark:text-[var(--title-color)]">Dark Mode</p>
                      <p className="text-xs text-[var(--subtitle-color)] dark:text-[var(--muted-color)]">Switch between light and dark themes.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={isDarkMode} onChange={toggleDarkMode} />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--surface-card)] after:border-[var(--border-color)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-gray-200"></div>
                    </label>
                  </div>
                </div>
              )}

              {/* ORGANIZATION TAB */}
              {activeTab === "Organization" && (
                <div className="space-y-6 max-w-xl">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--title-color)] dark:text-[var(--title-color)] mb-1">Organization Settings</h2>
                    <p className="text-sm text-[var(--subtitle-color)] dark:text-[var(--muted-color)]">Manage your workspace details.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--title-color)] dark:text-[var(--muted-color)] mb-1">Workspace Name</label>
                      <input type="text" readOnly value="Task It - Team Workspace"
                        className="w-full rounded-md border border-[var(--border-color)] dark:border-gray-700 bg-[var(--surface-muted)] dark:bg-gray-900 px-4 py-2.5 text-[var(--subtitle-color)] dark:text-[var(--muted-color)] cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--title-color)] dark:text-[var(--muted-color)] mb-1">Workspace Description</label>
                      <textarea readOnly rows={3} value="A comprehensive project management workspace for cross-functional teams."
                        className="w-full rounded-md border border-[var(--border-color)] dark:border-gray-700 bg-[var(--surface-muted)] dark:bg-gray-900 px-4 py-2.5 text-[var(--subtitle-color)] dark:text-[var(--muted-color)] cursor-not-allowed resize-none" />
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                      <FiLock size={12} /> Only Admins can edit organization settings.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}







