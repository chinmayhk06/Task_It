export const invitationReturn = (search = window.location.search) => {
  const value = new URLSearchParams(search).get("returnTo") || "";
  return /^\/invitations\/[a-f0-9]{64}$/.test(value) ? value : "";
};
export const authLink = (path, returnTo) => returnTo ? `${path}?returnTo=${encodeURIComponent(returnTo)}` : path;
