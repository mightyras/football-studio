import { supabase } from '../lib/supabase';

/**
 * Call the send-invite-email Edge Function.
 * Creates a Supabase auth user (if they don't exist) and sends them an invite email.
 * This is fire-and-forget — the invite record is already saved; the email is a best-effort bonus.
 */
export async function sendInviteEmail(
  email: string,
  name?: string,
): Promise<{ status: 'invited' | 'existing_user' | 'error'; message?: string }> {
  if (!supabase) return { status: 'error', message: 'Supabase not configured' };

  try {
    const { data, error } = await supabase.functions.invoke('send-invite-email', {
      body: {
        email,
        name: name || undefined,
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      console.warn('Invite email failed:', error.message);
      return { status: 'error', message: error.message };
    }

    return data as { status: 'invited' | 'existing_user'; message?: string };
  } catch (err) {
    console.warn('Invite email failed:', err);
    return { status: 'error', message: (err as Error).message };
  }
}

/**
 * Generate an invite link without sending an email.
 * Creates a Supabase auth user (if they don't exist) and returns a shareable invite URL.
 * The inviter can copy and share this link via any channel (WhatsApp, SMS, etc.).
 */
export async function generateInviteLink(
  email: string,
  name?: string,
): Promise<{ status: 'invited' | 'existing_user' | 'error'; inviteLink?: string; message?: string }> {
  if (!supabase) return { status: 'error', message: 'Supabase not configured' };

  try {
    const { data, error } = await supabase.functions.invoke('send-invite-email', {
      body: {
        email,
        name: name || undefined,
        redirectTo: window.location.origin,
        mode: 'link',
      },
    });

    if (error) {
      console.warn('Generate invite link failed:', error.message);
      return { status: 'error', message: error.message };
    }

    return data as { status: 'invited' | 'existing_user'; inviteLink?: string; message?: string };
  } catch (err) {
    console.warn('Generate invite link failed:', err);
    return { status: 'error', message: (err as Error).message };
  }
}
