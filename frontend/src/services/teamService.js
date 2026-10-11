import api from "./api";

// Get all teams
export const getTeams = async () => {
    const response = await api.get("/team");
    return response.data;
};

// Get single team
export const getTeam = async (id) => {
    const response = await api.get(`/team/${id}`);
    return response.data;
};

// Create team
export const createTeam = async (teamData) => {
    const response = await api.post("/team", teamData);
    return response.data;
};

// Update team
export const updateTeam = async (id, teamData) => {
    const response = await api.put(`/team/${id}`, teamData);
    return response.data;
};

// Delete team
export const deleteTeam = async (id) => {
    const response = await api.delete(`/team/${id}`);
    return response.data;
};

// Invite member
export const inviteMember = async (id, email, role = "Intern") => {
    const response = await api.post(`/team/${id}/invite`, {
        email,
        role,
    });

    return response.data;
};

export const getInvitations = async (id) => (await api.get(`/team/${id}/invitations`)).data;
export const reassignManager = async (id, userId) => (await api.post(`/team/${id}/manager`, { userId })).data;
export const resendInvitation = async (id, invitationId) => (await api.post(`/team/${id}/invitations/${invitationId}/resend`)).data;
export const revokeInvitation = async (id, invitationId) => (await api.delete(`/team/${id}/invitations/${invitationId}`)).data;

// Leave team
export const leaveTeam = async (id) => {
    const response = await api.delete(`/team/${id}/leave`);
    return response.data;
};

// Remove member
export const removeMember = async (teamId, userId) => {
    const response = await api.delete(
        `/team/${teamId}/member/${userId}`
    );

    return response.data;
};

// Update member role
export const updateMemberRole = async (teamId, userId, role) => {
    const response = await api.patch(
        `/team/${teamId}/member/${userId}/role`,
        { role }
    );

    return response.data;
};
