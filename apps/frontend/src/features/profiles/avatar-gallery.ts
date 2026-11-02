import { isWeb } from "@/adapters";

import { profileCommand } from "./api";
import { isCustomAvatar } from "./avatar-catalog";

/**
 * Folio fork: pictures uploaded on this server, offered to every profile in the
 * avatar picker. Only the self-hosted server keeps a gallery; elsewhere it is empty.
 */
export async function loadAvatarGallery(): Promise<string[]> {
  if (!isWeb) return [];
  try {
    const { pictures } = await profileCommand<{ pictures: unknown }>("list_avatar_gallery");
    return Array.isArray(pictures)
      ? pictures.filter(
          (picture): picture is string => typeof picture === "string" && isCustomAvatar(picture),
        )
      : [];
  } catch {
    return [];
  }
}

/** Keep an uploaded picture for later; the picture itself is already chosen. */
export async function saveToAvatarGallery(avatar: string): Promise<boolean> {
  if (!isWeb) return false;
  try {
    await profileCommand("save_avatar_to_gallery", { avatarId: avatar });
    return true;
  } catch {
    return false;
  }
}
