import { useEffect, useState } from "react";
import { requestBlobWithSession } from "../services/authService";

const privateAvatarPath = "/api/v1/auth/me/avatar";

/** Loads the authenticated account avatar without exposing the private file URL. */
export function useAccountAvatar(avatarUrl: string | null | undefined): string | null {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (!avatarUrl) {
      setAvatarSrc(null);
      return;
    }
    if (!avatarUrl.startsWith(privateAvatarPath)) {
      setAvatarSrc(avatarUrl);
      return;
    }
    void requestBlobWithSession(avatarUrl)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setAvatarSrc(objectUrl);
      })
      .catch(() => setAvatarSrc(null));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [avatarUrl]);

  return avatarSrc;
}
