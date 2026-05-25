export type NoticeTone = "success" | "error" | "warning" | "info";

export type NoticeContent = {
  tone: NoticeTone;
  title: string;
  message: string;
};

export const adminNotices: Record<string, NoticeContent> = {
  "client-created": {
    tone: "success",
    title: "Client created",
    message: "Use that exact email and client password on the client login page."
  },
  "client-updated": {
    tone: "success",
    title: "Client updated",
    message: "If you reset the password, share the new client password before testing login."
  },
  "client-password-reset": {
    tone: "success",
    title: "Client password updated",
    message: "Share the new password with the client."
  },
  "client-password-removed": {
    tone: "success",
    title: "Client password removed",
    message: "This client can no longer use personal password access until a new one is set."
  },
  "client-deleted": {
    tone: "success",
    title: "Client deleted",
    message: "The client record was removed."
  },
  "client-error": {
    tone: "error",
    title: "Client could not be saved",
    message: "Check the fields and try again."
  },
  "client-duplicate-email": {
    tone: "error",
    title: "Duplicate email",
    message: "Another client already uses that email address."
  },
  "client-password-error": {
    tone: "error",
    title: "Password was not saved",
    message: "Set it again, then test the client login."
  },
  "album-created": {
    tone: "success",
    title: "Album created",
    message: "The album is ready for uploads and client assignment."
  },
  "album-error": {
    tone: "error",
    title: "Album could not be created",
    message: "Check the album details and try again."
  },
  "album-updated": {
    tone: "success",
    title: "Album updated",
    message: "The gallery settings were saved."
  },
  "album-update-error": {
    tone: "error",
    title: "Album could not be updated",
    message: "Check the fields and try again."
  },
  "album-deleted": {
    tone: "success",
    title: "Album deleted",
    message: "The album record was removed."
  },
  "album-delete-error": {
    tone: "error",
    title: "Album could not be deleted",
    message: "Try again, or remove related files and records first."
  },
  "cover-updated": {
    tone: "success",
    title: "Cover updated",
    message: "The selected image is now the album cover."
  },
  "photo-uploaded": {
    tone: "success",
    title: "Photo uploaded",
    message: "The photo record and delivery files were saved."
  },
  "photos-uploaded": {
    tone: "success",
    title: "Photos uploaded",
    message: "The album photo set was saved successfully."
  },
  "photo-updated": {
    tone: "success",
    title: "Photo updated",
    message: "The photo metadata was saved."
  },
  "photo-deleted": {
    tone: "success",
    title: "Photo deleted",
    message: "The photo record was removed."
  },
  "photo-error": {
    tone: "error",
    title: "Photo action failed",
    message: "The photo action could not be completed. Check the file and try again."
  },
  "zip-uploaded": {
    tone: "success",
    title: "ZIP uploaded",
    message: "The full album download is ready."
  },
  "zip-removed": {
    tone: "success",
    title: "ZIP removed",
    message: "The album no longer has a full ZIP download attached."
  },
  "zip-error": {
    tone: "error",
    title: "ZIP action failed",
    message: "The ZIP action could not be completed."
  },
  "email-sent": {
    tone: "success",
    title: "Email sent",
    message: "The gallery email was sent to assigned clients with saved email addresses."
  },
  "email-not-configured": {
    tone: "warning",
    title: "Email is not configured",
    message: "Add the Resend email environment variables in Vercel before sending mail."
  },
  "email-no-recipients": {
    tone: "warning",
    title: "No email recipients",
    message: "Assign clients with saved email addresses before sending a gallery email."
  },
  "email-error": {
    tone: "error",
    title: "Email failed",
    message: "The saved action worked, but the email provider did not accept the message."
  },
  "inquiry-updated": {
    tone: "success",
    title: "Inquiry updated",
    message: "The inquiry status was saved."
  },
  "inquiry-error": {
    tone: "error",
    title: "Inquiry update failed",
    message: "The inquiry could not be updated."
  },
  "shoot-request-updated": {
    tone: "success",
    title: "Shoot request updated",
    message: "The booking request was saved."
  },
  "shoot-request-emailed": {
    tone: "success",
    title: "Shoot request updated",
    message: "The request was saved and the client was emailed."
  },
  "shoot-request-deleted": {
    tone: "success",
    title: "Shoot request deleted",
    message: "The booking request was removed."
  },
  "shoot-request-error": {
    tone: "error",
    title: "Shoot request update failed",
    message: "The request could not be updated."
  },
  "site-contact-updated": {
    tone: "success",
    title: "Contact details updated",
    message: "The public contact section and footer links now use the saved details."
  },
  "site-contact-error": {
    tone: "error",
    title: "Contact details failed",
    message: "Check the email, location, and social URLs. Social URLs need to start with https://."
  },
  "site-contact-setup-error": {
    tone: "warning",
    title: "Contact settings setup needed",
    message: "Run the site contact settings Supabase migration before saving these details."
  },
  "shoot-request-conflict": {
    tone: "warning",
    title: "Booking overlap blocked",
    message: "That accepted shoot overlaps another accepted booking. Adjust the time or decline/archive one first."
  },
  "about-updated": {
    tone: "success",
    title: "About page updated",
    message: "The page settings were saved."
  },
  "about-block-created": {
    tone: "success",
    title: "About block added",
    message: "The new block is available in the About page builder."
  },
  "about-block-updated": {
    tone: "success",
    title: "About block updated",
    message: "The block changes were saved."
  },
  "about-block-deleted": {
    tone: "success",
    title: "About block deleted",
    message: "The block was removed."
  },
  "about-error": {
    tone: "error",
    title: "About settings failed",
    message: "The About page settings could not be saved."
  },
  "about-meta-error": {
    tone: "error",
    title: "Metadata format issue",
    message: "About metadata needs at least one valid line like Based in: Melbourne."
  },
  "about-block-error": {
    tone: "error",
    title: "About block failed",
    message: "The About page block could not be saved."
  },
  "about-setup-error": {
    tone: "warning",
    title: "About builder setup needed",
    message: "Run the Supabase about builder migration before saving About page content."
  }
};

export const clientLoginNotices: Record<string, NoticeContent> = {
  "duplicate-client": {
    tone: "error",
    title: "Duplicate client profile",
    message: "More than one client uses this email. Contact rxncor.studio to fix the profile."
  },
  invalid: {
    tone: "error",
    title: "Login did not match",
    message: "The email or password did not match a client profile."
  },
  lookup: {
    tone: "warning",
    title: "Login check unavailable",
    message: "Client login could not be checked right now. Try again in a moment."
  },
  missing: {
    tone: "warning",
    title: "Details required",
    message: "Enter both email and password."
  },
  "no-client": {
    tone: "error",
    title: "Client profile not found",
    message: "No client profile was found for that email address."
  },
  "no-password": {
    tone: "warning",
    title: "Password not set",
    message: "This client does not have a client login password set yet."
  },
  "rate-limited": {
    tone: "warning",
    title: "Too many attempts",
    message: "Wait a few minutes, then try again."
  },
  "wrong-password": {
    tone: "error",
    title: "Password did not match",
    message: "That password does not match this client profile."
  },
  session: {
    tone: "info",
    title: "Sign in again",
    message: "Sign in again to view your albums."
  }
};

export const adminLoginNotices: Record<string, NoticeContent> = {
  invalid: {
    tone: "error",
    title: "Admin login failed",
    message: "The email or password did not match a Supabase admin user."
  },
  missing: {
    tone: "warning",
    title: "Details required",
    message: "Enter both email and password."
  },
  "rate-limited": {
    tone: "warning",
    title: "Too many attempts",
    message: "Wait a few minutes, then try again."
  },
  unauthorized: {
    tone: "error",
    title: "Admin access blocked",
    message: "This email is not in the admin allowlist for rxncor.studio."
  }
};

export const galleryNotices: Record<string, NoticeContent> = {
  "wrong-password": {
    tone: "error",
    title: "Password did not match",
    message: "Try again, or check the password sent with the gallery link."
  },
  "client-not-found": {
    tone: "error",
    title: "Client profile not found",
    message: "No client profile was found for that email address."
  },
  "client-no-password": {
    tone: "warning",
    title: "Client password not set",
    message: "This client does not have a client login password set yet."
  },
  "client-not-assigned": {
    tone: "error",
    title: "Gallery not assigned",
    message: "That client login is not assigned to this gallery."
  },
  "duplicate-client": {
    tone: "error",
    title: "Duplicate client profile",
    message: "More than one client uses that email. Ask rxncor.studio to update the client records."
  },
  "email-required": {
    tone: "warning",
    title: "Email required",
    message: "Enter your email before opening this gallery."
  },
  "rate-limited": {
    tone: "warning",
    title: "Too many attempts",
    message: "Wait a few minutes, then try again."
  }
};

export const shootRequestNotices: Record<string, NoticeContent> = {
  sent: {
    tone: "success",
    title: "Request sent",
    message: "I will confirm availability soon."
  },
  conflict: {
    tone: "warning",
    title: "Time already booked",
    message: "Choose another time or send a flexible window."
  },
  "setup-error": {
    tone: "warning",
    title: "Booking setup needed",
    message: "Shoot requests need the latest Supabase migration before this form can save."
  },
  "rate-limited": {
    tone: "warning",
    title: "Too many requests",
    message: "Wait a little while, then send the request again."
  },
  error: {
    tone: "error",
    title: "Request could not be sent",
    message: "Check the fields and try again."
  }
};

export const contactNotices: Record<string, NoticeContent> = {
  sent: {
    tone: "success",
    title: "Message sent",
    message: "I will reply as soon as I can."
  },
  error: {
    tone: "error",
    title: "Message could not be sent",
    message: "Check the fields and try again."
  },
  "rate-limited": {
    tone: "warning",
    title: "Too many messages",
    message: "Wait a little while, then try again."
  }
};
