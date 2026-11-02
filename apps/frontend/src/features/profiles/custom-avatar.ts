import { CUSTOM_AVATAR_SIZE, MAX_CUSTOM_AVATAR_BYTES, isCustomAvatar } from "./avatar-catalog";

/**
 * Folio fork: turn a chosen picture into a profile avatar. The centre square is
 * kept and scaled to a small PNG; smaller sizes are tried until it fits the
 * 64 KB limit. Returns null when the file cannot be read as an image.
 */
export async function pictureToAvatar(file: Blob): Promise<string | null> {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const side = Math.min(image.width, image.height);
    if (side < 1) return null;
    for (const size of [CUSTOM_AVATAR_SIZE, 128, 96]) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = Math.min(size, side);
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const avatar = canvas.toDataURL("image/png");
      if (isCustomAvatar(avatar) && avatarBytes(avatar) <= MAX_CUSTOM_AVATAR_BYTES) return avatar;
    }
    return null;
  } finally {
    image.close();
  }
}

function avatarBytes(avatar: string) {
  const encoded = avatar.slice(avatar.indexOf(",") + 1);
  return Math.floor((encoded.length * 3) / 4) - (encoded.match(/=+$/)?.[0].length ?? 0);
}
