// Where an invitation's link opens (story CRM-P1.2): `/join/<token>` at the firm's address. The server function that emails the
// link (supabase/functions/invite-member) builds the same path.
export const JOIN_PATH_PREFIX = "/join/";
