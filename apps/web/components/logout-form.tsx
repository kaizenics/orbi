"use client";

import { clearOfflineData } from "@/lib/offline";

/** Log out form. Saved offline data is wiped first, so the next person on this browser sees none of it. */
export function LogoutForm({ children }: { children: React.ReactNode }) {
  return (
    <form
      method="post"
      action="/auth/logout"
      onSubmit={(e) => {
        const form = e.currentTarget;
        e.preventDefault();
        void clearOfflineData().finally(() => form.submit());
      }}
    >
      {children}
    </form>
  );
}
