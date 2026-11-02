import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { loadAvatarGallery, saveToAvatarGallery } from "./avatar-gallery";
import { pictureToAvatar } from "./custom-avatar";
import { isCustomAvatar } from "./avatar-catalog";
import { PROFILE_AVATAR_GROUPS, ProfileAvatar } from "./profile-avatar";

export function ProfileAvatarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation("common");
  const [style, setStyle] = useState("All");
  const [gallery, setGallery] = useState<string[]>([]);
  useEffect(() => {
    let current = true;
    void loadAvatarGallery().then((pictures) => current && setGallery(pictures));
    return () => {
      current = false;
    };
  }, []);
  const categories = [
    ...(gallery.length ? [{ name: "Gallery", avatars: gallery }] : []),
    ...PROFILE_AVATAR_GROUPS,
  ];
  const groups = [
    { name: "All", avatars: categories.flatMap((group) => group.avatars) },
    ...categories,
  ];
  const labels: Record<string, string> = {
    All: t("profiles.avatarAll"),
    Gallery: t("profiles.avatarGallery"),
    Cats: t("profiles.avatarCats"),
    Sketch: t("profiles.avatarSketch"),
    Line: t("profiles.avatarLine"),
    "Pixel art": t("profiles.avatarPixel"),
    "3D": t("profiles.avatar3d"),
    Abstract: t("profiles.avatarAbstract"),
  };
  const group = groups.find((group) => group.name === style) ?? groups[0];
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadFailed, setUploadFailed] = useState(false);
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const avatar = await pictureToAvatar(file);
    setUploadFailed(avatar === null);
    if (!avatar) return;
    onChange(avatar);
    if (await saveToAvatarGallery(avatar)) setGallery(await loadAvatarGallery());
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {isCustomAvatar(value) && (
          <ProfileAvatar id={value} className="mx-0 size-12 rounded-full" />
        )}
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="focus-visible:ring-ring text-muted-foreground hover:text-foreground rounded-full bg-white/20 px-3 py-1.5 text-xs focus-visible:ring-2 dark:bg-white/5"
        >
          {t("profiles.avatarUpload")}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => void upload(event)}
        />
        {uploadFailed && (
          <span role="alert" className="text-destructive text-xs">
            {t("profiles.avatarUploadFailed")}
          </span>
        )}
      </div>
      <div role="group" aria-label={t("profiles.avatarStyle")} className="flex flex-wrap gap-1">
        {groups.map((item) => (
          <button
            key={labels[item.name]}
            type="button"
            aria-pressed={style === item.name}
            onClick={() => setStyle(item.name)}
            className={`focus-visible:ring-ring rounded-full px-3 py-1.5 text-xs focus-visible:ring-2 ${style === item.name ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-white/20 dark:bg-white/5"}`}
          >
            {labels[item.name]}
          </button>
        ))}
      </div>
      <div
        role="group"
        aria-label={t("profiles.avatarGroup", { style: labels[style] })}
        className="grid w-full grid-cols-4 gap-3 !overflow-visible pt-4 pb-8 sm:grid-cols-8 sm:gap-2"
      >
        {group.avatars.map((id, index) => (
          <button
            type="button"
            key={isCustomAvatar(id) ? `picture-${index}` : id}
            aria-label={(() => {
              const category = categories.find((entry) => entry.avatars.includes(id))!;
              return t("profiles.avatarLabel", {
                style: labels[category.name],
                number: category.avatars.indexOf(id) + 1,
              });
            })()}
            aria-pressed={value === id}
            onClick={() => onChange(id)}
            className="focus-visible:ring-ring flex min-w-0 justify-center !overflow-visible rounded-full p-0 hover:brightness-105 focus-visible:ring-2 sm:p-1"
          >
            <span
              className={`profile-lock-avatar w-full [--avatar-rim:3px] sm:w-auto ${value === id ? "drop-shadow-[0_0_7px_#c09a5bb3] dark:drop-shadow-[0_0_8px_#e2bd75b3]" : ""}`}
            >
              <ProfileAvatar
                id={id}
                className="h-auto w-full rounded-full sm:size-14 [&_.profile-abstract-sculpture]:scale-90"
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
